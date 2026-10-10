import { parseJson, q, type DB, type Row } from './db.ts';
import { FOCUS_AREA_LABELS, type EvalCategory, type FocusArea } from '../shared/domain.ts';

/**
 * The "connected coaching" logic: turns raw observations and evaluations into
 * trends, recurring issues and drill recommendations. Everything here is
 * deterministic and explainable — no AI involved.
 */

export function gameResult(g: Row): 'W' | 'L' | 'OTL' | 'T' | null {
  if (g.goals_for === null || g.goals_against === null) return null;
  if (g.goals_for > g.goals_against) return 'W';
  if (g.goals_for < g.goals_against) return g.overtime ? 'OTL' : 'L';
  return 'T';
}

export function teamRecord(db: DB, teamId: number) {
  const games = q(db).all('SELECT * FROM games WHERE team_id = ? AND goals_for IS NOT NULL', teamId);
  const rec = { gp: games.length, w: 0, l: 0, otl: 0, t: 0, gf: 0, ga: 0, sf: 0, sa: 0 };
  for (const g of games) {
    const r = gameResult(g);
    if (r === 'W') rec.w++;
    else if (r === 'L') rec.l++;
    else if (r === 'OTL') rec.otl++;
    else if (r === 'T') rec.t++;
    rec.gf += g.goals_for;
    rec.ga += g.goals_against;
    rec.sf += g.shots_for ?? 0;
    rec.sa += g.shots_against ?? 0;
  }
  return rec;
}

/** Completed games in chronological order (most recent `limit`). */
function recentGames(db: DB, teamId: number, limit: number) {
  return q(db)
    .all(
      'SELECT id, played_at, opponent, goals_for, goals_against, overtime FROM games WHERE team_id = ? AND goals_for IS NOT NULL ORDER BY played_at DESC LIMIT ?',
      teamId,
      limit,
    )
    .reverse();
}

export interface TrendPoint {
  gameId: number;
  date: string;
  opponent: string;
  issues: number;
  positives: number;
}

/** Per-game issue/positive counts for a focus area (optionally one player). */
export function focusTrend(db: DB, teamId: number, focusArea: string, playerId?: number | null, limit = 10): TrendPoint[] {
  const games = recentGames(db, teamId, limit);
  return games.map((g) => {
    const params: (string | number)[] = [g.id, focusArea];
    let join = '';
    if (playerId) {
      join = 'JOIN observation_players op ON op.observation_id = o.id AND op.player_id = ?';
      params.unshift(playerId);
    }
    const rows = q(db).all(
      `SELECT o.kind, COUNT(*) AS n FROM observations o ${join} WHERE o.game_id = ? AND o.focus_area = ? GROUP BY o.kind`,
      ...params,
    );
    const by = Object.fromEntries(rows.map((r) => [r.kind, Number(r.n)]));
    return { gameId: g.id, date: g.played_at, opponent: g.opponent, issues: by.issue ?? 0, positives: by.positive ?? 0 };
  });
}

export type TrendSignal = 'improving' | 'worsening' | 'steady' | 'not-enough-data';

/**
 * Compare games since the priority was created against games before it. Uses
 * net (issues − positives) per game so recording positive execution counts too.
 */
