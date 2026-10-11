import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { openDb } from './db.ts';
import { createApp } from './app.ts';
import { ensureSeeded } from './seed.ts';
import { trendSignal } from './insights.ts';
import { extractPracticeDraft } from './routes/ai.ts';
import { validateDiagram } from './routes/tactics.ts';

const db = openDb(':memory:');
ensureSeeded(db);
let server: Server;
let base = '';

before(async () => {
  server = createApp(db).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

/** Tiny cookie-keeping client. */
function client() {
  let cookie = '';
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return {
    get: (p: string) => call('GET', p),
    post: (p: string, b: unknown = {}) => call('POST', p, b),
    patch: (p: string, b: unknown) => call('PATCH', p, b),
    del: (p: string) => call('DELETE', p),
  };
}

test('auth: signup, me, logout, wrong password', async () => {
  const c = client();
  assert.equal((await c.get('/auth/me')).status, 401);
  const s = await c.post('/auth/signup', { name: 'Test Coach', email: 'test@example.com', password: 'password123' });
  assert.equal(s.status, 201);
  assert.equal((await c.get('/auth/me')).body.email, 'test@example.com');
  assert.equal((await c.post('/auth/signup', { name: 'X', email: 'test@example.com', password: 'password123' })).status, 400);
  await c.post('/auth/logout');
  assert.equal((await c.get('/auth/me')).status, 401);
  assert.equal((await c.post('/auth/login', { email: 'test@example.com', password: 'nope-nope' })).status, 401);
  assert.equal((await c.post('/auth/login', { email: 'TEST@example.com', password: 'password123' })).status, 200);
});

test('teams are private to their staff', async () => {
  const a = client();
  await a.post('/auth/signup', { name: 'A', email: 'a@example.com', password: 'password123' });
  const team = (await a.post('/teams', { name: 'A Team', division: 'U13', level: 'A', season: '2026–27' })).body;
  const b = client();
  await b.post('/auth/signup', { name: 'B', email: 'b@example.com', password: 'password123' });
  assert.equal((await b.get(`/teams/${team.id}/players`)).status, 404);
  assert.equal((await b.get('/teams')).body.length, 0);
});

test('permissions: invited viewer can read but not write', async () => {
  const admin = client();
  await admin.post('/auth/signup', { name: 'Admin', email: 'admin@example.com', password: 'password123' });
  const team = (await admin.post('/teams', { name: 'Perm Team', division: 'U15', level: 'AA', season: '2026–27' })).body;
  assert.equal((await admin.post(`/teams/${team.id}/staff`, { email: 'viewer@example.com', title: 'Manager', permission: 'view' })).status, 201);
  // Invite is accepted when the viewer signs up with that email.
  const viewer = client();
  await viewer.post('/auth/signup', { name: 'Viewer', email: 'viewer@example.com', password: 'password123' });
  assert.equal((await viewer.get(`/teams/${team.id}/players`)).status, 200);
  assert.equal((await viewer.post(`/teams/${team.id}/players`, { first_name: 'X', last_name: 'Y', position: 'C' })).status, 403);
  // Admin cannot demote themselves when they are the only admin.
  const staff = (await admin.get(`/teams/${team.id}/staff`)).body;
  const me = staff.find((s: { email: string }) => s.email === 'admin@example.com');
  assert.equal((await admin.patch(`/teams/${team.id}/staff/${me.id}`, { permission: 'edit' })).status, 400);
});

test('connected workflow: observation → priority → drills → practice → trend', async () => {
  const c = client();
  await c.post('/auth/signup', { name: 'Flow', email: 'flow@example.com', password: 'password123' });
  const team = (await c.post('/teams', { name: 'Flow Team', division: 'U15', level: 'A', season: '2026–27' })).body;
  const t = `/teams/${team.id}`;
  const player = (await c.post(`${t}/players`, { first_name: 'Sam', last_name: 'Lee', number: 9, position: 'LW' })).body;

  const games = [];
  for (const [i, gf] of [3, 1, 2].entries()) {
    games.push((await c.post(`${t}/games`, { played_at: `2026-09-0${i + 1}T19:00`, opponent: `Opp ${i}`, goals_for: gf, goals_against: 2 })).body);
  }
  // Breakout issues in games 1 and 2 -> recurring
  const o1 = (await c.post(`${t}/games/${games[0].id}/observations`, { focus_area: 'breakout', kind: 'issue', description: 'Winger left early', player_ids: [player.id] })).body;
  await c.post(`${t}/games/${games[1].id}/observations`, { focus_area: 'breakout', kind: 'issue', description: 'No outlet for D' });
  await c.post(`${t}/games/${games[2].id}/observations`, { focus_area: 'breakout', kind: 'positive', description: 'Clean exits' });
  assert.equal(o1.players[0].id, player.id);

  const recurring = (await c.get(`${t}/insights/recurring`)).body;
  assert.equal(recurring[0].focusArea, 'breakout');
  assert.equal(recurring[0].priority, null);

  const pr = (await c.post(`${t}/priorities`, { title: 'Breakout support', focus_area: 'breakout', link_focus_area_issues: true })).body;
  const detail = (await c.get(`${t}/priorities/${pr.id}`)).body;
  assert.equal(detail.observations.length, 2, 'unassigned breakout issues are linked');
  assert.equal(detail.trend.length, 3);
  assert.ok(detail.recommendations.length > 0, 'drills are recommended');
  assert.ok(detail.recommendations.every((r: { drill: { focus_areas: string[] } }) => r.drill.focus_areas.includes('breakout')));

  const drillIds = detail.recommendations.slice(0, 2).map((r: { drill: { id: number } }) => r.drill.id);
  const added = (await c.post(`${t}/priorities/${pr.id}/add-to-practice`, { drill_ids: drillIds })).body;
  const practice = (await c.get(`${t}/practices/${added.practice_id}`)).body;
  assert.equal(practice.segments.length, 2);
  assert.equal(practice.priorities[0].id, pr.id);
  assert.equal((await c.get(`${t}/insights/recurring`)).body[0].priority.id, pr.id);

  // Reorder & resize segments, then duplicate as a template.
  const reordered = (await c.patch(`${t}/practices/${practice.id}`, { segments: [...practice.segments].reverse().map((s: { drill_id: number }) => ({ drill_id: s.drill_id, duration: 7 })) })).body;
  assert.equal(reordered.segments[0].drill_id, practice.segments[1].drill_id);
  const tpl = (await c.post(`${t}/practices/${practice.id}/duplicate`, { as_template: true })).body;
  assert.equal(tpl.is_template, 1);
  assert.equal(tpl.segments.length, 2);
});

test('evaluations validate against team categories', async () => {
  const c = client();
  await c.post('/auth/signup', { name: 'Ev', email: 'ev@example.com', password: 'password123' });
  const team = (await c.post('/teams', { name: 'Ev Team', division: 'U11', level: 'B', season: '2026–27' })).body;
  const t = `/teams/${team.id}`;
  const p = (await c.post(`${t}/players`, { first_name: 'Jo', last_name: 'Kim', position: 'D' })).body;
  assert.equal((await c.post(`${t}/players/${p.id}/evaluations`, { evaluated_on: '2026-10-01', ratings: { skating: 7 } })).status, 400);
  assert.equal((await c.post(`${t}/players/${p.id}/evaluations`, { evaluated_on: '2026-10-01', ratings: { skating: 2, shooting: 4, 'hockey-iq': 3 } })).status, 201);
  const profile = (await c.get(`${t}/players/${p.id}`)).body;
  assert.equal(profile.summary.weaknesses[0].key, 'skating');
  assert.ok(profile.recommendations.some((r: { drill: { skills: string[] } }) => r.drill.skills.includes('skating')));
});

test('trendSignal compares before vs since', () => {
  const pts = [3, 2, 3, 0, 1, 0].map((issues, i) => ({ gameId: i, date: `2026-09-0${i + 1}`, opponent: 'X', issues, positives: 0 }));
  assert.equal(trendSignal(pts, '2026-09-04').signal, 'improving');
  assert.equal(trendSignal(pts.slice(0, 2)).signal, 'not-enough-data');
});

test('AI practice draft parsing drops unknown drills and priorities', () => {
  const text = 'Here is a plan.\n```benchiq-practice\n{"title":"Breakouts","duration":60,"objectives":"x","segments":[{"drill_id":1,"title":"Warm-up","duration":10,"notes":"","coaching_points":["Knees bent"]},{"drill_id":999999,"title":"Fake","duration":50,"notes":"n"}],"priority_ids":[424242]}\n```';
  const { reply, draft } = extractPracticeDraft(db, 1, text);
  assert.equal(reply, 'Here is a plan.');
  assert.equal(draft!.segments[0].drill_id, 1);
  assert.match(draft!.segments[0].notes, /Knees bent/);
  assert.equal(draft!.segments[1].drill_id, null);
  assert.deepEqual(draft!.priority_ids, []);
  assert.equal(extractPracticeDraft(db, 1, 'no plan here').draft, null);
});

test('diagram validation', () => {
  assert.throws(() => validateDiagram({ view: 'full', items: [{ kind: 'bomb', x: 1, y: 1 }], paths: [] }));
  assert.throws(() => validateDiagram({ view: 'full', items: [], paths: [{ kind: 'pass', points: [[1, 1]] }] }));
  const d = validateDiagram({ view: 'nope', items: [{ id: 'a', kind: 'F', x: 10.123, y: 5, label: 'LW' }], paths: [] });
  assert.equal(d.view, 'full');
  assert.equal(d.items[0].x, 10.1);
});

test('video: Drive / YouTube link parsing', async () => {
  const { parseDriveId, parseYouTubeId } = await import('./video.ts');
  assert.equal(parseDriveId('https://drive.google.com/file/d/1UDFEGKPgdHdQGeEd9UMftCpZzRIQgR5h/view?usp=sharing'), '1UDFEGKPgdHdQGeEd9UMftCpZzRIQgR5h');
  assert.equal(parseDriveId('https://drive.google.com/open?id=1UDFEGKPgdHdQGeEd9UMftCpZzRIQgR5h'), '1UDFEGKPgdHdQGeEd9UMftCpZzRIQgR5h');
  assert.equal(parseDriveId('https://evil.example.com/file/d/1UDFEGKPgdHdQGeEd9UMftCpZzRIQgR5h'), null);
  assert.equal(parseYouTubeId('https://www.youtube.com/watch?v=jNQXAC9IVRw&t=10'), 'jNQXAC9IVRw');
  assert.equal(parseYouTubeId('https://youtu.be/jNQXAC9IVRw'), 'jNQXAC9IVRw');
  assert.equal(parseYouTubeId('https://youtube.com/shorts/jNQXAC9IVRw'), 'jNQXAC9IVRw');
  assert.equal(parseYouTubeId('https://vimeo.com/123'), null);
});

test('video: model output is validated and sorted', async () => {
  const { parseAnalysis, toSeconds } = await import('./video.ts');
  assert.equal(toSeconds('1:02:03'), 3723);
  assert.equal(toSeconds('12:40'), 760);
  const out = parseAnalysis(
    JSON.stringify({
      summary: 'ok',
      moments: [
        { time: '10:00', focus_area: 'breakout', kind: 'issue', severity: 9, description: 'Winger left early', jersey_numbers: ['#11'], confidence: 'high' },
        { time: '02:00', focus_area: 'forecheck', kind: 'positive', description: 'F1 angled well', confidence: 'weird' },
        { time: '03:00', focus_area: 'not-a-category', kind: 'issue', description: 'dropped' },
      ],
    }),
  );
  assert.equal(out.moments.length, 2);
  assert.equal(out.moments[0].seconds, 120);
  assert.equal(out.moments[0].confidence, 'medium');
  assert.equal(out.moments[1].severity, 3);
  assert.deepEqual(out.moments[1].jersey_numbers, ['11']);
});

test('video: accepting a suggestion creates an observation; dismissing does not', async () => {
  const c = client();
  await c.post('/auth/signup', { name: 'Vid', email: 'vid@example.com', password: 'password123' });
  const team = (await c.post('/teams', { name: 'Vid Team', division: 'U15', level: 'A', season: '2026–27' })).body;
  const t = `/teams/${team.id}`;
  const player = (await c.post(`${t}/players`, { first_name: 'Owen', last_name: 'F', number: 11, position: 'LW' })).body;
  const game = (await c.post(`${t}/games`, { played_at: '2026-10-03T19:00', opponent: 'Rivals', goals_for: 2, goals_against: 1 })).body;
  // Without a Gemini key, starting an analysis is refused with a clear message.
  delete process.env.GEMINI_API_KEY;
  const refused = await c.post(`${t}/games/${game.id}/video/analyze`, { url: 'https://youtu.be/jNQXAC9IVRw' });
  assert.equal(refused.status, 503);
  // Simulate a finished analysis.
  const { q: query } = await import('./db.ts');
  const id = query(db).insert('video_analyses', {
    team_id: team.id,
    game_id: game.id,
    source: 'youtube',
    source_url: 'https://youtu.be/jNQXAC9IVRw',
    status: 'done',
    suggestions: [
      { time: '1:00', seconds: 60, focus_area: 'breakout', kind: 'issue', severity: 2, description: 'Left early', jersey_numbers: ['11'], confidence: 'high', status: 'pending' },
      { time: '2:00', seconds: 120, focus_area: 'forecheck', kind: 'positive', severity: 2, description: 'Good angle', jersey_numbers: [], confidence: 'low', status: 'pending' },
    ],
  });
  const kept = (await c.post(`${t}/video-analyses/${id}/suggestions/0`, { action: 'accept' })).body;
  assert.equal(kept.suggestions[0].status, 'accepted');
  await c.post(`${t}/video-analyses/${id}/suggestions/1`, { action: 'dismiss' });
  assert.equal((await c.post(`${t}/video-analyses/${id}/suggestions/0`, { action: 'accept' })).status, 400, 'cannot accept twice');
  const g = (await c.get(`${t}/games/${game.id}`)).body;
  assert.equal(g.observations.length, 1);
  assert.equal(g.observations[0].video_ref, 'youtube@60');
  assert.equal(g.observations[0].players[0].id, player.id, 'jersey #11 mapped to the roster');
});
