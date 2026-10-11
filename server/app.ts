import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import type { DB } from './db.ts';
import { requireTeam, requireUser } from './auth.ts';
import { HttpError } from './validate.ts';
import { authRoutes } from './routes/auth.ts';
import { teamRoutes, teamsRoutes } from './routes/team.ts';
import { coachingRoutes } from './routes/coaching.ts';
import { tacticsRoutes } from './routes/tactics.ts';
import { aiRoutes, aiStatusRoutes } from './routes/ai.ts';
import { videoRoutes } from './routes/video.ts';

export function createApp(db: DB, opts: { staticDir?: string } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes(db));
  app.use('/api/ai', requireUser(db), aiStatusRoutes());
  app.use('/api/teams', requireUser(db), teamsRoutes(db));

  const team = express.Router({ mergeParams: true });
  team.use(requireTeam(db));
  team.use(teamRoutes(db));
  team.use(coachingRoutes(db));
  team.use(tacticsRoutes(db));
  team.use(videoRoutes(db));
  team.use('/ai', aiRoutes(db));
  app.use('/api/teams/:teamId', requireUser(db), team);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (opts.staticDir && fs.existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { index: false, maxAge: '1h' }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.resolve(opts.staticDir!, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err instanceof SyntaxError && 'body' in (err as object)) return res.status(400).json({ error: 'Invalid JSON body' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });
  return app;
}
