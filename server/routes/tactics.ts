import { Router, type Request } from 'express';
import { parseJson, q, type DB } from '../db.ts';
import { bad, defined, notFound, oneOf, str, strList } from '../validate.ts';
import { RESOURCE_CATEGORIES, SYSTEM_CATEGORIES, type Diagram } from '../../shared/domain.ts';

const VIEWS = ['full', 'dzone', 'ozone', 'neutral'];
const ITEM_KINDS = ['F', 'D', 'G', 'X', 'C', 'puck', 'cone', 'net', 'text'];
const PATH_KINDS = ['skate', 'carry', 'pass', 'shot', 'backward', 'line'];

/** Validate and normalise a rink diagram coming from the client. */
export function validateDiagram(raw: any): Diagram {
  if (!raw || typeof raw !== 'object') throw bad('Invalid diagram');
  const view = VIEWS.includes(raw.view) ? raw.view : 'full';
  const items = Array.isArray(raw.items) ? raw.items : [];
  const paths = Array.isArray(raw.paths) ? raw.paths : [];
  if (items.length > 80 || paths.length > 80) throw bad('Diagram is too large');
  const num = (n: unknown) => {
    const v = Number(n);
    if (!Number.isFinite(v)) throw bad('Invalid diagram coordinates');
    return Math.round(v * 10) / 10;
  };
  return {
    view,
    items: items.map((it: any) => {
      if (!ITEM_KINDS.includes(it?.kind)) throw bad('Invalid diagram item');
      return {
        id: String(it.id ?? Math.random().toString(36).slice(2)),
        kind: it.kind,
        x: num(it.x),
        y: num(it.y),
        ...(it.label ? { label: String(it.label).slice(0, 24) } : {}),
      };
    }),
    paths: paths.map((p: any) => {
      if (!PATH_KINDS.includes(p?.kind) || !Array.isArray(p.points) || p.points.length < 2 || p.points.length > 60) throw bad('Invalid diagram path');
      return { id: String(p.id ?? Math.random().toString(36).slice(2)), kind: p.kind, points: p.points.map((pt: any) => [num(pt?.[0]), num(pt?.[1])]) };
    }),
  };
}

function validateSteps(raw: unknown) {
  if (!Array.isArray(raw)) throw bad('Steps must be a list');
  if (raw.length > 12) throw bad('A system can have at most 12 steps');
  return raw.map((s: any, i) => ({
    title: str(s?.title, `Step ${i + 1} title`, { required: true, max: 120 }),
    body: str(s?.body, `Step ${i + 1} explanation`, { max: 3000 }) ?? '',
    diagram: s?.diagram ? validateDiagram(s.diagram) : null,
  }));
}

