import { Router } from 'express';
import { q, type DB } from '../db.ts';
import { createSession, hashPassword, requireUser, SESSION_COOKIE, setSessionCookie, verifyPassword, type AuthedRequest } from '../auth.ts';
import { bad, HttpError, str } from '../validate.ts';
import { DEMO_EMAIL } from '../seed.ts';

export function authRoutes(db: DB) {
  const r = Router();
  const d = q(db);

  r.post('/signup', (req, res) => {
    const name = str(req.body.name, 'Name', { required: true, max: 80 })!;
    const email = str(req.body.email, 'Email', { required: true, max: 200 })!.toLowerCase();
    const password = str(req.body.password, 'Password', { required: true, max: 200 })!;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Enter a valid email address');
    if (password.length < 8) throw bad('Password must be at least 8 characters');
    if (d.get('SELECT id FROM users WHERE email = ?', email)) throw bad('An account with that email already exists');
    const id = d.insert('users', { name, email, password_hash: hashPassword(password) });
    // Accept any pending staff invitations sent to this email.
    d.run('UPDATE staff SET user_id = ? WHERE email = ? AND user_id IS NULL', id, email);
    setSessionCookie(req, res, createSession(db, id));
    res.status(201).json({ id, name, email });
  });

  r.post('/login', (req, res) => {
    const email = str(req.body.email, 'Email', { required: true })!.toLowerCase();
    const password = str(req.body.password, 'Password', { required: true })!;
    const user = d.get('SELECT * FROM users WHERE email = ?', email);
    if (!user || !verifyPassword(password, user.password_hash)) throw new HttpError(401, 'Incorrect email or password');
    setSessionCookie(req, res, createSession(db, user.id));
    res.json({ id: user.id, name: user.name, email: user.email });
  });

  /** One-click access to the shared demo account (disable with BENCHIQ_DISABLE_DEMO=1). */
  r.post('/demo', (req, res) => {
    if (process.env.BENCHIQ_DISABLE_DEMO === '1') throw new HttpError(403, 'Demo access is disabled on this server');
    const user = d.get('SELECT * FROM users WHERE email = ?', DEMO_EMAIL);
    if (!user) throw new HttpError(404, 'Demo account not found. Run `npm run seed`.');
    setSessionCookie(req, res, createSession(db, user.id));
    res.json({ id: user.id, name: user.name, email: user.email });
  });

  r.post('/logout', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (token) d.run('DELETE FROM sessions WHERE token = ?', token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  r.get('/me', requireUser(db), (req, res) => {
    res.json((req as AuthedRequest).user);
  });

  r.patch('/me', requireUser(db), (req, res) => {
    const user = (req as AuthedRequest).user;
    const name = str(req.body.name, 'Name', { max: 80 });
    if (name) {
      d.run('UPDATE users SET name = ? WHERE id = ?', name, user.id);
      d.run('UPDATE staff SET name = ? WHERE user_id = ?', name, user.id);
    }
    if (req.body.newPassword) {
      const row = d.get('SELECT password_hash FROM users WHERE id = ?', user.id)!;
      if (!verifyPassword(String(req.body.currentPassword ?? ''), row.password_hash)) throw bad('Current password is incorrect');
      if (String(req.body.newPassword).length < 8) throw bad('New password must be at least 8 characters');
      d.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(req.body.newPassword)), user.id);
    }
    res.json(d.get('SELECT id, name, email FROM users WHERE id = ?', user.id));
  });

  return r;
}
