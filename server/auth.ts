import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { q, type DB } from './db.ts';
import type { Permission } from '../shared/domain.ts';

export const SESSION_COOKIE = 'biq_session';
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

export function createSession(db: DB, userId: number): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  q(db).run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires);
  return token;
}

/** `secure` follows the request protocol (set TRUST_PROXY=1 behind a TLS-terminating proxy). */
export function setSessionCookie(req: Request, res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  });
}

export interface AuthedRequest extends Request {
  user: { id: number; email: string; name: string };
  team: { permission: Permission; [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Resolve the session cookie into req.user, or 401. */
export function requireUser(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const row = q(db).get(
      `SELECT u.id, u.email, u.name, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
      token,
    );
    if (!row || row.expires_at < new Date().toISOString()) {
      return res.status(401).json({ error: 'Session expired' });
    }
    (req as AuthedRequest).user = { id: row.id, email: row.email, name: row.name };
    next();
  };
}

const RANK: Record<Permission, number> = { view: 0, edit: 1, admin: 2 };

/**
 * Loads :teamId and the caller's staff permission. GET requests need `view`;
 * any write needs at least `minWrite` (default `edit`).
 */
export function requireTeam(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    const teamId = Number(req.params.teamId);
    const team = q(db).get(
      `SELECT t.*, s.permission FROM teams t JOIN staff s ON s.team_id = t.id AND s.user_id = ? WHERE t.id = ?`,
      user.id,
      teamId,
    );
    if (!team) return res.status(404).json({ error: 'Team not found' });
    (req as AuthedRequest).team = team as AuthedRequest['team'];
    if (req.method !== 'GET' && RANK[team.permission as Permission] < RANK.edit) {
      return res.status(403).json({ error: 'Your role on this team is read-only' });
    }
    next();
  };
}

export function requirePermission(min: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    const team = (req as AuthedRequest).team;
    if (RANK[team.permission] < RANK[min]) {
      return res.status(403).json({ error: `This action requires ${min} permission on the team` });
    }
    next();
  };
}
