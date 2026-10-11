import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ApiError as GoogleApiError, FileState, GoogleGenAI, MediaResolution, createPartFromUri, type Part } from '@google/genai';
import { q, type DB, type Row } from './db.ts';
import { FOCUS_AREAS, FOCUS_AREA_LABELS, type FocusArea } from '../shared/domain.ts';

/**
 * AI game-video analysis (Google Gemini only — it is the provider that can
 * watch video). A job downloads or receives the video, hands it to Gemini, and
 * stores timestamped *suggested* observations. Nothing becomes a real
 * observation until a coach accepts it.
 */

export const MAX_VIDEO_BYTES = 2 * 1024 ** 3; // Gemini Files API per-file limit
const MAX_MOMENTS = 40;

export function videoAnalysisAvailable() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}
function gemini() {
  return new GoogleGenAI({ apiKey: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)! });
}
const videoModel = () => process.env.GEMINI_VIDEO_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';

// ---------- link parsing ----------
export function parseDriveId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/(^|\.)drive\.google\.com$|(^|\.)docs\.google\.com$|^drive\.usercontent\.google\.com$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/file\/d\/([\w-]{10,})/) ?? u.pathname.match(/\/d\/([\w-]{10,})/);
    if (m) return m[1];
    const id = u.searchParams.get('id');
    return id && /^[\w-]{10,}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id: string | null = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      id = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/)?.[1] ?? null;
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

// ---------- analysis prompt & schema ----------
export const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: '2-4 sentence overview of how our team played in this footage.' },
    footage_note: { type: 'string', description: 'What the footage shows (camera angle, quality, which periods) and anything that limited the analysis.' },
    moments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          time: { type: 'string', description: 'Timestamp from the start of the video, MM:SS or H:MM:SS.' },
          focus_area: { type: 'string', enum: [...FOCUS_AREAS] },
          kind: { type: 'string', enum: ['issue', 'positive'] },
          severity: { type: 'integer', description: '1 minor, 2 moderate, 3 major (issues only).' },
          description: { type: 'string', description: 'What happened, in coaching language, one or two sentences.' },
          jersey_numbers: { type: 'array', items: { type: 'string' }, description: 'Our players involved — only numbers you can clearly read.' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['time', 'focus_area', 'kind', 'description', 'confidence'],
      },
    },
  },
  required: ['summary', 'moments'],
};

