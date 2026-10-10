import { Router, type Request } from 'express';
import { parseJson, q, type DB, type Row } from '../db.ts';
import type { AuthedRequest } from '../auth.ts';
import { bad, defined, int, isoDate, notFound, oneOf, str, strList } from '../validate.ts';
import { DRILL_CATEGORIES, FOCUS_AREAS, PRIORITY_STATUSES } from '../../shared/domain.ts';
import { focusTrend, gameResult, recommendDrills, recurringIssues, trendSignal } from '../insights.ts';
import { validateDiagram } from './tactics.ts';

const ctx = (req: Request) => req as AuthedRequest;
const DRILL_JSON = ['age_levels', 'focus_areas', 'skills', 'coaching_points', 'equipment', 'diagram'];

/** Drills, practices, games, observations and development priorities. */
export function coachingRoutes(db: DB) {
  const r = Router({ mergeParams: true });
  const d = q(db);
  const tid = (req: Request) => Number(req.params.teamId);

  // ---------- Drills ----------
  function drillFields(body: any, required: boolean) {
    const focus = strList(body.focus_areas, 'Focus areas');
    if (focus?.some((f) => !(FOCUS_AREAS as readonly string[]).includes(f))) throw bad('Unknown focus area');
    return defined({
      name: str(body.name, 'Drill name', { required, max: 120 }),
      category: oneOf(body.category, 'Category', DRILL_CATEGORIES, { required }),
      description: str(body.description, 'Description', { max: 4000 }),
      duration: int(body.duration, 'Duration', { min: 1, max: 120 }) ?? undefined,
      intensity: oneOf(body.intensity, 'Intensity', ['low', 'medium', 'high'] as const),
      age_levels: strList(body.age_levels, 'Age levels'),
      focus_areas: focus,
      skills: strList(body.skills, 'Skills'),
      coaching_points: strList(body.coaching_points, 'Coaching points'),
      equipment: strList(body.equipment, 'Equipment'),
      diagram: body.diagram === undefined ? undefined : body.diagram === null ? null : validateDiagram(body.diagram),
    });
  }

  r.get('/drills', (req, res) => {
    const rows = d.all('SELECT * FROM drills WHERE team_id IS NULL OR team_id = ? ORDER BY name', tid(req));
    const usage = new Map(
      d.all('SELECT s.drill_id, COUNT(*) AS n FROM practice_segments s JOIN practices p ON p.id = s.practice_id WHERE p.team_id = ? AND s.drill_id IS NOT NULL GROUP BY s.drill_id', tid(req)).map((u) => [u.drill_id, Number(u.n)]),
    );
    res.json(rows.map((x) => ({ ...parseJson(x, ...DRILL_JSON), used: usage.get(x.id) ?? 0 })));
  });

  r.get('/drills/:id', (req, res) => {
    const drill = d.get('SELECT * FROM drills WHERE id = ? AND (team_id IS NULL OR team_id = ?)', req.params.id, tid(req));
    if (!drill) throw notFound('Drill');
    res.json(parseJson(drill, ...DRILL_JSON));
  });

  r.post('/drills', (req, res) => {
    const id = d.insert('drills', { team_id: tid(req), ...drillFields(req.body, true) });
    res.status(201).json(parseJson(d.get('SELECT * FROM drills WHERE id = ?', id), ...DRILL_JSON));
  });

  const teamDrill = (req: Request) => {
    const drill = d.get('SELECT * FROM drills WHERE id = ?', req.params.id);
    if (!drill || (drill.team_id !== null && drill.team_id !== tid(req))) throw notFound('Drill');
    if (drill.team_id === null) throw bad('BenchIQ library drills are read-only. Duplicate it to make your own version.');
    return drill;
  };

  r.patch('/drills/:id', (req, res) => {
    const drill = teamDrill(req);
    d.update('drills', drill.id, drillFields(req.body, false));
    res.json(parseJson(d.get('SELECT * FROM drills WHERE id = ?', drill.id), ...DRILL_JSON));
  });

  r.delete('/drills/:id', (req, res) => {
    const drill = teamDrill(req);
    d.run('DELETE FROM drills WHERE id = ?', drill.id);
    res.json({ ok: true });
  });

  r.post('/drills/:id/duplicate', (req, res) => {
    const src = d.get('SELECT * FROM drills WHERE id = ? AND (team_id IS NULL OR team_id = ?)', req.params.id, tid(req));
    if (!src) throw notFound('Drill');
    const { id: _id, created_at: _c, ...rest } = src;
    const id = d.insert('drills', { ...rest, team_id: tid(req), name: `${src.name} (custom)` });
    res.status(201).json(parseJson(d.get('SELECT * FROM drills WHERE id = ?', id), ...DRILL_JSON));
  });

  // ---------- Practices ----------
  function practiceFields(body: any, required: boolean) {
    return defined({
      title: str(body.title, 'Title', { required, max: 120 }),
      scheduled_at: isoDate(body.scheduled_at, 'Date'),
      duration: int(body.duration, 'Duration', { min: 10, max: 240 }) ?? undefined,
      location: str(body.location, 'Location', { max: 120 }),
      objectives: str(body.objectives, 'Objectives', { max: 4000 }),
      notes: str(body.notes, 'Notes', { max: 4000 }),
      is_template: body.is_template === undefined ? undefined : body.is_template ? 1 : 0,
      status: oneOf(body.status, 'Status', ['draft', 'planned', 'completed'] as const),
      source: oneOf(body.source, 'Source', ['manual', 'ai', 'template'] as const),
    });
  }

  type SegmentInput = { drill_id?: number | null; title?: string; duration?: number; notes?: string };
  function writeSegments(practiceId: number, teamId: number, segments: unknown) {
    if (!Array.isArray(segments)) throw bad('Segments must be a list');
    if (segments.length > 40) throw bad('A practice can have at most 40 segments');
    d.run('DELETE FROM practice_segments WHERE practice_id = ?', practiceId);
    segments.forEach((raw: SegmentInput, i) => {
      const drillId = int(raw.drill_id, 'Drill') ?? null;
      let title = str(raw.title, 'Segment title', { max: 120 });
      if (drillId) {
        const drill = d.get('SELECT name FROM drills WHERE id = ? AND (team_id IS NULL OR team_id = ?)', drillId, teamId);
        if (!drill) throw bad('Unknown drill in practice plan');
        title ||= drill.name;
      }
      if (!title) throw bad('Every segment needs a title or a drill');
      d.insert('practice_segments', {
        practice_id: practiceId,
        position: i,
        drill_id: drillId,
        title,
        duration: int(raw.duration, 'Segment duration', { min: 1, max: 120 }) ?? 10,
        notes: str(raw.notes, 'Segment notes', { max: 2000 }) ?? '',
      });
    });
  }
  function writePriorities(practiceId: number, teamId: number, ids: unknown) {
    if (!Array.isArray(ids)) throw bad('priority_ids must be a list');
    d.run('DELETE FROM practice_priorities WHERE practice_id = ?', practiceId);
    for (const pid of ids) {
      if (!d.get('SELECT id FROM priorities WHERE id = ? AND team_id = ?', pid, teamId)) throw bad('Unknown priority');
      d.run('INSERT OR IGNORE INTO practice_priorities (practice_id, priority_id) VALUES (?, ?)', practiceId, pid);
    }
  }

  function loadPractice(id: number, teamId: number) {
    const p = d.get('SELECT * FROM practices WHERE id = ? AND team_id = ?', id, teamId);
    if (!p) throw notFound('Practice');
    const segments = d
      .all(
        `SELECT s.*, dr.category, dr.description AS drill_description, dr.coaching_points, dr.equipment, dr.diagram, dr.focus_areas, dr.intensity
         FROM practice_segments s LEFT JOIN drills dr ON dr.id = s.drill_id WHERE s.practice_id = ? ORDER BY s.position`,
        p.id,
      )
      .map((s) => parseJson(s, 'coaching_points', 'equipment', 'diagram', 'focus_areas'));
    const priorities = d.all('SELECT pr.* FROM priorities pr JOIN practice_priorities pp ON pp.priority_id = pr.id WHERE pp.practice_id = ?', p.id);
    return { ...p, segments, priorities };
  }

  r.get('/practices', (req, res) => {
    const rows = d.all(
      `SELECT p.*, (SELECT COUNT(*) FROM practice_segments s WHERE s.practice_id = p.id) AS segment_count,
        (SELECT COALESCE(SUM(duration),0) FROM practice_segments s WHERE s.practice_id = p.id) AS planned_minutes,
        (SELECT GROUP_CONCAT(pr.title, '||') FROM priorities pr JOIN practice_priorities pp ON pp.priority_id = pr.id WHERE pp.practice_id = p.id) AS priority_titles
       FROM practices p WHERE team_id = ? ORDER BY is_template, scheduled_at IS NULL, scheduled_at DESC, created_at DESC`,
      tid(req),
    );
    res.json(rows.map((p) => ({ ...p, priority_titles: p.priority_titles ? String(p.priority_titles).split('||') : [] })));
  });

  r.post('/practices', (req, res) => {
    const teamId = tid(req);
    const id = d.tx(() => {
      const id = d.insert('practices', { team_id: teamId, ...practiceFields(req.body, true) });
      if (req.body.segments) writeSegments(id, teamId, req.body.segments);
      if (req.body.priority_ids) writePriorities(id, teamId, req.body.priority_ids);
      return id;
    });
    res.status(201).json(loadPractice(id, teamId));
  });

  r.get('/practices/:id', (req, res) => {
    res.json(loadPractice(Number(req.params.id), tid(req)));
  });

  r.patch('/practices/:id', (req, res) => {
    const teamId = tid(req);
    const p = loadPractice(Number(req.params.id), teamId);
    d.tx(() => {
      d.update('practices', p.id, { ...practiceFields(req.body, false), updated_at: new Date().toISOString() });
      if (req.body.segments !== undefined) writeSegments(p.id, teamId, req.body.segments);
      if (req.body.priority_ids !== undefined) writePriorities(p.id, teamId, req.body.priority_ids);
    });
    res.json(loadPractice(p.id, teamId));
  });

  r.delete('/practices/:id', (req, res) => {
    d.run('DELETE FROM practices WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  /** Duplicate a practice, save it as a template, or start a practice from a template. */
  r.post('/practices/:id/duplicate', (req, res) => {
    const teamId = tid(req);
    const src = loadPractice(Number(req.params.id), teamId);
    const asTemplate = !!req.body.as_template;
    const id = d.tx(() => {
      const id = d.insert('practices', {
        team_id: teamId,
        title: str(req.body.title, 'Title', { max: 120 }) || (asTemplate ? `${src.title} (template)` : src.is_template ? src.title : `${src.title} (copy)`),
        scheduled_at: asTemplate ? null : (isoDate(req.body.scheduled_at, 'Date') ?? null),
        duration: src.duration,
        location: src.location,
        objectives: src.objectives,
        notes: src.notes,
        is_template: asTemplate ? 1 : 0,
        status: 'planned',
        source: src.is_template ? 'template' : src.source,
      });
      writeSegments(id, teamId, src.segments.map((s: Row) => ({ drill_id: s.drill_id, title: s.title, duration: s.duration, notes: s.notes })));
      if (!asTemplate) writePriorities(id, teamId, src.priorities.map((p: Row) => p.id));
      return id;
    });
    res.status(201).json(loadPractice(id, teamId));
  });

  // ---------- Games ----------
  function gameFields(body: any, required: boolean) {
    return defined({
      played_at: isoDate(body.played_at, 'Date', { required }) ?? undefined,
      opponent: str(body.opponent, 'Opponent', { required, max: 80 }),
      venue: oneOf(body.venue, 'Venue', ['home', 'away', 'neutral'] as const),
      game_type: oneOf(body.game_type, 'Game type', ['league', 'exhibition', 'tournament', 'playoff'] as const),
      location: str(body.location, 'Location', { max: 120 }),
      goals_for: int(body.goals_for, 'Goals for', { min: 0, max: 50 }),
      goals_against: int(body.goals_against, 'Goals against', { min: 0, max: 50 }),
      shots_for: int(body.shots_for, 'Shots for', { min: 0, max: 150 }),
      shots_against: int(body.shots_against, 'Shots against', { min: 0, max: 150 }),
      overtime: body.overtime === undefined ? undefined : body.overtime ? 1 : 0,
      summary: str(body.summary, 'Summary', { max: 4000 }),
    });
  }

  r.get('/games', (req, res) => {
    const rows = d.all(
      `SELECT g.*,
        (SELECT COUNT(*) FROM observations o WHERE o.game_id = g.id AND o.kind = 'issue') AS issue_count,
        (SELECT COUNT(*) FROM observations o WHERE o.game_id = g.id AND o.kind = 'positive') AS positive_count
       FROM games g WHERE team_id = ? ORDER BY played_at DESC`,
      tid(req),
    );
    res.json(rows.map((g) => ({ ...g, result: gameResult(g) })));
  });

  r.post('/games', (req, res) => {
    const f = gameFields(req.body, true);
    if ((f.goals_for == null) !== (f.goals_against == null)) throw bad('Enter both scores, or leave both blank for a scheduled game');
    const id = d.insert('games', { team_id: tid(req), ...f });
    res.status(201).json(d.get('SELECT * FROM games WHERE id = ?', id));
  });

  const getGame = (req: Request, param = 'id') => {
    const g = d.get('SELECT * FROM games WHERE id = ? AND team_id = ?', req.params[param], tid(req));
    if (!g) throw notFound('Game');
    return g;
  };

  function observationsFor(where: string, ...params: (string | number)[]) {
    const rows = d.all(
      `SELECT o.*, pr.title AS priority_title FROM observations o LEFT JOIN priorities pr ON pr.id = o.priority_id WHERE ${where} ORDER BY o.id`,
      ...params,
    );
    const players = rows.length
      ? d.all(
          `SELECT op.observation_id, p.id, p.first_name, p.last_name, p.number FROM observation_players op JOIN players p ON p.id = op.player_id
           WHERE op.observation_id IN (${rows.map(() => '?').join(',')})`,
          ...rows.map((o) => o.id),
        )
      : [];
    return rows.map((o) => ({ ...o, players: players.filter((p) => p.observation_id === o.id).map(({ observation_id: _x, ...p }) => p) }));
  }

  r.get('/games/:id', (req, res) => {
    const g = getGame(req);
    res.json({ ...g, result: gameResult(g), observations: observationsFor('o.game_id = ?', g.id) });
  });

  r.patch('/games/:id', (req, res) => {
    const g = getGame(req);
    const f = gameFields(req.body, false);
    const gf = f.goals_for !== undefined ? f.goals_for : g.goals_for;
    const ga = f.goals_against !== undefined ? f.goals_against : g.goals_against;
    if ((gf == null) !== (ga == null)) throw bad('Enter both scores, or leave both blank for a scheduled game');
    d.update('games', g.id, f);
    res.json(d.get('SELECT * FROM games WHERE id = ?', g.id));
  });

  r.delete('/games/:id', (req, res) => {
    const g = getGame(req);
    d.run('DELETE FROM games WHERE id = ?', g.id);
    res.json({ ok: true });
  });

  // ---------- Observations ----------
  function obsFields(body: any, required: boolean) {
    return defined({
      focus_area: oneOf(body.focus_area, 'Category', FOCUS_AREAS, { required }),
      kind: oneOf(body.kind, 'Type', ['issue', 'positive'] as const, { required }),
      severity: int(body.severity, 'Severity', { min: 1, max: 3 }) ?? undefined,
      period: str(body.period, 'Period', { max: 10 }),
      game_time: str(body.game_time, 'Game time', { max: 10 }),
      description: str(body.description, 'Observation', { required, max: 2000 }),
      priority_id: int(body.priority_id, 'Priority'),
    });
  }
  function writeObsPlayers(obsId: number, teamId: number, ids: unknown) {
    if (!Array.isArray(ids)) throw bad('player_ids must be a list');
    d.run('DELETE FROM observation_players WHERE observation_id = ?', obsId);
    for (const pid of ids) {
      if (!d.get('SELECT id FROM players WHERE id = ? AND team_id = ?', pid, teamId)) throw bad('Unknown player');
      d.run('INSERT OR IGNORE INTO observation_players VALUES (?, ?)', obsId, pid);
    }
  }
  const checkPriority = (teamId: number, pid: unknown) => {
    if (pid && !d.get('SELECT id FROM priorities WHERE id = ? AND team_id = ?', pid, teamId)) throw bad('Unknown priority');
  };

  r.post('/games/:gameId/observations', (req, res) => {
    const g = getGame(req, 'gameId');
    const teamId = tid(req);
    const f = obsFields(req.body, true);
    checkPriority(teamId, f.priority_id);
    const id = d.tx(() => {
      const id = d.insert('observations', { team_id: teamId, game_id: g.id, ...f });
      if (req.body.player_ids) writeObsPlayers(id, teamId, req.body.player_ids);
      return id;
    });
    res.status(201).json(observationsFor('o.id = ?', id)[0]);
  });

  r.patch('/observations/:id', (req, res) => {
    const teamId = tid(req);
    const o = d.get('SELECT * FROM observations WHERE id = ? AND team_id = ?', req.params.id, teamId);
    if (!o) throw notFound('Observation');
    const f = obsFields(req.body, false);
    checkPriority(teamId, f.priority_id);
    d.tx(() => {
      d.update('observations', o.id, f);
      if (req.body.player_ids !== undefined) writeObsPlayers(o.id, teamId, req.body.player_ids);
    });
    res.json(observationsFor('o.id = ?', o.id)[0]);
  });

  r.delete('/observations/:id', (req, res) => {
    d.run('DELETE FROM observations WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  /** All observations, filterable — used for the cross-game issue tracker. */
  r.get('/observations', (req, res) => {
    const teamId = tid(req);
    const parts = ['o.team_id = ?'];
    const params: (string | number)[] = [teamId];
    if (req.query.focus_area) (parts.push('o.focus_area = ?'), params.push(String(req.query.focus_area)));
    if (req.query.kind) (parts.push('o.kind = ?'), params.push(String(req.query.kind)));
    const rows = observationsFor(parts.join(' AND '), ...params);
    const games = new Map(d.all('SELECT id, opponent, played_at FROM games WHERE team_id = ?', teamId).map((g) => [g.id, g]));
    res.json(rows.map((o) => ({ ...o, game: games.get(o.game_id) })).reverse());
  });

  // ---------- Development priorities ----------
  function priorityFields(body: any, required: boolean) {
    return defined({
      title: str(body.title, 'Title', { required, max: 160 }),
      focus_area: oneOf(body.focus_area, 'Focus area', FOCUS_AREAS, { required }),
      description: str(body.description, 'Description', { max: 4000 }),
      status: oneOf(body.status, 'Status', PRIORITY_STATUSES),
      player_id: int(body.player_id, 'Player'),
    });
  }

  r.get('/insights/recurring', (req, res) => {
    res.json(recurringIssues(db, tid(req)));
  });

  r.get('/priorities', (req, res) => {
    const teamId = tid(req);
    const rows = d.all(
      `SELECT pr.*, p.first_name, p.last_name, p.number,
        (SELECT COUNT(*) FROM observations o WHERE o.priority_id = pr.id) AS observation_count,
        (SELECT COUNT(*) FROM practice_priorities pp WHERE pp.priority_id = pr.id) AS practice_count
       FROM priorities pr LEFT JOIN players p ON p.id = pr.player_id WHERE pr.team_id = ?
       ORDER BY CASE pr.status WHEN 'active' THEN 0 WHEN 'monitoring' THEN 1 ELSE 2 END, pr.created_at DESC`,
      teamId,
    );
    res.json(rows.map((p) => ({ ...p, ...trendSignal(focusTrend(db, teamId, p.focus_area, p.player_id), p.created_at) })));
  });

  r.post('/priorities', (req, res) => {
    const teamId = tid(req);
    const f = priorityFields(req.body, true);
    if (f.player_id && !d.get('SELECT id FROM players WHERE id = ? AND team_id = ?', f.player_id, teamId)) throw bad('Unknown player');
    const id = d.tx(() => {
      const id = d.insert('priorities', { team_id: teamId, ...f });
      // Link the observations that triggered this priority.
      for (const oid of Array.isArray(req.body.observation_ids) ? req.body.observation_ids : []) {
        d.run('UPDATE observations SET priority_id = ? WHERE id = ? AND team_id = ?', id, oid, teamId);
      }
      if (req.body.link_focus_area_issues) {
        d.run("UPDATE observations SET priority_id = ? WHERE team_id = ? AND focus_area = ? AND kind = 'issue' AND priority_id IS NULL", id, teamId, f.focus_area!);
      }
      return id;
    });
    res.status(201).json(d.get('SELECT * FROM priorities WHERE id = ?', id));
  });

  r.get('/priorities/:id', (req, res) => {
    const teamId = tid(req);
    const p = d.get(
      'SELECT pr.*, pl.first_name, pl.last_name, pl.number FROM priorities pr LEFT JOIN players pl ON pl.id = pr.player_id WHERE pr.id = ? AND pr.team_id = ?',
      req.params.id,
      teamId,
    );
    if (!p) throw notFound('Priority');
    const trend = focusTrend(db, teamId, p.focus_area, p.player_id);
    const linked = observationsFor('o.priority_id = ?', p.id);
    const games = new Map(d.all('SELECT id, opponent, played_at FROM games WHERE team_id = ?', teamId).map((g) => [g.id, g]));
    const practices = d.all(
      `SELECT pc.id, pc.title, pc.scheduled_at, pc.status FROM practices pc JOIN practice_priorities pp ON pp.practice_id = pc.id
       WHERE pp.priority_id = ? ORDER BY pc.scheduled_at DESC`,
      p.id,
    );
    const goals = d.all(
      'SELECT g.*, pl.first_name, pl.last_name FROM player_goals g JOIN players pl ON pl.id = g.player_id WHERE g.priority_id = ?',
      p.id,
    );
    const usedDrillIds = d
      .all('SELECT DISTINCT s.drill_id FROM practice_segments s JOIN practice_priorities pp ON pp.practice_id = s.practice_id WHERE pp.priority_id = ? AND s.drill_id IS NOT NULL', p.id)
      .map((x) => x.drill_id);
    const recommendations = recommendDrills(db, teamId, { focusAreas: [p.focus_area], division: ctx(req).team.division, limit: 6 }).map((rec) => ({
      ...rec,
      alreadyUsed: usedDrillIds.includes(rec.drill.id),
    }));
    const nextPractice = d.get(
      "SELECT id, title, scheduled_at FROM practices WHERE team_id = ? AND is_template = 0 AND status != 'completed' AND scheduled_at >= ? ORDER BY scheduled_at LIMIT 1",
      teamId,
      new Date().toISOString().slice(0, 10),
    );
    res.json({
      ...p,
      trend,
      ...trendSignal(trend, p.created_at),
      observations: linked.map((o) => ({ ...o, game: games.get(o.game_id) })),
      practices,
      goals,
      recommendations,
      nextPractice: nextPractice ?? null,
    });
  });

  r.patch('/priorities/:id', (req, res) => {
    const p = d.get('SELECT * FROM priorities WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!p) throw notFound('Priority');
    const f: Record<string, unknown> = priorityFields(req.body, false);
    if (f.status === 'resolved' && p.status !== 'resolved') f.resolved_at = new Date().toISOString();
    if (f.status && f.status !== 'resolved') f.resolved_at = null;
    d.update('priorities', p.id, f);
    res.json(d.get('SELECT * FROM priorities WHERE id = ?', p.id));
  });

  r.delete('/priorities/:id', (req, res) => {
    d.run('DELETE FROM priorities WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  /**
   * Step 5 of the connected workflow: push recommended drills into a practice
   * (an existing one, or a new draft) and link the priority to it.
   */
  r.post('/priorities/:id/add-to-practice', (req, res) => {
    const teamId = tid(req);
    const p = d.get('SELECT * FROM priorities WHERE id = ? AND team_id = ?', req.params.id, teamId);
    if (!p) throw notFound('Priority');
    const drillIds: number[] = Array.isArray(req.body.drill_ids) ? req.body.drill_ids.map(Number) : [];
    if (!drillIds.length) throw bad('Choose at least one drill');
    const drills = drillIds.map((id) => {
      const dr = d.get('SELECT id, name, duration FROM drills WHERE id = ? AND (team_id IS NULL OR team_id = ?)', id, teamId);
      if (!dr) throw bad('Unknown drill');
      return dr;
    });
    const practiceId = d.tx(() => {
      let practiceId = int(req.body.practice_id, 'Practice');
      if (!practiceId) {
        practiceId = d.insert('practices', {
          team_id: teamId,
          title: `Practice — ${p.title}`,
          scheduled_at: isoDate(req.body.scheduled_at, 'Date') ?? null,
          duration: 60,
          objectives: `Address development priority: ${p.title}`,
          status: 'draft',
        });
      } else if (!d.get('SELECT id FROM practices WHERE id = ? AND team_id = ?', practiceId, teamId)) {
        throw bad('Unknown practice');
      }
      let pos = Number(d.get('SELECT COALESCE(MAX(position), -1) AS m FROM practice_segments WHERE practice_id = ?', practiceId)!.m) + 1;
      for (const dr of drills) {
        d.insert('practice_segments', { practice_id: practiceId, position: pos++, drill_id: dr.id, title: dr.name, duration: dr.duration, notes: `Priority: ${p.title}` });
      }
      d.run('INSERT OR IGNORE INTO practice_priorities VALUES (?, ?)', practiceId, p.id);
      return practiceId;
    });
    res.status(201).json({ practice_id: practiceId });
  });

  return r;
}