export function trendSignal(points: TrendPoint[], since?: string): { signal: TrendSignal; before: number | null; after: number | null } {
  const net = (p: TrendPoint) => p.issues - p.positives;
  const avg = (xs: TrendPoint[]) => (xs.length ? xs.reduce((s, p) => s + net(p), 0) / xs.length : null);
  let before: TrendPoint[];
  let after: TrendPoint[];
  if (since) {
    before = points.filter((p) => p.date < since);
    after = points.filter((p) => p.date >= since);
  } else {
    const mid = Math.floor(points.length / 2);
    before = points.slice(0, mid);
    after = points.slice(mid);
  }
  // Fall back to a half split when the priority is too new to have "after" games.
  if (after.length < 2 || before.length < 1) {
    const mid = Math.floor(points.length / 2);
    before = points.slice(0, mid);
    after = points.slice(mid);
  }
  const b = avg(before);
  const a = avg(after);
  if (b === null || a === null || points.length < 3) return { signal: 'not-enough-data', before: b, after: a };
  const delta = a - b;
  const signal: TrendSignal = delta <= -0.5 ? 'improving' : delta >= 0.5 ? 'worsening' : 'steady';
  return { signal, before: round(b), after: round(a) };
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * A focus area is "recurring" when issues were logged in at least 2 of the
 * last 5 completed games.
 */
export function recurringIssues(db: DB, teamId: number) {
  const games = recentGames(db, teamId, 5);
  if (!games.length) return [];
  const ids = games.map((g) => g.id);
  const rows = q(db).all(
    `SELECT focus_area, game_id, COUNT(*) AS n FROM observations
     WHERE team_id = ? AND kind = 'issue' AND game_id IN (${ids.map(() => '?').join(',')})
     GROUP BY focus_area, game_id`,
    teamId,
    ...ids,
  );
  const byArea = new Map<string, { games: Set<number>; count: number }>();
  for (const r of rows) {
    const e = byArea.get(r.focus_area) ?? { games: new Set(), count: 0 };
    e.games.add(r.game_id);
    e.count += Number(r.n);
    byArea.set(r.focus_area, e);
  }
  const active = q(db).all(
    "SELECT id, title, focus_area FROM priorities WHERE team_id = ? AND status != 'resolved' AND player_id IS NULL",
    teamId,
  );
  return [...byArea.entries()]
    .filter(([, e]) => e.games.size >= 2)
    .map(([area, e]) => {
      const examples = q(db).all(
        `SELECT o.description, g.opponent FROM observations o JOIN games g ON g.id = o.game_id
         WHERE o.team_id = ? AND o.focus_area = ? AND o.kind = 'issue' ORDER BY g.played_at DESC LIMIT 3`,
        teamId,
        area,
      );
      const priority = active.find((p) => p.focus_area === area) ?? null;
      return {
        focusArea: area,
        label: FOCUS_AREA_LABELS[area as FocusArea] ?? area,
        gamesAffected: e.games.size,
        gamesConsidered: games.length,
        issueCount: e.count,
        examples,
        priority,
      };
    })
    .sort((a, b) => b.issueCount - a.issueCount);
}

export interface DrillRecommendation {
  drill: Row;
  score: number;
  reasons: string[];
}

export function recommendDrills(
  db: DB,
  teamId: number,
  opts: { focusAreas?: string[]; skills?: string[]; division?: string; excludeIds?: number[]; limit?: number },
): DrillRecommendation[] {
  const drills = q(db)
    .all('SELECT * FROM drills WHERE team_id IS NULL OR team_id = ?', teamId)
    .map((d) => parseJson(d, 'age_levels', 'focus_areas', 'skills', 'coaching_points', 'equipment', 'diagram')!);
  const exclude = new Set(opts.excludeIds ?? []);
  const out: DrillRecommendation[] = [];
  for (const d of drills) {
    if (exclude.has(d.id)) continue;
    let score = 0;
    const reasons: string[] = [];
    for (const f of opts.focusAreas ?? []) {
      if (d.focus_areas.includes(f)) {
        // A drill whose primary focus is this area outranks one that only touches it.
        score += d.focus_areas[0] === f ? 4 : 3;
        reasons.push(`Targets ${FOCUS_AREA_LABELS[f as FocusArea] ?? f}`);
      }
    }
    for (const s of opts.skills ?? []) {
      if (d.skills.includes(s)) {
        score += 2;
        reasons.push(`Develops ${s.replace(/-/g, ' ')}`);
      }
    }
    if (score === 0) continue;
    if (opts.division && d.age_levels.includes(opts.division)) {
      score += 1;
      reasons.push(`Suited to ${opts.division}`);
    }
    out.push({ drill: d, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.drill.name.localeCompare(b.drill.name)).slice(0, opts.limit ?? 6);
}

/** Latest vs previous evaluation for a player, with strengths & weaknesses. */
export function playerEvalSummary(db: DB, playerId: number, categories: EvalCategory[]) {
  const evals = q(db)
    .all('SELECT * FROM evaluations WHERE player_id = ? ORDER BY evaluated_on DESC, id DESC LIMIT 2', playerId)
    .map((e) => parseJson(e, 'ratings')!);
  const [latest, previous] = evals;
  if (!latest) return null;
  const scored = categories
    .map((c) => ({
      key: c.key,
      label: c.label,
      value: latest.ratings[c.key] as number | undefined,
      delta: previous && latest.ratings[c.key] != null && previous.ratings[c.key] != null ? latest.ratings[c.key] - previous.ratings[c.key] : null,
    }))
    .filter((c) => typeof c.value === 'number') as { key: string; label: string; value: number; delta: number | null }[];
  const avg = scored.length ? round(scored.reduce((s, c) => s + c.value, 0) / scored.length) : null;
  const sorted = [...scored].sort((a, b) => b.value - a.value);
  return {
    latestId: latest.id,
    evaluatedOn: latest.evaluated_on,
    average: avg,
    categories: scored,
    strengths: sorted.slice(0, 2),
    weaknesses: sorted.slice(-2).reverse(),
  };
}