/** Tactical systems, team playbook, saved tactical-board diagrams and the coaching library. */
export function tacticsRoutes(db: DB) {
  const r = Router({ mergeParams: true });
  const d = q(db);
  const tid = (req: Request) => Number(req.params.teamId);

  // ---------- Systems & playbook ----------
  r.get('/systems', (req: Request, res) => {
    const rows = d.all(
      `SELECT s.*, pe.added_at AS playbook_added_at, pe.notes AS playbook_notes FROM systems s
       LEFT JOIN playbook_entries pe ON pe.system_id = s.id AND pe.team_id = ?1
       WHERE s.team_id IS NULL OR s.team_id = ?1 ORDER BY s.category, s.name`,
      tid(req),
    );
    res.json(rows.map((s) => ({ ...parseJson(s, 'key_points', 'steps'), in_playbook: !!s.playbook_added_at })));
  });

  const getSystem = (req: Request) => {
    const s = d.get(
      `SELECT s.*, pe.added_at AS playbook_added_at, pe.notes AS playbook_notes FROM systems s
       LEFT JOIN playbook_entries pe ON pe.system_id = s.id AND pe.team_id = ?1 WHERE s.id = ?2 AND (s.team_id IS NULL OR s.team_id = ?1)`,
      tid(req),
      req.params.id,
    );
    if (!s) throw notFound('System');
    return { ...parseJson(s, 'key_points', 'steps')!, in_playbook: !!s.playbook_added_at };
  };

  r.get('/systems/:id', (req: Request, res) => res.json(getSystem(req)));

  function systemFields(body: any, required: boolean) {
    return defined({
      name: str(body.name, 'Name', { required, max: 120 }),
      category: oneOf(body.category, 'Category', SYSTEM_CATEGORIES, { required }),
      summary: str(body.summary, 'Summary', { max: 3000 }),
      key_points: strList(body.key_points, 'Key points'),
      steps: body.steps === undefined ? undefined : validateSteps(body.steps),
    });
  }

  r.post('/systems', (req: Request, res) => {
    const id = d.tx(() => {
      const id = d.insert('systems', { team_id: tid(req), steps: [], ...systemFields(req.body, true) });
      if (req.body.add_to_playbook !== false) d.run('INSERT OR IGNORE INTO playbook_entries (team_id, system_id) VALUES (?, ?)', tid(req), id);
      return id;
    });
    req.params.id = String(id);
    res.status(201).json(getSystem(req));
  });

  r.patch('/systems/:id', (req: Request, res) => {
    const s = getSystem(req);
    if (s.team_id === null) throw bad('BenchIQ library systems are read-only. Duplicate it to customise.');
    d.update('systems', s.id, systemFields(req.body, false));
    res.json(getSystem(req));
  });

  r.delete('/systems/:id', (req: Request, res) => {
    const s = getSystem(req);
    if (s.team_id === null) throw bad('BenchIQ library systems cannot be deleted');
    d.run('DELETE FROM systems WHERE id = ?', s.id);
    res.json({ ok: true });
  });

  r.post('/systems/:id/duplicate', (req: Request, res) => {
    const s = getSystem(req);
    const id = d.tx(() => {
      const id = d.insert('systems', { team_id: tid(req), name: `${s.name} (team version)`, category: s.category, summary: s.summary, key_points: s.key_points, steps: s.steps });
      d.run('INSERT OR IGNORE INTO playbook_entries (team_id, system_id) VALUES (?, ?)', tid(req), id);
      return id;
    });
    req.params.id = String(id);
    res.status(201).json(getSystem(req));
  });

  r.put('/playbook/:id', (req: Request, res) => {
    const s = getSystem(req);
    d.run(
      'INSERT INTO playbook_entries (team_id, system_id, notes) VALUES (?, ?, ?) ON CONFLICT (team_id, system_id) DO UPDATE SET notes = excluded.notes',
      tid(req),
      s.id,
      str(req.body.notes, 'Notes', { max: 3000 }) ?? '',
    );
    res.json(getSystem(req));
  });

  r.delete('/playbook/:id', (req: Request, res) => {
    d.run('DELETE FROM playbook_entries WHERE team_id = ? AND system_id = ?', tid(req), req.params.id);
    res.json({ ok: true });
  });

  // ---------- Tactical board diagrams ----------
  r.get('/diagrams', (req: Request, res) => {
    res.json(d.all('SELECT * FROM diagrams WHERE team_id = ? ORDER BY updated_at DESC', tid(req)).map((x) => parseJson(x, 'data')));
  });
  r.post('/diagrams', (req: Request, res) => {
    const id = d.insert('diagrams', {
      team_id: tid(req),
      name: str(req.body.name, 'Name', { required: true, max: 120 }),
      description: str(req.body.description, 'Description', { max: 2000 }) ?? '',
      data: validateDiagram(req.body.data),
    });
    res.status(201).json(parseJson(d.get('SELECT * FROM diagrams WHERE id = ?', id), 'data'));
  });
  r.patch('/diagrams/:id', (req: Request, res) => {
    const x = d.get('SELECT * FROM diagrams WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!x) throw notFound('Diagram');
    d.update('diagrams', x.id, {
      ...defined({ name: str(req.body.name, 'Name', { max: 120 }), description: str(req.body.description, 'Description', { max: 2000 }) }),
      ...(req.body.data ? { data: validateDiagram(req.body.data) } : {}),
      updated_at: new Date().toISOString(),
    });
    res.json(parseJson(d.get('SELECT * FROM diagrams WHERE id = ?', x.id), 'data'));
  });
  r.delete('/diagrams/:id', (req: Request, res) => {
    d.run('DELETE FROM diagrams WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  // ---------- Coaching library ----------
  r.get('/resources', (req: Request, res) => {
    const rows = d.all('SELECT id, team_id, category, title, summary, level, read_minutes, video_url IS NOT NULL AS has_video, diagram IS NOT NULL AS has_diagram FROM resources WHERE team_id IS NULL OR team_id = ? ORDER BY category, title', tid(req));
    res.json(rows);
  });
  r.get('/resources/:id', (req: Request, res) => {
    const x = d.get('SELECT * FROM resources WHERE id = ? AND (team_id IS NULL OR team_id = ?)', req.params.id, tid(req));
    if (!x) throw notFound('Resource');
    res.json(parseJson(x, 'tips', 'diagram'));
  });
  r.post('/resources', (req: Request, res) => {
    const video = str(req.body.video_url, 'Video URL', { max: 500 });
    if (video && !/^https:\/\//.test(video)) throw bad('Video URL must start with https://');
    const id = d.insert('resources', {
      team_id: tid(req),
      category: oneOf(req.body.category, 'Category', RESOURCE_CATEGORIES, { required: true }),
      title: str(req.body.title, 'Title', { required: true, max: 160 }),
      summary: str(req.body.summary, 'Summary', { max: 500 }) ?? '',
      body: str(req.body.body, 'Body', { max: 20000 }) ?? '',
      tips: strList(req.body.tips, 'Tips') ?? [],
      video_url: video || null,
      diagram: req.body.diagram ? validateDiagram(req.body.diagram) : null,
      level: str(req.body.level, 'Level', { max: 40 }) || 'All ages',
      read_minutes: Math.max(1, Math.round(String(req.body.body ?? '').split(/\s+/).length / 200)),
    });
    res.status(201).json(parseJson(d.get('SELECT * FROM resources WHERE id = ?', id), 'tips', 'diagram'));
  });
  r.delete('/resources/:id', (req: Request, res) => {
    const x = d.get('SELECT * FROM resources WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!x) throw bad('Only resources your team added can be deleted');
    d.run('DELETE FROM resources WHERE id = ?', x.id);
    res.json({ ok: true });
  });

  return r;
}
