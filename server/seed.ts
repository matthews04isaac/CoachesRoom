import { q, type DB } from './db.ts';
import { hashPassword } from './auth.ts';
import { DEFAULT_EVAL_CATEGORIES, type Diagram } from '../shared/domain.ts';
import { LIBRARY_DRILLS, LIBRARY_RESOURCES, LIBRARY_SYSTEMS } from './seed-library.ts';

export const DEMO_EMAIL = 'coach@benchiq.app';
export const DEMO_PASSWORD = 'hockey123';

/** Local "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" strings relative to today, so demo data never goes stale. */
const pad = (n: number) => String(n).padStart(2, '0');
function day(offset: number, time?: string) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return time ? `${s}T${time}` : s;
}

export function ensureSeeded(db: DB) {
  const d = q(db);
  if (!d.get('SELECT id FROM drills WHERE team_id IS NULL LIMIT 1')) {
    d.tx(() => {
      for (const dr of LIBRARY_DRILLS) d.insert('drills', { team_id: null, ...dr });
      for (const s of LIBRARY_SYSTEMS) d.insert('systems', { team_id: null, ...s });
      for (const r of LIBRARY_RESOURCES) {
        d.insert('resources', { team_id: null, ...r, diagram: r.diagram ?? null, read_minutes: Math.max(2, Math.round(r.body.split(/\s+/).length / 180)) });
      }
    });
  }
  if (!d.get('SELECT id FROM users WHERE email = ?', DEMO_EMAIL)) {
    const userId = d.insert('users', { email: DEMO_EMAIL, name: 'Sam Whitaker', password_hash: hashPassword(DEMO_PASSWORD) });
    const user = { id: userId, name: 'Sam Whitaker', email: DEMO_EMAIL };
    createDemoTeam(db, user);
    createSecondTeam(db, user);
  }
}

type Rating = Record<string, number>;
const CATS = DEFAULT_EVAL_CATEGORIES.map((c) => c.key);
/** Ratings in category order: skating, puck, shooting, iq, positioning, compete, decisions. */
const r = (...v: number[]): Rating => Object.fromEntries(CATS.map((k, i) => [k, v[i]]));