function buildPrompt(db: DB, teamId: number, game: Row, ourColor: string) {
  const d = q(db);
  const roster = d.all("SELECT number, first_name, last_name, position FROM players WHERE team_id = ? AND status != 'inactive' AND number IS NOT NULL ORDER BY number", teamId);
  const priorities = d.all("SELECT title, focus_area, description FROM priorities WHERE team_id = ? AND status != 'resolved'", teamId);
  return `You are an experienced ice hockey video coach reviewing game footage for a coaching staff.

OUR TEAM: wearing ${ourColor || 'the colour the coach did not specify — infer from context and say so in footage_note'} jerseys. Opponent: ${game.opponent}.
Our roster (jersey number — name, position):
${roster.map((p) => `#${p.number} — ${p.first_name} ${p.last_name}, ${p.position}`).join('\n') || '(no numbers recorded)'}

Our current development priorities (pay extra attention to these):
${priorities.map((p) => `- ${p.title} [${p.focus_area}]: ${p.description}`).join('\n') || '- none'}

Identify up to ${MAX_MOMENTS} coaching moments for OUR team — both problems and good execution — and classify each into exactly one focus area:
${FOCUS_AREAS.map((f) => `- ${f}: ${FOCUS_AREA_LABELS[f as FocusArea]}`).join('\n')}

Rules:
- Only report what you can actually see in the footage. Never invent events, scores or numbers.
- Timestamps are measured from the start of the video file.
- Include jersey numbers only when clearly readable; otherwise leave the list empty.
- Use "low" confidence when the camera angle, distance or quality makes the read uncertain.
- Prefer tactically meaningful moments (breakout execution, forecheck pressure, coverage breakdowns, zone entries, special teams, goals for/against) over routine play.`;
}

// ---------- jobs ----------
type Stage = 'queued' | 'downloading' | 'uploading' | 'processing' | 'analyzing' | 'done' | 'failed';

function setStage(db: DB, id: number, status: Stage, message: string, extra: Record<string, unknown> = {}) {
  q(db).update('video_analyses', id, { status, stage_message: message, updated_at: new Date().toISOString(), ...extra });
}

/** Mark jobs interrupted by a server restart as failed. */
export function recoverInterruptedJobs(db: DB) {
  q(db).run(
    "UPDATE video_analyses SET status = 'failed', error = 'The server restarted while this video was being analyzed. Please start it again.' WHERE status NOT IN ('done', 'failed')",
  );
}

export function createAnalysis(db: DB, teamId: number, gameId: number, source: 'drive' | 'youtube' | 'upload', sourceUrl: string | null, ourColor: string) {
  return q(db).insert('video_analyses', { team_id: teamId, game_id: gameId, source, source_url: sourceUrl, our_color: ourColor, status: 'queued', stage_message: 'Waiting to start…', suggestions: [] });
}

const tmpPath = (ext = '.mp4') => path.join(os.tmpdir(), `benchiq-${crypto.randomBytes(6).toString('hex')}${ext}`);

/** Download a Drive file shared with "Anyone with the link" to a temp file. */
async function downloadDrive(fileId: string): Promise<{ file: string; mimeType: string }> {
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`, { redirect: 'follow' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || type.includes('text/html')) {
    throw new Error('Couldn’t download the video from Google Drive. Make sure its sharing is set to “Anyone with the link” (Viewer) and that the link points to a video file.');
  }
  const size = Number(res.headers.get('content-length') ?? 0);
  if (size > MAX_VIDEO_BYTES) throw new Error(tooBig(size));
  const file = tmpPath();
  let bytes = 0;
  const body = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
  body.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > MAX_VIDEO_BYTES) body.destroy(new Error(tooBig(bytes)));
  });
  try {
    await pipeline(body, fs.createWriteStream(file));
  } catch (e) {
    fs.rmSync(file, { force: true });
    throw e;
  }
  return { file, mimeType: type.startsWith('video/') ? type.split(';')[0] : 'video/mp4' };
}

export const tooBig = (bytes: number) =>
  `This video is ${(bytes / 1024 ** 3).toFixed(2)} GB, which is over Gemini’s 2 GB limit per video. Split the game into one video per period, or export it at a lower resolution (720p is plenty), and try again.`;

/** Run a job end to end. Never throws — failures are recorded on the job row. */
export async function runAnalysis(db: DB, analysisId: number, input: { driveId?: string; youtubeUrl?: string; uploadedFile?: { file: string; mimeType: string } }) {
  const job = q(db).get('SELECT * FROM video_analyses WHERE id = ?', analysisId)!;
  const game = q(db).get('SELECT * FROM games WHERE id = ?', job.game_id)!;
  const ai = gemini();
  let localFile: string | null = input.uploadedFile?.file ?? null;
  let remoteName: string | null = null;
  try {
    let videoPart: Part;
    if (input.youtubeUrl) {
      videoPart = { fileData: { fileUri: input.youtubeUrl } };
    } else {
      let mimeType = input.uploadedFile?.mimeType ?? 'video/mp4';
      if (input.driveId) {
        setStage(db, analysisId, 'downloading', 'Downloading the video from Google Drive…');
        const dl = await downloadDrive(input.driveId);
        localFile = dl.file;
        mimeType = dl.mimeType;
      }
      setStage(db, analysisId, 'uploading', 'Sending the video to Gemini…');
      let uploaded = await ai.files.upload({ file: localFile!, config: { mimeType, displayName: `benchiq-game-${game.id}` } });
      remoteName = uploaded.name!;
      fs.rmSync(localFile!, { force: true });
      localFile = null;
      setStage(db, analysisId, 'processing', 'Gemini is processing the video (this can take a few minutes for long videos)…');
      const started = Date.now();
      while (uploaded.state === FileState.PROCESSING) {
        if (Date.now() - started > 20 * 60_000) throw new Error('Gemini took too long to process the video. Try a shorter clip.');
        await new Promise((r) => setTimeout(r, 5000));
        uploaded = await ai.files.get({ name: remoteName });
      }
      if (uploaded.state === FileState.FAILED) throw new Error(`Gemini couldn’t read this video${uploaded.error?.message ? `: ${uploaded.error.message}` : '.'}`);
      videoPart = createPartFromUri(uploaded.uri!, uploaded.mimeType ?? mimeType);
    }

    setStage(db, analysisId, 'analyzing', 'Watching the game and identifying key moments…');
    const prompt = buildPrompt(db, job.team_id, game, job.our_color);
    let res;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await ai.models.generateContent({
          model: videoModel(),
          contents: [{ role: 'user', parts: [videoPart, { text: prompt }] }],
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: RESPONSE_SCHEMA,
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_LOW, // ~1/4 the tokens; enough to read play shape
            maxOutputTokens: 16000,
          },
        });
        break;
      } catch (e) {
        if (!(e instanceof GoogleApiError) || (e.status !== 503 && e.status !== 500) || attempt >= 2) throw e;
        setStage(db, analysisId, 'analyzing', 'Gemini is busy — retrying…');
        await new Promise((r) => setTimeout(r, 4000 * 2 ** attempt));
      }
    }
    const parsed = parseAnalysis(res.text ?? '');
    setStage(db, analysisId, 'done', `Found ${parsed.moments.length} moments.`, {
      summary: parsed.summary,
      footage_note: parsed.footage_note,
      suggestions: parsed.moments.map((m) => ({ ...m, status: 'pending' })),
      model: res.modelVersion ?? videoModel(),
    });
  } catch (e) {
    setStage(db, analysisId, 'failed', 'Analysis failed.', { error: friendlyError(e) });
  } finally {
    if (localFile) fs.rmSync(localFile, { force: true });
    if (remoteName) ai.files.delete({ name: remoteName }).catch(() => {});
  }
}

