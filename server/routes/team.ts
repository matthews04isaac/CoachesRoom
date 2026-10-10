import { Router, type Request } from 'express';
import { parseJson, q, type DB, type Row } from '../db.ts';
import { requirePermission, type AuthedRequest } from '../auth.ts';
import { bad, defined, int, isoDate, notFound, oneOf, str } from '../validate.ts';
import { DEFAULT_EVAL_CATEGORIES, EVENT_TYPES, PERMISSIONS, POSITIONS, type EvalCategory } from '../../shared/domain.ts';
import { focusTrend, gameResult, playerEvalSummary, recommendDrills, recurringIssues, teamRecord, trendSignal } from '../insights.ts';
import { createDemoTeam } from '../seed.ts';

const ctx = (req: Request) => req as AuthedRequest;
export const teamCategories = (team: Row): EvalCategory[] => {
  try {
    return JSON.parse(team.eval_categories);
  } catch {
    return DEFAULT_EVAL_CATEGORIES;
  }
};

function teamFields(body: any, required: boolean) {
  return defined({
    name: str(body.name, 'Team name', { required, max: 80 }),
    short_name: str(body.short_name, 'Short name', { max: 6 })?.toUpperCase() || undefined,
    color: str(body.color, 'Colour', { max: 20 }),
    logo_url: str(body.logo_url, 'Logo URL', { max: 500 }),
    division: str(body.division, 'Age division', { required, max: 30 }),
    level: str(body.level, 'Level', { required, max: 30 }),
    season: str(body.season, 'Season', { required, max: 30 }),
  });
}

/** Routes that are not scoped to one team: list / create. */
export function teamsRoutes(db: DB) {
  const r = Router();
  const d = q(db);

  r.get('/', (req, res) => {
    const teams = d.all(
      `SELECT t.*, s.permission, s.title AS my_title,
        (SELECT COUNT(*) FROM players p WHERE p.team_id = t.id AND p.status != 'inactive') AS player_count
       FROM teams t JOIN staff s ON s.team_id = t.id AND s.user_id = ? ORDER BY t.created_at`,
      ctx(req).user.id,
    );
    res.json(teams.map((t) => ({ ...parseJson(t, 'eval_categories'), record: teamRecord(db, t.id) })));
  });

  r.post('/', (req, res) => {
    const f = teamFields(req.body, true);
    const user = ctx(req).user;
    const id = d.tx(() => {
      const short = f.short_name || f.name!.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase();
      const id = d.insert('teams', { ...f, short_name: short, eval_categories: DEFAULT_EVAL_CATEGORIES });
      d.insert('staff', { team_id: id, user_id: user.id, name: user.name, email: user.email, title: str(req.body.my_title, 'Title') || 'Head Coach', permission: 'admin' });
      return id;
    });
    res.status(201).json(d.get('SELECT * FROM teams WHERE id = ?', id));
  });

  /** Give the signed-in coach their own copy of the demo team to explore. */
  r.post('/demo', (req, res) => {
    const user = ctx(req).user;
    const id = createDemoTeam(db, { id: user.id, name: user.name, email: user.email });
    res.status(201).json(d.get('SELECT * FROM teams WHERE id = ?', id));
  });

  return r;
}