const ROSTER: { first: string; last: string; no: number; pos: string; shoots: string; pre: number[]; now: number[]; status?: string }[] = [
  { first: 'Ethan', last: 'Caldwell', no: 9, pos: 'C', shoots: 'L', pre: [4, 4, 4, 4, 3, 4, 4], now: [4, 5, 4, 4, 4, 4, 4] },
  { first: 'Noah', last: 'Bergeron', no: 19, pos: 'C', shoots: 'R', pre: [3, 4, 3, 4, 3, 3, 4], now: [4, 4, 3, 4, 3, 4, 4] },
  { first: 'Liam', last: 'Ouellette', no: 14, pos: 'C', shoots: 'L', pre: [3, 3, 3, 3, 3, 4, 3], now: [3, 3, 4, 3, 3, 4, 3] },
  { first: 'Mason', last: 'Kowalski', no: 21, pos: 'C', shoots: 'L', pre: [3, 3, 2, 3, 3, 5, 3], now: [3, 3, 3, 3, 4, 5, 3] },
  { first: 'Owen', last: 'Fraser', no: 11, pos: 'LW', shoots: 'L', pre: [4, 4, 4, 2, 2, 3, 2], now: [4, 4, 4, 3, 2, 3, 2] },
  { first: 'Lucas', last: 'Tremblay', no: 17, pos: 'LW', shoots: 'L', pre: [3, 3, 4, 3, 3, 3, 3], now: [3, 4, 4, 3, 3, 3, 3] },
  { first: 'Carter', last: 'Nguyen', no: 24, pos: 'LW', shoots: 'R', pre: [4, 3, 3, 3, 2, 4, 3], now: [4, 3, 3, 3, 3, 4, 3] },
  { first: 'Jack', last: 'Sullivan', no: 12, pos: 'RW', shoots: 'R', pre: [3, 4, 5, 3, 3, 3, 3], now: [3, 4, 5, 3, 3, 3, 3] },
  { first: 'Ryan', last: 'Desjardins', no: 16, pos: 'RW', shoots: 'R', pre: [3, 3, 3, 3, 2, 3, 2], now: [3, 3, 3, 3, 2, 4, 3] },
  { first: 'Mateo', last: 'Rossi', no: 27, pos: 'RW', shoots: 'L', pre: [4, 3, 3, 2, 2, 4, 2], now: [4, 3, 3, 3, 3, 4, 3] },
  { first: 'Ben', last: 'Halvorsen', no: 8, pos: 'RW', shoots: 'R', pre: [2, 3, 3, 3, 3, 4, 3], now: [3, 3, 3, 3, 3, 4, 3], status: 'injured' },
  { first: 'Cole', last: 'Patterson', no: 2, pos: 'D', shoots: 'L', pre: [4, 3, 3, 4, 4, 4, 4], now: [4, 3, 3, 4, 4, 4, 4] },
  { first: 'Isaac', last: 'Lindqvist', no: 4, pos: 'D', shoots: 'R', pre: [3, 3, 4, 3, 3, 3, 3], now: [3, 3, 4, 4, 3, 3, 3] },
  { first: 'Evan', last: 'MacDonald', no: 5, pos: 'D', shoots: 'L', pre: [3, 2, 3, 3, 2, 4, 2], now: [3, 3, 3, 3, 3, 4, 3] },
  { first: 'Hudson', last: 'Clarke', no: 6, pos: 'D', shoots: 'L', pre: [4, 3, 3, 3, 3, 3, 3], now: [4, 3, 3, 3, 3, 3, 3] },
  { first: 'Nolan', last: 'Achebe', no: 7, pos: 'D', shoots: 'R', pre: [3, 3, 2, 3, 3, 4, 3], now: [3, 3, 3, 3, 4, 4, 3] },
  { first: 'Gabriel', last: 'Pelletier', no: 3, pos: 'D', shoots: 'L', pre: [2, 2, 2, 3, 3, 3, 3], now: [3, 2, 2, 3, 3, 4, 3] },
  { first: 'Zach', last: 'Morrison', no: 30, pos: 'G', shoots: 'L', pre: [4, 3, 1, 4, 4, 4, 4], now: [4, 3, 1, 4, 5, 4, 4] },
  { first: 'Felix', last: 'Bouchard', no: 31, pos: 'G', shoots: 'L', pre: [3, 2, 1, 3, 3, 4, 3], now: [3, 3, 1, 3, 3, 4, 3] },
];