export interface Moment {
  time: string;
  seconds: number;
  focus_area: FocusArea;
  kind: 'issue' | 'positive';
  severity: number;
  description: string;
  jersey_numbers: string[];
  confidence: 'low' | 'medium' | 'high';
}

export function toSeconds(t: string): number {
  const parts = String(t).trim().split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** Validate model output defensively; drop anything malformed. */
export function parseAnalysis(text: string): { summary: string; footage_note: string; moments: Moment[] } {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    raw = m ? JSON.parse(m[0]) : {};
  }
  const moments: Moment[] = (Array.isArray(raw.moments) ? raw.moments : [])
    .filter((m: any) => m && typeof m.description === 'string' && (FOCUS_AREAS as readonly string[]).includes(m.focus_area) && (m.kind === 'issue' || m.kind === 'positive'))
    .slice(0, MAX_MOMENTS)
    .map((m: any) => ({
      time: String(m.time ?? '0:00').slice(0, 10),
      seconds: toSeconds(m.time ?? '0'),
      focus_area: m.focus_area,
      kind: m.kind,
      severity: Math.min(3, Math.max(1, Math.round(Number(m.severity) || 2))),
      description: m.description.slice(0, 1000),
      jersey_numbers: (Array.isArray(m.jersey_numbers) ? m.jersey_numbers : []).map((n: unknown) => String(n).replace(/\D/g, '')).filter(Boolean).slice(0, 6),
      confidence: ['low', 'medium', 'high'].includes(m.confidence) ? m.confidence : 'medium',
    }))
    .sort((a: Moment, b: Moment) => a.seconds - b.seconds);
  return { summary: String(raw.summary ?? '').slice(0, 2000), footage_note: String(raw.footage_note ?? '').slice(0, 1000), moments };
}

function friendlyError(e: unknown): string {
  if (e instanceof GoogleApiError) {
    if (e.status === 429) return 'Google’s free Gemini limit was reached (video uses a lot of it). Wait a while — or until tomorrow for the daily limit — and try again, or use a shorter clip.';
    if (e.status === 400 && /youtube|video|url/i.test(e.message)) return `Gemini couldn’t open this video. YouTube videos must be public (or unlisted, where Google allows it). Details: ${e.message.slice(0, 200)}`;
    if (e.status === 400 && /token|too long|exceeds/i.test(e.message)) return 'This video is too long for one analysis. Split the game into periods and analyze each one.';
    if (e.status === 401 || e.status === 403) return 'Google rejected the API key. Check GEMINI_API_KEY in your server settings.';
    if (e.status === 503 || e.status === 500) return 'Google’s AI service is busy right now. Try again in a few minutes.';
    return `Gemini error: ${e.message.slice(0, 300)}`;
  }
  return e instanceof Error ? e.message : 'Unknown error';
}