/** Team-scoped routes mounted at /api/teams/:teamId. */
export function teamRoutes(db: DB) {
  const r = Router({ mergeParams: true });
  const d = q(db);
  const tid = (req: Request) => Number(req.params.teamId);

  // ---------- Team ----------
  r.get('/', (req, res) => {
    res.json({ ...parseJson(ctx(req).team, 'eval_categories'), record: teamRecord(db, tid(req)) });
  });

  r.patch('/', requirePermission('admin'), (req, res) => {
    const f: Record<string, unknown> = teamFields(req.body, false);
    if (req.body.eval_categories !== undefined) {
      const cats = req.body.eval_categories;
      if (!Array.isArray(cats) || !cats.length || cats.length > 15) throw bad('Provide between 1 and 15 evaluation categories');
      const clean = cats.map((c: any) => {
        const label = str(c?.label, 'Category label', { required: true, max: 40 })!;
        const key = (str(c?.key, 'Category key', { max: 40 }) || label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return { key, label };
      });
      if (new Set(clean.map((c) => c.key)).size !== clean.length) throw bad('Evaluation categories must be unique');
      f.eval_categories = clean;
    }
    d.update('teams', tid(req), f);
    res.json(parseJson(d.get('SELECT * FROM teams WHERE id = ?', tid(req)), 'eval_categories'));
  });

  r.delete('/', requirePermission('admin'), (req, res) => {
    d.run('DELETE FROM teams WHERE id = ?', tid(req));
    res.json({ ok: true });
  });

  // ---------- Dashboard ----------
  r.get('/dashboard', (req, res) => {
    const teamId = tid(req);
    const team = ctx(req).team;
    const now = new Date().toISOString();
    const upcomingPractices = d.all(
      `SELECT p.*, (SELECT COUNT(*) FROM practice_segments s WHERE s.practice_id = p.id) AS segment_count
       FROM practices p WHERE team_id = ? AND is_template = 0 AND scheduled_at >= ? ORDER BY scheduled_at LIMIT 4`,
      teamId,
      now.slice(0, 10),
    );
    const upcomingGames = d.all('SELECT * FROM games WHERE team_id = ? AND goals_for IS NULL AND played_at >= ? ORDER BY played_at LIMIT 3', teamId, now.slice(0, 10));
    const upcomingEvents = d.all('SELECT * FROM events WHERE team_id = ? AND starts_at >= ? ORDER BY starts_at LIMIT 3', teamId, now.slice(0, 10));
    const recentGames = d
      .all('SELECT * FROM games WHERE team_id = ? AND goals_for IS NOT NULL ORDER BY played_at DESC LIMIT 5', teamId)
      .map((g) => ({ ...g, result: gameResult(g) }));
    const recentEvaluations = d.all(
      `SELECT e.id, e.evaluated_on, e.label, e.ratings, p.id AS player_id, p.first_name, p.last_name, p.number, p.position
       FROM evaluations e JOIN players p ON p.id = e.player_id WHERE e.team_id = ? ORDER BY e.evaluated_on DESC, e.id DESC LIMIT 6`,
      teamId,
    ).map((e) => {
      const ratings = JSON.parse(e.ratings) as Record<string, number>;
      const vals = Object.values(ratings).filter((v) => typeof v === 'number');
      return { ...e, ratings: undefined, average: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null };
    });
    const priorities = d
      .all("SELECT * FROM priorities WHERE team_id = ? AND status != 'resolved' ORDER BY player_id IS NOT NULL, created_at DESC LIMIT 6", teamId)
      .map((p) => ({ ...p, ...trendSignal(focusTrend(db, teamId, p.focus_area, p.player_id), p.created_at) }));
    const counts = d.get(
      `SELECT (SELECT COUNT(*) FROM players WHERE team_id = ?1 AND status != 'inactive') AS players,
              (SELECT COUNT(*) FROM practices WHERE team_id = ?1 AND is_template = 0) AS practices,
              (SELECT COUNT(*) FROM evaluations WHERE team_id = ?1) AS evaluations,
              (SELECT COUNT(*) FROM observations WHERE team_id = ?1) AS observations`,
      teamId,
    );
    // Team skill averages from each player's latest evaluation.
    const cats = teamCategories(team);
    const latest = d.all(
      `SELECT e.ratings FROM evaluations e WHERE e.team_id = ? AND e.id = (
         SELECT e2.id FROM evaluations e2 WHERE e2.player_id = e.player_id ORDER BY e2.evaluated_on DESC, e2.id DESC LIMIT 1)`,
      teamId,
    ).map((r) => JSON.parse(r.ratings) as Record<string, number>);
    const skillAverages = cats.map((c) => {
      const vals = latest.map((r) => r[c.key]).filter((v) => typeof v === 'number');
      return { key: c.key, label: c.label, value: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null };
    });
    res.json({
      record: teamRecord(db, teamId),
      counts,
      upcomingPractices,
      upcomingGames,
      upcomingEvents,
      recentGames,
      recentEvaluations,
      priorities,
      recurring: recurringIssues(db, teamId),
      skillAverages,
    });
  });

  // ---------- Staff ----------
  r.get('/staff', (req, res) => {
    res.json(d.all('SELECT id, user_id, name, email, title, permission, created_at FROM staff WHERE team_id = ? ORDER BY permission, name', tid(req)));
  });

  r.post('/staff', requirePermission('admin'), (req, res) => {
    const email = str(req.body.email, 'Email', { required: true, max: 200 })!.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Enter a valid email address');
    if (d.get('SELECT id FROM staff WHERE team_id = ? AND email = ?', tid(req), email)) throw bad('That person is already on this staff');
    const user = d.get('SELECT id, name FROM users WHERE email = ?', email);
    const id = d.insert('staff', {
      team_id: tid(req),
      user_id: user?.id ?? null,
      email,
      name: str(req.body.name, 'Name', { max: 80 }) || user?.name || email.split('@')[0],
      title: str(req.body.title, 'Title', { required: true, max: 60 }),
      permission: oneOf(req.body.permission, 'Permission', PERMISSIONS, { required: true }),
    });
    res.status(201).json(d.get('SELECT * FROM staff WHERE id = ?', id));
  });

  r.patch('/staff/:id', requirePermission('admin'), (req, res) => {
    const s = d.get('SELECT * FROM staff WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!s) throw notFound('Staff member');
    const permission = oneOf(req.body.permission, 'Permission', PERMISSIONS);
    if (permission && permission !== 'admin' && s.permission === 'admin') assertAnotherAdmin(tid(req), s.id);
    d.update('staff', s.id, defined({ title: str(req.body.title, 'Title', { max: 60 }), name: str(req.body.name, 'Name', { max: 80 }), permission }));
    res.json(d.get('SELECT * FROM staff WHERE id = ?', s.id));
  });

  r.delete('/staff/:id', requirePermission('admin'), (req, res) => {
    const s = d.get('SELECT * FROM staff WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!s) throw notFound('Staff member');
    if (s.permission === 'admin') assertAnotherAdmin(tid(req), s.id);
    d.run('DELETE FROM staff WHERE id = ?', s.id);
    res.json({ ok: true });
  });

  function assertAnotherAdmin(teamId: number, exceptId: number) {
    const n = d.get("SELECT COUNT(*) AS n FROM staff WHERE team_id = ? AND permission = 'admin' AND id != ? AND user_id IS NOT NULL", teamId, exceptId)!.n;
    if (!n) throw bad('A team needs at least one admin with an account');
  }

  // ---------- Players ----------
  function playerFields(body: any, required: boolean) {
    return defined({
      first_name: str(body.first_name, 'First name', { required, max: 60 }),
      last_name: str(body.last_name, 'Last name', { required, max: 60 }),
      number: int(body.number, 'Jersey number', { min: 0, max: 99 }),
      position: oneOf(body.position, 'Position', POSITIONS, { required }),
      shoots: oneOf(body.shoots, 'Shoots', ['L', 'R'] as const),
      birth_year: int(body.birth_year, 'Birth year', { min: 1950, max: 2030 }),
      photo_url: str(body.photo_url, 'Photo URL', { max: 500 }),
      status: oneOf(body.status, 'Status', ['active', 'injured', 'inactive'] as const),
      notes: str(body.notes, 'Notes', { max: 4000 }),
    });
  }

  r.get('/players', (req, res) => {
    const cats = teamCategories(ctx(req).team);
    const players = d.all('SELECT * FROM players WHERE team_id = ? ORDER BY position = \'G\', number', tid(req));
    res.json(
      players.map((p) => {
        const s = playerEvalSummary(db, p.id, cats);
        const goals = d.get("SELECT COUNT(*) AS n FROM player_goals WHERE player_id = ? AND status = 'active'", p.id)!.n;
        return { ...p, eval: s && { average: s.average, evaluatedOn: s.evaluatedOn, strengths: s.strengths, weaknesses: s.weaknesses }, active_goals: goals };
      }),
    );
  });

  r.post('/players', (req, res) => {
    const id = d.insert('players', { team_id: tid(req), ...playerFields(req.body, true) });
    res.status(201).json(d.get('SELECT * FROM players WHERE id = ?', id));
  });

  const getPlayer = (req: Request) => {
    const p = d.get('SELECT * FROM players WHERE id = ? AND team_id = ?', req.params.playerId, tid(req));
    if (!p) throw notFound('Player');
    return p;
  };

  r.get('/players/:playerId', (req, res) => {
    const p = getPlayer(req);
    const team = ctx(req).team;
    const cats = teamCategories(team);
    const summary = playerEvalSummary(db, p.id, cats);
    const evaluations = d.all('SELECT * FROM evaluations WHERE player_id = ? ORDER BY evaluated_on DESC, id DESC', p.id).map((e) => parseJson(e, 'ratings'));
    const goals = d.all('SELECT * FROM player_goals WHERE player_id = ? ORDER BY status = \'achieved\', created_at DESC', p.id);
    const notes = d.all('SELECT * FROM player_notes WHERE player_id = ? ORDER BY created_at DESC', p.id);
    const observations = d.all(
      `SELECT o.*, g.opponent, g.played_at FROM observations o JOIN observation_players op ON op.observation_id = o.id
       JOIN games g ON g.id = o.game_id WHERE op.player_id = ? ORDER BY g.played_at DESC, o.id DESC LIMIT 30`,
      p.id,
    );
    const priorities = d.all('SELECT * FROM priorities WHERE player_id = ? ORDER BY status = \'resolved\', created_at DESC', p.id);
    const recommendations = summary
      ? recommendDrills(db, tid(req), {
          skills: summary.weaknesses.filter((w) => w.value <= 3).map((w) => w.key),
          focusAreas: priorities.filter((x) => x.status !== 'resolved').map((x) => x.focus_area),
          division: team.division,
          limit: 4,
        })
      : [];
    res.json({ ...p, summary, evaluations, goals, coach_notes: notes, observations, priorities, recommendations, categories: cats });
  });

  r.patch('/players/:playerId', (req, res) => {
    const p = getPlayer(req);
    d.update('players', p.id, playerFields(req.body, false));
    res.json(d.get('SELECT * FROM players WHERE id = ?', p.id));
  });

  r.delete('/players/:playerId', (req, res) => {
    const p = getPlayer(req);
    d.run('DELETE FROM players WHERE id = ?', p.id);
    res.json({ ok: true });
  });

  // ---------- Evaluations ----------
  function evalFields(req: Request, required: boolean) {
    const cats = teamCategories(ctx(req).team);
    let ratings: Record<string, number> | undefined;
    if (req.body.ratings !== undefined || required) {
      const raw = req.body.ratings ?? {};
      if (typeof raw !== 'object') throw bad('Ratings are required');
      ratings = {};
      for (const c of cats) {
        const v = raw[c.key];
        if (v === undefined || v === null || v === '') continue;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 5) throw bad(`${c.label} rating must be between 1 and 5`);
        ratings[c.key] = n;
      }
      if (!Object.keys(ratings).length) throw bad('Rate at least one category');
    }
    return defined({
      evaluated_on: isoDate(req.body.evaluated_on, 'Evaluation date', { required }) ?? undefined,
      label: str(req.body.label, 'Label', { max: 80 }),
      evaluator: str(req.body.evaluator, 'Evaluator', { max: 80 }),
      ratings,
      strengths: str(req.body.strengths, 'Strengths', { max: 4000 }),
      improvements: str(req.body.improvements, 'Areas for improvement', { max: 4000 }),
      notes: str(req.body.notes, 'Notes', { max: 4000 }),
    });
  }

  r.post('/players/:playerId/evaluations', (req, res) => {
    const p = getPlayer(req);
    const f = evalFields(req, true);
    const id = d.insert('evaluations', { team_id: tid(req), player_id: p.id, evaluator: ctx(req).user.name, ...f });
    res.status(201).json(parseJson(d.get('SELECT * FROM evaluations WHERE id = ?', id), 'ratings'));
  });

  r.patch('/evaluations/:id', (req, res) => {
    const e = d.get('SELECT * FROM evaluations WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!e) throw notFound('Evaluation');
    d.update('evaluations', e.id, evalFields(req, false));
    res.json(parseJson(d.get('SELECT * FROM evaluations WHERE id = ?', e.id), 'ratings'));
  });

  r.delete('/evaluations/:id', (req, res) => {
    d.run('DELETE FROM evaluations WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  // ---------- Goals & notes ----------
  function goalFields(body: any, required: boolean) {
    return defined({
      title: str(body.title, 'Goal', { required, max: 160 }),
      skill: str(body.skill, 'Skill', { max: 40 }),
      description: str(body.description, 'Description', { max: 2000 }),
      status: oneOf(body.status, 'Status', ['active', 'achieved', 'paused'] as const),
      progress: int(body.progress, 'Progress', { min: 0, max: 100 }),
      target_date: isoDate(body.target_date, 'Target date'),
      priority_id: int(body.priority_id, 'Priority'),
    });
  }

  r.post('/players/:playerId/goals', (req, res) => {
    const p = getPlayer(req);
    const id = d.insert('player_goals', { team_id: tid(req), player_id: p.id, ...goalFields(req.body, true) });
    res.status(201).json(d.get('SELECT * FROM player_goals WHERE id = ?', id));
  });

  r.patch('/goals/:id', (req, res) => {
    const g = d.get('SELECT * FROM player_goals WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!g) throw notFound('Goal');
    const f = goalFields(req.body, false);
    if (f.status === 'achieved' && f.progress === undefined) f.progress = 100;
    d.update('player_goals', g.id, f);
    res.json(d.get('SELECT * FROM player_goals WHERE id = ?', g.id));
  });

  r.delete('/goals/:id', (req, res) => {
    d.run('DELETE FROM player_goals WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  r.post('/players/:playerId/notes', (req, res) => {
    const p = getPlayer(req);
    const id = d.insert('player_notes', { team_id: tid(req), player_id: p.id, body: str(req.body.body, 'Note', { required: true, max: 4000 }), author: ctx(req).user.name });
    res.status(201).json(d.get('SELECT * FROM player_notes WHERE id = ?', id));
  });

  r.delete('/notes/:id', (req, res) => {
    d.run('DELETE FROM player_notes WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  // ---------- Events & calendar ----------
  function eventFields(body: any, required: boolean) {
    return defined({
      type: oneOf(body.type, 'Event type', EVENT_TYPES, { required }),
      title: str(body.title, 'Title', { required, max: 120 }),
      starts_at: isoDate(body.starts_at, 'Start', { required }) ?? undefined,
      ends_at: isoDate(body.ends_at, 'End'),
      location: str(body.location, 'Location', { max: 120 }),
      notes: str(body.notes, 'Notes', { max: 2000 }),
    });
  }
  r.post('/events', (req, res) => {
    const f = eventFields(req.body, true);
    if (f.type === 'practice' || f.type === 'game') throw bad('Create practices in the Practice Planner and games in Game Review — they appear on the calendar automatically');
    const id = d.insert('events', { team_id: tid(req), ...f });
    res.status(201).json(d.get('SELECT * FROM events WHERE id = ?', id));
  });
  r.patch('/events/:id', (req, res) => {
    const e = d.get('SELECT * FROM events WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    if (!e) throw notFound('Event');
    d.update('events', e.id, eventFields(req.body, false));
    res.json(d.get('SELECT * FROM events WHERE id = ?', e.id));
  });
  r.delete('/events/:id', (req, res) => {
    d.run('DELETE FROM events WHERE id = ? AND team_id = ?', req.params.id, tid(req));
    res.json({ ok: true });
  });

  /**
   * The calendar is a union of practices, games and other events, so there is a
   * single source of truth for each item (no duplicated "event" rows to sync).
   */
  r.get('/calendar', (req, res) => {
    const from = String(req.query.from ?? '0000');
    const to = String(req.query.to ?? '9999');
    const teamId = tid(req);
    const practices = d
      .all('SELECT id, title, scheduled_at, duration, location, status FROM practices WHERE team_id = ? AND is_template = 0 AND scheduled_at >= ? AND scheduled_at < ?', teamId, from, to)
      .map((p) => ({
        key: `practice-${p.id}`,
        type: 'practice',
        id: p.id,
        title: p.title,
        starts_at: p.scheduled_at,
        ends_at: new Date(Date.parse(p.scheduled_at) + p.duration * 60000).toISOString(),
        location: p.location,
        link: `/practices/${p.id}`,
      }));
    const games = d.all('SELECT * FROM games WHERE team_id = ? AND played_at >= ? AND played_at < ?', teamId, from, to).map((g) => ({
      key: `game-${g.id}`,
      type: g.game_type === 'tournament' ? 'tournament' : 'game',
      id: g.id,
      title: `${g.venue === 'away' ? '@' : 'vs'} ${g.opponent}`,
      starts_at: g.played_at,
      ends_at: null,
      location: g.location,
      result: gameResult(g),
      score: g.goals_for === null ? null : `${g.goals_for}–${g.goals_against}`,
      link: `/games/${g.id}`,
    }));
    const events = d.all('SELECT * FROM events WHERE team_id = ? AND starts_at >= ? AND starts_at < ?', teamId, from, to).map((e) => ({ ...e, key: `event-${e.id}`, link: null }));
    res.json(([...practices, ...games, ...events] as Row[]).sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
  });

  // ---------- Export ----------
  r.get('/export', (req, res) => {
    const teamId = tid(req);
    const tables = ['players', 'staff', 'events', 'practices', 'evaluations', 'player_goals', 'player_notes', 'games', 'observations', 'priorities', 'diagrams'];
    const out: Record<string, Row[]> = {};
    for (const t of tables) out[t] = d.all(`SELECT * FROM ${t} WHERE team_id = ?`, teamId);
    out.drills = d.all('SELECT * FROM drills WHERE team_id = ?', teamId);
    out.practice_segments = d.all('SELECT s.* FROM practice_segments s JOIN practices p ON p.id = s.practice_id WHERE p.team_id = ?', teamId);
    res.setHeader('Content-Disposition', `attachment; filename="benchiq-team-${teamId}.json"`);
    res.json({ exported_at: new Date().toISOString(), team: ctx(req).team, ...out });
  });

  return r;
}

