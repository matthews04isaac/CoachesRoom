import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Router, type Request } from 'express';
import { parseJson, q, type DB, type Row } from '../db.ts';
import { bad, HttpError, int, notFound, oneOf, str } from '../validate.ts';
import { FOCUS_AREAS } from '../../shared/domain.ts';
import { MAX_VIDEO_BYTES, createAnalysis, parseDriveId, parseYouTubeId, runAnalysis, tooBig, videoAnalysisAvailable, type Moment } from '../video.ts';

type Suggestion = Moment & { status: 'pending' | 'accepted' | 'dismissed'; observation_id?: number };

/** Game-video analysis routes (team-scoped). */
export function videoRoutes(db: DB) {
  const r = Router({ mergeParams: true });
  const d = q(db);
  const tid = (req: Request) => Number(req.params.teamId);

  const getGame = (req: Request) => {
    const g = d.get('SELECT * FROM games WHERE id = ? AND team_id = ?', req.params.gameId, tid(req));
    if (!g) throw notFound('Game');
    return g;
  };
  const loadAnalysis = (id: unknown, teamId: number) => {
    const a = parseJson(d.get('SELECT * FROM video_analyses WHERE id = ? AND team_id = ?', id, teamId), 'suggestions');
    if (!a) throw notFound('Video analysis');
    return a as Row & { suggestions: Suggestion[] };
  };
  const assertCanStart = (teamId: number) => {
    if (!videoAnalysisAvailable()) throw new HttpError(503, 'Video analysis needs a Google Gemini key. Set GEMINI_API_KEY on the server.');
    // One running job per team keeps the free Gemini quota from being exhausted.
    if (d.get("SELECT id FROM video_analyses WHERE team_id = ? AND status NOT IN ('done', 'failed')", teamId)) {
      throw bad('A video is already being analyzed for this team. Wait for it to finish first.');
    }
  };
  const ourColor = (v: unknown) => str(v, 'Jersey colour', { max: 40 }) ?? '';

  r.get('/games/:gameId/video', (req: Request, res) => {
    const g = getGame(req);
    const analyses = d.all('SELECT * FROM video_analyses WHERE game_id = ? ORDER BY id DESC', g.id).map((a) => parseJson(a, 'suggestions'));
    res.json({ available: videoAnalysisAvailable(), video_url: g.video_url ?? null, max_bytes: MAX_VIDEO_BYTES, analyses });
  });

  /** Analyze a Google Drive or YouTube link. */
  r.post('/games/:gameId/video/analyze', (req: Request, res) => {
    const g = getGame(req);
    const teamId = tid(req);
    const url = str(req.body.url, 'Video link', { required: true, max: 500 })!;
    const driveId = parseDriveId(url);
    const youtubeId = driveId ? null : parseYouTubeId(url);
    if (!driveId && !youtubeId) throw bad('Paste a Google Drive file link (drive.google.com/file/d/…) or a YouTube link.');
    assertCanStart(teamId);
    d.update('games', g.id, { video_url: url });
    const id = createAnalysis(db, teamId, g.id, driveId ? 'drive' : 'youtube', url, ourColor(req.body.our_color));
    void runAnalysis(db, id, driveId ? { driveId } : { youtubeUrl: `https://www.youtube.com/watch?v=${youtubeId}` });
    res.status(202).json(loadAnalysis(id, teamId));
  });

  /** Upload a video file directly (streamed to a temp file, then to Gemini). */
  r.post('/games/:gameId/video/upload', async (req: Request, res) => {
    const g = getGame(req);
    const teamId = tid(req);
    const type = String(req.headers['content-type'] ?? '').split(';')[0];
    if (!type.startsWith('video/')) throw bad('Upload a video file (MP4, MOV, …).');
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > MAX_VIDEO_BYTES) throw bad(tooBig(declared));
    assertCanStart(teamId);
    const file = path.join(os.tmpdir(), `benchiq-up-${crypto.randomBytes(6).toString('hex')}`);
    let bytes = 0;
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_VIDEO_BYTES) req.destroy(new Error(tooBig(bytes)));
    });
    try {
      await pipeline(req, fs.createWriteStream(file));
    } catch (e) {
      fs.rmSync(file, { force: true });
      throw bad(e instanceof Error ? e.message : 'Upload failed');
    }
    const id = createAnalysis(db, teamId, g.id, 'upload', String(req.headers['x-file-name'] ?? '').slice(0, 200) || null, ourColor(req.headers['x-our-color']));
    void runAnalysis(db, id, { uploadedFile: { file, mimeType: type } });
    res.status(202).json(loadAnalysis(id, teamId));
  });

  r.get('/video-analyses/:id', (req: Request, res) => {
    res.json(loadAnalysis(req.params.id, tid(req)));
  });

  r.delete('/video-analyses/:id', (req: Request, res) => {
    const a = loadAnalysis(req.params.id, tid(req));
    if (a.status !== 'done' && a.status !== 'failed') throw bad('Wait for the analysis to finish before deleting it.');
    d.run('DELETE FROM video_analyses WHERE id = ?', a.id);
    res.json({ ok: true });
  });

  /**
   * Accept (with optional coach edits) or dismiss one AI-suggested moment.
   * Accepting creates a real observation, so it flows into priorities & trends.
   */
  r.post('/video-analyses/:id/suggestions/:index', (req: Request, res) => {
    const teamId = tid(req);
    const a = loadAnalysis(req.params.id, teamId);
    const index = int(req.params.index, 'Suggestion', { required: true, min: 0, max: a.suggestions.length - 1 })!;
    const s = a.suggestions[index];
    if (s.status !== 'pending') throw bad('This suggestion has already been handled.');
    const action = oneOf(req.body.action, 'Action', ['accept', 'dismiss'] as const, { required: true });
    if (action === 'dismiss') {
      s.status = 'dismissed';
    } else {
      const o = req.body.overrides ?? {};
      let playerIds: number[];
      if (Array.isArray(o.player_ids)) {
        playerIds = o.player_ids.map(Number).filter((pid: number) => d.get('SELECT id FROM players WHERE id = ? AND team_id = ?', pid, teamId));
      } else {
        playerIds = s.jersey_numbers.map((n: string) => d.get("SELECT id FROM players WHERE team_id = ? AND number = ? AND status != 'inactive'", teamId, Number(n))?.id).filter(Boolean);
      }
      const priorityId = int(o.priority_id, 'Priority') ?? null;
      if (priorityId && !d.get('SELECT id FROM priorities WHERE id = ? AND team_id = ?', priorityId, teamId)) throw bad('Unknown priority');
      const obsId = d.tx(() => {
        const obsId = d.insert('observations', {
          team_id: teamId,
          game_id: a.game_id,
          focus_area: oneOf(o.focus_area, 'Category', FOCUS_AREAS) ?? s.focus_area,
          kind: oneOf(o.kind, 'Type', ['issue', 'positive'] as const) ?? s.kind,
          severity: int(o.severity, 'Severity', { min: 1, max: 3 }) ?? s.severity,
          description: str(o.description, 'Observation', { max: 2000 }) || s.description,
          game_time: null,
          priority_id: priorityId,
          video_ref: `${a.source}@${s.seconds}`,
        });
        for (const pid of playerIds) d.run('INSERT OR IGNORE INTO observation_players VALUES (?, ?)', obsId, pid);
        return obsId;
      });
      s.status = 'accepted';
      s.observation_id = obsId;
    }
    d.update('video_analyses', a.id, { suggestions: a.suggestions, updated_at: new Date().toISOString() });
    res.json(loadAnalysis(a.id, teamId));
  });

  return r;
}
