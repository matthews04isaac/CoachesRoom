import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * BenchIQ data model (SQLite via Node's built-in `node:sqlite`).
 *
 * The connected-coaching loop is modelled explicitly:
 *   games ─< observations >─< observation_players >─ players
 *                │ priority_id
 *                ▼
 *           priorities ─< practice_priorities >─ practices ─< practice_segments >─ drills
 *                ▲                                                     (drills.focus_areas)
 *           player_goals.priority_id
 * Focus areas (shared/domain.ts) tag observations, priorities and drills so the
 * app can recommend drills for a priority and chart whether it is improving.
 */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#e11d2e',
  logo_url TEXT,
  division TEXT NOT NULL,
  level TEXT NOT NULL,
  season TEXT NOT NULL,
  eval_categories TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  title TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('admin','edit','view')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (team_id, email)
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  number INTEGER,
  position TEXT NOT NULL,
  shoots TEXT,
  birth_year INTEGER,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS drills (
  id INTEGER PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, -- NULL = BenchIQ library drill
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration INTEGER NOT NULL DEFAULT 10,
  intensity TEXT NOT NULL DEFAULT 'medium',
  age_levels TEXT NOT NULL DEFAULT '[]',
  focus_areas TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  coaching_points TEXT NOT NULL DEFAULT '[]',
  equipment TEXT NOT NULL DEFAULT '[]',
  diagram TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS practices (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TEXT,
  duration INTEGER NOT NULL DEFAULT 60,
  location TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  is_template INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS practice_segments (
  id INTEGER PRIMARY KEY,
  practice_id INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  drill_id INTEGER REFERENCES drills(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 10,
  notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS priorities (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  focus_area TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE, -- NULL = team-wide
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS practice_priorities (
  practice_id INTEGER NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
  priority_id INTEGER NOT NULL REFERENCES priorities(id) ON DELETE CASCADE,
  PRIMARY KEY (practice_id, priority_id)
);
CREATE TABLE IF NOT EXISTS evaluations (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  evaluated_on TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  evaluator TEXT NOT NULL DEFAULT '',
  ratings TEXT NOT NULL,
  strengths TEXT NOT NULL DEFAULT '',
  improvements TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS player_goals (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  skill TEXT,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  target_date TEXT,
  priority_id INTEGER REFERENCES priorities(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS player_notes (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  played_at TEXT NOT NULL,
  opponent TEXT NOT NULL,
  venue TEXT NOT NULL DEFAULT 'home',
  game_type TEXT NOT NULL DEFAULT 'league',
  location TEXT NOT NULL DEFAULT '',
  goals_for INTEGER,      -- NULL until the result is recorded (scheduled game)
  goals_against INTEGER,
  shots_for INTEGER,
  shots_against INTEGER,
  overtime INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  focus_area TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('issue','positive')),
  severity INTEGER NOT NULL DEFAULT 2,
  period TEXT,
  game_time TEXT,
  description TEXT NOT NULL,
  priority_id INTEGER REFERENCES priorities(id) ON DELETE SET NULL,
  -- Reserved for Phase 3 video review (timestamped clips). Not used by the UI yet.
  video_ref TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS observation_players (
  observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  PRIMARY KEY (observation_id, player_id)
);
CREATE TABLE IF NOT EXISTS systems (
  id INTEGER PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, -- NULL = BenchIQ library system
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  key_points TEXT NOT NULL DEFAULT '[]',
  steps TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS playbook_entries (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  system_id INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  notes TEXT NOT NULL DEFAULT '',
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (team_id, system_id)
);
CREATE TABLE IF NOT EXISTS diagrams (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE, -- NULL = BenchIQ library resource
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tips TEXT NOT NULL DEFAULT '[]',
  video_url TEXT,
  diagram TEXT,
  level TEXT NOT NULL DEFAULT 'All ages',
  read_minutes INTEGER NOT NULL DEFAULT 4,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS video_analyses (
  id INTEGER PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  source TEXT NOT NULL,              -- drive | youtube | upload
  source_url TEXT,
  our_color TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,              -- queued | downloading | uploading | processing | analyzing | done | failed
  stage_message TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  footage_note TEXT NOT NULL DEFAULT '',
  suggestions TEXT NOT NULL DEFAULT '[]', -- AI-suggested moments; each has status pending | accepted | dismissed
  model TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_obs_team ON observations(team_id, focus_area);
CREATE INDEX IF NOT EXISTS idx_eval_player ON evaluations(player_id, evaluated_on);
CREATE INDEX IF NOT EXISTS idx_games_team ON games(team_id, played_at);
CREATE INDEX IF NOT EXISTS idx_practices_team ON practices(team_id, scheduled_at);
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any;

export function openDb(file = process.env.BENCHIQ_DB ?? 'data/benchiq.db') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

export type DB = DatabaseSync;

/** Additive column migrations for databases created by earlier versions. */
function migrate(db: DatabaseSync) {
  const has = (table: string, col: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);
  if (!has('games', 'video_url')) db.exec('ALTER TABLE games ADD COLUMN video_url TEXT');
}

/** Thin helpers so route code stays readable. */
export function q(db: DB) {
  return {
    all: (sql: string, ...params: unknown[]) => db.prepare(sql).all(...(params as SQLInputValue[])) as Row[],
    get: (sql: string, ...params: unknown[]) => db.prepare(sql).get(...(params as SQLInputValue[])) as Row | undefined,
    run: (sql: string, ...params: unknown[]) => db.prepare(sql).run(...(params as SQLInputValue[])),
    insert: (table: string, data: Record<string, unknown>) => {
      const keys = Object.keys(data);
      const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
      const r = db.prepare(sql).run(...keys.map((k) => toSql(data[k])));
      return Number(r.lastInsertRowid);
    },
    update: (table: string, id: number, data: Record<string, unknown>) => {
      const keys = Object.keys(data);
      if (!keys.length) return;
      const sql = `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
      db.prepare(sql).run(...keys.map((k) => toSql(data[k])), id);
    },
    tx<T>(fn: () => T): T {
      db.exec('BEGIN');
      try {
        const out = fn();
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

function toSql(v: unknown): SQLInputValue {
  if (v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v as SQLInputValue;
}

/** Parse the JSON columns of a row in place. */
export function parseJson(row: Row | undefined, ...cols: string[]): Row | undefined {
  if (!row) return row;
  const out: Row = { ...row };
  for (const c of cols) {
    if (typeof out[c] === 'string') {
      try {
        out[c] = JSON.parse(out[c]);
      } catch {
        /* leave as string */
      }
    }
  }
  return out;
}