/** Creates the full "Northside Hawks U15 AA" demo team for a user. Returns the team id. */
export function createDemoTeam(db: DB, user: { id: number; name: string; email: string }) {
  const d = q(db);
  return d.tx(() => {
    const teamId = d.insert('teams', {
      name: 'Northside Hawks U15 AA',
      short_name: 'NSH',
      color: '#e11d2e',
      division: 'U15',
      level: 'AA',
      season: '2026–27',
      eval_categories: DEFAULT_EVAL_CATEGORIES,
    });
    d.insert('staff', { team_id: teamId, user_id: user.id, name: user.name, email: user.email, title: 'Head Coach', permission: 'admin' });
    const tag = `t${teamId}`; // keep invite emails unique per demo copy
    d.insert('staff', { team_id: teamId, user_id: null, name: 'Dana Kowalczyk', email: `dana.${tag}@example.com`, title: 'Assistant Coach (Defence)', permission: 'edit' });
    d.insert('staff', { team_id: teamId, user_id: null, name: 'Marc Gagnon', email: `marc.${tag}@example.com`, title: 'Goalie Coach', permission: 'edit' });
    d.insert('staff', { team_id: teamId, user_id: null, name: 'Priya Shah', email: `priya.${tag}@example.com`, title: 'Team Manager', permission: 'view' });

    // Roster + evaluations
    const P: Record<string, number> = {};
    for (const p of ROSTER) {
      const id = d.insert('players', {
        team_id: teamId,
        first_name: p.first,
        last_name: p.last,
        number: p.no,
        position: p.pos,
        shoots: p.shoots,
        birth_year: p.no % 3 === 0 ? 2013 : 2012,
        status: p.status ?? 'active',
        notes: p.status === 'injured' ? 'Upper-body injury — cleared for non-contact skating only.' : '',
      });
      P[p.last] = id;
      d.insert('evaluations', {
        team_id: teamId,
        player_id: id,
        evaluated_on: day(-40),
        label: 'Preseason',
        evaluator: user.name,
        ratings: r(...p.pre),
        strengths: '',
        improvements: '',
        notes: 'Preseason skate and tryout observations.',
      });
      d.insert('evaluations', {
        team_id: teamId,
        player_id: id,
        evaluated_on: day(-6),
        label: 'October check-in',
        evaluator: user.name,
        ratings: r(...p.now),
        strengths: '',
        improvements: '',
        notes: '',
      });
    }
    // Richer written evaluations for a few players
    const evalText: Record<string, [string, string, string]> = {
      Fraser: [
        'Elite straight-line speed and a heavy wrist shot. Dangerous on the rush.',
        'Leaves the defensive zone early on breakouts — needs to stop on the wall and shoulder-check before receiving. Positioning in D-zone coverage.',
        'Responds well to direct feedback. Showed better wall play vs Ironbridge.',
      ],
      Caldwell: ['Strong two-way centre. Best puck skills on the team and wins key draws.', 'Can over-handle in the neutral zone; move the puck earlier.', 'Leadership group candidate.'],
      Rossi: ['Relentless on the forecheck. Great first three strides.', 'Decision-making with the puck under pressure; positioning on breakouts (also leaves early).', 'Improved since preseason.'],
      MacDonald: ['Physical, competes hard in front of the net.', 'First pass on breakouts — rushes it. Puck skills under pressure.', ''],
      Morrison: ['Calm, square to shooters, excellent rebound control.', 'Puck handling behind the net.', 'Starting goalie.'],
    };
    for (const [last, [s, i, n]] of Object.entries(evalText)) {
      d.run(
        `UPDATE evaluations SET strengths = ?, improvements = ?, notes = COALESCE(NULLIF(?, ''), notes) WHERE player_id = ? AND label = 'October check-in'`,
        s,
        i,
        n,
        P[last],
      );
    }

    // Games: 8 played, 2 upcoming
    const games = [
      { o: 'Riverside Rangers', off: -33, gf: 4, ga: 2, sf: 31, sa: 22, v: 'home', s: 'Strong start to the season. Forecheck created turnovers all game.' },
      { o: 'Lakeshore Lightning', off: -30, gf: 2, ga: 3, sf: 25, sa: 28, v: 'away', s: 'Gave up two goals off D-zone coverage breakdowns at the net front.' },
      { o: 'Eastview Eagles', off: -26, gf: 3, ga: 3, sf: 27, sa: 27, v: 'home', s: 'Tied late. Breakout struggles in the 2nd period against a hard forecheck.' },
      { o: 'Westbrook Wolves', off: -23, gf: 5, ga: 1, sf: 38, sa: 17, v: 'away', s: 'Dominant. Power play scored twice.' },
      { o: 'Summit Storm', off: -19, gf: 1, ga: 4, sf: 20, sa: 33, v: 'away', s: 'Turnovers on breakouts led to three goals against. Wingers leaving the zone early.' },
      { o: 'Valley Vipers', off: -16, gf: 2, ga: 3, sf: 29, sa: 25, v: 'home', s: 'Lost in OT. Breakout still an issue; power play went 0-for-5.', ot: 1 },
      { o: 'Harbour City Kings', off: -12, gf: 3, ga: 2, sf: 30, sa: 24, v: 'home', s: 'Better structure. Still some breakout turnovers under pressure.' },
      { o: 'Ironbridge Icemen', off: -5, gf: 4, ga: 2, sf: 33, sa: 21, v: 'away', s: 'Best breakout game of the season after a focused practice week. PP struggled again.' },
    ];
    const G: number[] = [];
    for (const g of games) {
      G.push(
        d.insert('games', {
          team_id: teamId,
          played_at: day(g.off, g.v === 'home' ? '19:00' : '18:15'),
          opponent: g.o,
          venue: g.v,
          game_type: 'league',
          location: g.v === 'home' ? 'Northside Arena — Rink 1' : `${g.o.split(' ')[0]} Community Centre`,
          goals_for: g.gf,
          goals_against: g.ga,
          shots_for: g.sf,
          shots_against: g.sa,
          overtime: g.ot ?? 0,
          summary: g.s,
        }),
      );
    }
    d.insert('games', { team_id: teamId, played_at: day(7, '19:30'), opponent: 'Lakeshore Lightning', venue: 'home', game_type: 'league', location: 'Northside Arena — Rink 1' });
    d.insert('games', { team_id: teamId, played_at: day(9, '13:00'), opponent: 'Eastview Eagles', venue: 'away', game_type: 'league', location: 'Eastview Sportsplex' });

    // Development priorities
    const prBreakout = d.insert('priorities', {
      team_id: teamId,
      title: 'Winger support on breakouts',
      focus_area: 'breakout',
      description: 'Wingers are leaving the defensive zone before possession is secured, leaving D with no outlet and causing turnovers. Standard: strong-side winger stopped on the wall at the hash marks; we leave the zone together, with the puck.',
      status: 'active',
      created_at: day(-18, '21:00'),
    });
    const prNetFront = d.insert('priorities', {
      team_id: teamId,
      title: 'Net-front coverage in the defensive zone',
      focus_area: 'd-zone',
      description: 'Weak-side D losing net-front battles and failing to tie up sticks on point shots.',
      status: 'monitoring',
      created_at: day(-29, '21:00'),
    });
    const prPP = d.insert('priorities', {
      team_id: teamId,
      title: 'Forecheck: F1 angle and F2 read',
      focus_area: 'forecheck',
      description: 'F1 was chasing instead of angling; F2 not reading the outlet.',
      status: 'resolved',
      created_at: day(-40, '21:00'),
      resolved_at: day(-14, '21:00'),
    });
    const prFraser = d.insert('priorities', {
      team_id: teamId,
      title: 'Owen Fraser — shoulder-check and hold the wall',
      focus_area: 'individual',
      description: 'Personal priority tied to the team breakout priority. Owen must scan before receiving and stop on the wall instead of curling away early.',
      status: 'active',
      player_id: P.Fraser,
      created_at: day(-15, '21:00'),
    });
    void prPP;

    // Observations: [gameIndex, area, kind, severity, period, time, text, players, priority]
    type Obs = [number, string, 'issue' | 'positive', number, string, string, string, string[], number | null];
    const obs: Obs[] = [
      [0, 'forecheck', 'positive', 2, '1', '12:40', 'F1 angled well and forced turnovers below the goal line. Two goals came directly from forecheck pressure.', ['Rossi', 'Caldwell'], null],
      [0, 'special-teams', 'positive', 2, '2', '08:15', 'PP entry clean, Caldwell found Sullivan for a one-timer goal.', ['Caldwell', 'Sullivan'], null],
      [1, 'd-zone', 'issue', 3, '2', '14:02', 'Lost net-front battle on a point shot — tip goal against. Weak-side D was puck-watching.', ['MacDonald'], prNetFront],
      [1, 'd-zone', 'issue', 2, '3', '05:30', 'No stick on the slot pass from below the goal line — second goal against.', ['Pelletier'], prNetFront],
      [1, 'breakout', 'issue', 1, '1', '09:10', 'D-to-D pass in our own end was picked off; D forced it with F1 on him.', ['Lindqvist'], null],
      [2, 'breakout', 'issue', 3, '2', '11:45', 'Both wingers left the zone early on a D retrieval; D had no outlet and turned it over in the slot.', ['Fraser', 'Rossi'], prBreakout],
      [2, 'breakout', 'issue', 2, '2', '06:20', 'Weak-side winger at the far blue line instead of supporting in the middle lane.', ['Nguyen'], prBreakout],
      [2, 'neutral-zone', 'positive', 1, '3', '02:10', 'Good regroup through the neutral zone leading to the tying goal.', ['Bergeron', 'Patterson'], null],
      [3, 'special-teams', 'positive', 2, '1', '10:00', 'Power play scored twice off umbrella rotation and net-front screen.', ['Sullivan', 'Kowalski'], null],
      [3, 'd-zone', 'positive', 1, '2', '15:15', 'D tied up sticks on every point shot; no second chances allowed.', ['Patterson', 'Achebe'], prNetFront],
      [4, 'breakout', 'issue', 3, '1', '13:30', 'Winger curled away from the wall before the puck arrived — puck went off the boards and out to their D. Goal against 20 seconds later.', ['Fraser'], prBreakout],
      [4, 'breakout', 'issue', 3, '2', '07:05', 'Wingers leaving the zone early on breakouts — D forced to throw it up the middle. Goal against.', ['Rossi', 'Desjardins'], prBreakout],
      [4, 'breakout', 'issue', 2, '3', '16:40', 'D rushed the first pass under pressure instead of using the net to reverse.', ['MacDonald'], prBreakout],
      [4, 'individual', 'issue', 2, '2', '04:00', 'Owen received with his back to pressure and lost the puck on the wall — no shoulder-check.', ['Fraser'], prFraser],
      [5, 'breakout', 'issue', 2, '1', '08:50', 'Strong-side winger not on the wall when D retrieved; D had to skate it out under pressure.', ['Tremblay'], prBreakout],
      [5, 'breakout', 'issue', 2, '3', '12:15', 'Winger left early again; turnover at our blue line.', ['Fraser'], prBreakout],
      [5, 'special-teams', 'issue', 2, '2', '09:00', 'PP 0-for-5. Entries were stopped at the blue line every time — no speed through the neutral zone.', ['Caldwell', 'Sullivan', 'Lindqvist'], null],
      [5, 'individual', 'positive', 1, 'OT', '02:00', 'Morrison made three big saves in OT to keep us in it.', ['Morrison'], null],
      [6, 'breakout', 'issue', 1, '2', '10:30', 'One breakout turnover when the centre was too high to support.', ['Ouellette'], prBreakout],
      [6, 'breakout', 'positive', 2, '1', '05:45', 'Wingers held the wall on most breakouts. Clean exits up the strong side.', ['Tremblay', 'Sullivan'], prBreakout],
      [6, 'd-zone', 'issue', 1, '3', '03:20', 'Slow to cover the point after a wall rotation.', ['Nguyen'], null],
      [7, 'breakout', 'positive', 2, '1', '11:00', 'Best breakout game of the season. Wingers stopped on the wall and supported until possession.', ['Fraser', 'Rossi', 'Tremblay'], prBreakout],
      [7, 'breakout', 'positive', 2, '2', '14:20', 'Reverse breakout used twice to beat a hard F1.', ['Patterson', 'Clarke'], prBreakout],
      [7, 'individual', 'positive', 2, '2', '06:30', 'Owen shoulder-checked and bumped to the centre for a clean exit — exactly what we worked on.', ['Fraser'], prFraser],
      [7, 'special-teams', 'issue', 2, '3', '08:40', 'PP entries again stalled at the blue line; drop pass timing off.', ['Caldwell', 'Bergeron'], null],
    ];
    for (const [gi, area, kind, sev, period, time, text, players, pr] of obs) {
      const oid = d.insert('observations', {
        team_id: teamId,
        game_id: G[gi],
        focus_area: area,
        kind,
        severity: sev,
        period,
        game_time: time,
        description: text,
        priority_id: pr,
      });
      for (const pl of players) d.run('INSERT INTO observation_players VALUES (?, ?)', oid, P[pl]);
    }

    // Player goals
    const goals: [string, string, string, string, number, number | null][] = [
      ['Fraser', 'Stop on the wall and shoulder-check before every breakout reception', 'positioning', 'Target: zero "left early" observations in 3 straight games.', 55, prFraser],
      ['Fraser', 'Improve D-zone positioning rating to 3', 'positioning', '', 30, null],
      ['Rossi', 'Hold the wall on breakouts until possession is secured', 'decision-making', '', 60, prBreakout],
      ['MacDonald', 'Use the net / reverse when F1 pressure is on', 'decision-making', 'Work with Coach Dana on retrieval reads.', 40, prBreakout],
      ['Caldwell', 'Move the puck within two touches in the neutral zone', 'decision-making', '', 50, null],
      ['Pelletier', 'Improve skating rating to 3 by mid-season', 'skating', 'Extra edge work in warm-ups; power skating clinic Saturdays.', 70, null],
      ['Morrison', 'Puck handling behind the net — set the puck for D', 'puck-skills', '', 35, null],
    ];
    for (const [last, title, skill, desc, progress, pr] of goals) {
      d.insert('player_goals', { team_id: teamId, player_id: P[last], title, skill, description: desc, progress, priority_id: pr, target_date: day(45), status: 'active' });
    }
    d.insert('player_goals', { team_id: teamId, player_id: P.Kowalski, title: 'Win 55% of defensive-zone faceoffs', skill: 'compete', description: '', progress: 100, status: 'achieved', target_date: day(-3) });

    const notes: [string, string, number][] = [
      ['Fraser', 'Talked with Owen after Summit game about breakout positioning. Very receptive — wants clips once we have video.', -18],
      ['Fraser', 'Much better vs Ironbridge. Keep reinforcing with praise.', -4],
      ['Halvorsen', 'Cleared for non-contact skating. Re-evaluate in 2 weeks.', -8],
      ['Caldwell', 'Discussed leadership group role — accepted.', -20],
    ];
    for (const [last, body, off] of notes) d.insert('player_notes', { team_id: teamId, player_id: P[last], body, author: user.name, created_at: day(off, '20:00:00').replace('T', ' ') });

    // Practices
    const drill = (name: string) => d.get('SELECT id, name, duration FROM drills WHERE team_id IS NULL AND name = ?', name)!;
    const seg = (name: string, duration?: number, notes = '') => {
      const dr = drill(name);
      return { drill_id: dr.id, title: dr.name, duration: duration ?? dr.duration, notes };
    };
    const addPractice = (p: Record<string, unknown>, segments: { drill_id: number | null; title: string; duration: number; notes: string }[], priorities: number[] = []) => {
      const id = d.insert('practices', { team_id: teamId, ...p });
      segments.forEach((s, i) => d.insert('practice_segments', { practice_id: id, position: i, ...s }));
      for (const pr of priorities) d.run('INSERT INTO practice_priorities VALUES (?, ?)', id, pr);
      return id;
    };
    addPractice(
      { title: 'Breakout foundations', scheduled_at: day(-15, '17:30'), duration: 60, location: 'Northside Arena — Rink 2', objectives: 'Introduce the winger wall-support standard after the Summit game.', status: 'completed' },
      [seg('Dynamic Warm-Up Flow', 7), seg('Winger Wall Support Breakout', 15, 'Freeze the drill every time a winger leaves early.'), seg('D-to-Wing Rim & Bump', 12), seg('Five-Man Breakout Walkthrough', 12), seg('Cross-Ice 3-on-3 Small-Area Game', 10), seg('Cool-Down & Stretch', 4)],
      [prBreakout],
    );
    addPractice(
      { title: 'Breakouts under pressure + net-front', scheduled_at: day(-9, '17:30'), duration: 75, location: 'Northside Arena — Rink 2', objectives: 'Progress breakouts to live forecheck pressure. Net-front box-outs.', status: 'completed' },
      [seg('Dynamic Warm-Up Flow', 8), seg('Reverse Breakout vs Pressure', 12), seg('Winger Wall Support Breakout', 12), seg('Net-Front Box-Out Battles', 10), seg('Low-Zone 2-on-2 Coverage', 12), seg('Corner Puck Battles 1-on-1', 8), seg('Full-Ice Flow Tempo Drill', 9), seg('Cool-Down & Stretch', 4)],
      [prBreakout, prNetFront],
    );
    addPractice(
      { title: 'Pre-game skate', scheduled_at: day(-6, '16:00'), duration: 45, location: 'Northside Arena — Rink 1', objectives: 'Sharpen up; review breakout options.', status: 'completed' },
      [seg('Dynamic Warm-Up Flow', 8), seg('Five-Man Breakout Walkthrough', 10), seg('Catch-and-Release Shooting Lanes', 12), seg('Power Play Umbrella Rotation', 10), seg('Cool-Down & Stretch', 5)],
      [prBreakout],
    );
    addPractice(
      { title: 'Breakout habits + power play entries', scheduled_at: day(2, '17:30'), duration: 60, location: 'Northside Arena — Rink 2', objectives: 'Keep reinforcing winger wall support (it is working — see Ironbridge). Fix PP entries that stalled in the last two games.', status: 'planned' },
      [
        seg('Dynamic Warm-Up Flow', 6),
        seg('Edge Control Figure-8s', 6),
        seg('Winger Wall Support Breakout', 12, 'Standard: stopped on the wall at the hash marks. Owen and Mateo lead the demo.'),
        seg('Neutral Zone Regroup', 10, 'Build speed for PP entries.'),
        seg('3-on-2 Zone Entry Options', 10, 'Drop pass timing.'),
        seg('Cross-Ice 3-on-3 Small-Area Game', 12, 'Bonus point for a clean breakout exit.'),
        seg('Cool-Down & Stretch', 4),
      ],
      [prBreakout, prFraser],
    );
    addPractice(
      { title: 'Compete & net-front', scheduled_at: day(4, '18:00'), duration: 60, location: 'Northside Arena — Rink 2', objectives: 'Battle level and net-front play before Lakeshore rematch.', status: 'planned' },
      [seg('Dynamic Warm-Up Flow', 7), seg('Gap Control 1-on-1', 10), seg('Net-Front Box-Out Battles', 10), seg('Net-Front Tips & Rebounds', 10), seg('Corner Puck Battles 1-on-1', 8), seg('Penalty Kill Box Rotation', 10), seg('Cool-Down & Stretch', 5)],
      [prNetFront],
    );
    addPractice(
      { title: 'Pre-game skate vs Lakeshore', scheduled_at: day(6, '16:30'), duration: 45, location: 'Northside Arena — Rink 1', objectives: '', status: 'draft' },
      [seg('Dynamic Warm-Up Flow', 8), seg('Three-Shot Rapid Fire', 8)],
    );
    addPractice(
      { title: 'Standard 60-min development practice', duration: 60, objectives: 'Template: warm-up, skill block, team concept, compete, cool-down.', is_template: 1, status: 'planned', source: 'template' },
      [seg('Dynamic Warm-Up Flow', 8), seg('Edge Control Figure-8s', 8), seg('Catch-and-Release Shooting Lanes', 10), seg('Five-Man Breakout Walkthrough', 12), seg('Cross-Ice 3-on-3 Small-Area Game', 12), { drill_id: null, title: 'Coach’s choice / water break', duration: 5, notes: '' }, seg('Cool-Down & Stretch', 5)],
    );
    addPractice(
      { title: 'Pre-game 45-min skate', duration: 45, objectives: 'Template: light tempo, special teams review, shooting.', is_template: 1, status: 'planned', source: 'template' },
      [seg('Dynamic Warm-Up Flow', 8), seg('Power Play Umbrella Rotation', 10), seg('Penalty Kill Box Rotation', 8), seg('Catch-and-Release Shooting Lanes', 12), seg('Cool-Down & Stretch', 7)],
    );

    // Calendar events
    d.insert('events', { team_id: teamId, type: 'meeting', title: 'Team video & systems meeting', starts_at: day(3, '18:30'), ends_at: day(3, '19:15'), location: 'Northside Arena — Room B', notes: 'Breakout review using the tactical board.' });
    d.insert('events', { team_id: teamId, type: 'tournament', title: 'Fall Classic Tournament', starts_at: day(20, '08:00'), ends_at: day(22, '18:00'), location: 'Lakeshore Sports Complex', notes: 'Four-game guarantee. Schedule TBA.' });
    d.insert('events', { team_id: teamId, type: 'meeting', title: 'Parent meeting — mid-season update', starts_at: day(13, '19:00'), ends_at: day(13, '20:00'), location: 'Northside Arena — Room A', notes: '' });

    // Playbook
    for (const name of ['1-2-2 Forecheck', 'Strong-Side Wall Breakout', 'Reverse Breakout', 'Box +1 Zone Coverage', '1-3-1 Power Play (Umbrella)', 'Box Penalty Kill']) {
      const s = d.get('SELECT id FROM systems WHERE team_id IS NULL AND name = ?', name);
      if (s) d.insert('playbook_entries', { team_id: teamId, system_id: s.id, notes: name === 'Strong-Side Wall Breakout' ? 'Our primary breakout. Wingers: wall at the hash marks!' : '' });
    }

    // Saved tactical-board diagram
    const board: Diagram = {
      view: 'dzone',
      items: [
        { id: 'a1', kind: 'D', x: 10, y: 64, label: 'D1' },
        { id: 'a2', kind: 'D', x: 16, y: 32, label: 'D2' },
        { id: 'a3', kind: 'F', x: 34, y: 80, label: 'LW' },
        { id: 'a4', kind: 'F', x: 38, y: 58, label: 'C' },
        { id: 'a5', kind: 'F', x: 42, y: 22, label: 'RW' },
        { id: 'a6', kind: 'X', x: 26, y: 64, label: 'F1' },
        { id: 'a7', kind: 'X', x: 55, y: 76, label: 'F2' },
        { id: 'a8', kind: 'puck', x: 8, y: 68 },
        { id: 'a9', kind: 'G', x: 14, y: 42.5 },
      ],
      paths: [
        { id: 'b1', kind: 'pass', points: [[8, 68], [32, 79]] },
        { id: 'b2', kind: 'skate', points: [[38, 58], [44, 70]] },
        { id: 'b3', kind: 'pass', points: [[34, 80], [44, 71]] },
        { id: 'b4', kind: 'skate', points: [[42, 22], [52, 36], [58, 48]] },
      ],
    };
    d.insert('diagrams', { team_id: teamId, name: 'Breakout vs 2-man forecheck', description: 'Strong-side option with the weak-side winger in the middle lane. Used in the Ironbridge prep meeting.', data: board });

    return teamId;
  });
}

/** A lighter second team so coaches can try team switching. */
function createSecondTeam(db: DB, user: { id: number; name: string; email: string }) {
  const d = q(db);
  d.tx(() => {
    const teamId = d.insert('teams', { name: 'Northside Hawks U13 A', short_name: 'NSH13', color: '#2563eb', division: 'U13', level: 'A', season: '2026–27', eval_categories: DEFAULT_EVAL_CATEGORIES });
    d.insert('staff', { team_id: teamId, user_id: user.id, name: user.name, email: user.email, title: 'Assistant Coach', permission: 'edit' });
    const kids: [string, string, number, string][] = [
      ['Leo', 'Martin', 10, 'C'],
      ['Aria', 'Thompson', 15, 'C'],
      ['Sebastian', 'Roy', 18, 'LW'],
      ['Maya', 'Gill', 22, 'LW'],
      ['Theo', 'Laurent', 13, 'RW'],
      ['Jonah', 'Park', 20, 'RW'],
      ['Eli', 'Bennett', 3, 'D'],
      ['Ava', 'Kozak', 5, 'D'],
      ['Wyatt', 'Singh', 6, 'D'],
      ['Charlie', 'Dubois', 8, 'D'],
      ['Isla', 'Novak', 1, 'G'],
    ];
    kids.forEach(([first, last, no, pos], i) => {
      const id = d.insert('players', { team_id: teamId, first_name: first, last_name: last, number: no, position: pos, shoots: i % 3 ? 'L' : 'R', birth_year: 2014 });
      if (i < 6) d.insert('evaluations', { team_id: teamId, player_id: id, evaluated_on: day(-20), label: 'Preseason', evaluator: user.name, ratings: r(3, 3, 2 + (i % 2), 3, 2, 4, 3) });
    });
    d.insert('games', { team_id: teamId, played_at: day(-8, '10:00'), opponent: 'Riverside Rangers U13', venue: 'home', game_type: 'league', location: 'Northside Arena — Rink 2', goals_for: 3, goals_against: 3, shots_for: 22, shots_against: 19, summary: 'Even game. Lots of energy.' });
    d.insert('games', { team_id: teamId, played_at: day(5, '11:00'), opponent: 'Valley Vipers U13', venue: 'away', game_type: 'league', location: 'Valley Arena' });
    d.insert('practices', { team_id: teamId, title: 'Skating & puck control stations', scheduled_at: day(1, '07:00'), duration: 50, location: 'Northside Arena — Rink 2', objectives: 'Station-based skill development.', status: 'planned' });
  });
}
