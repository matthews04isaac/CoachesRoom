import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, CloudUpload, ExternalLink, Film, Link2, Loader2, Play, Sparkles, Trash2, X, AlertTriangle, ThumbsUp, Pencil } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery, useToast } from '../lib/session';
import type { Game, Player, Priority } from '../lib/types';
import { FOCUS_AREAS, FOCUS_AREA_LABELS, type FocusArea } from '../../shared/domain';
import { Badge, Button, Card, ConfirmButton, Field, Input, Select, Textarea } from './ui';

interface Suggestion {
  time: string;
  seconds: number;
  focus_area: string;
  kind: 'issue' | 'positive';
  severity: number;
  description: string;
  jersey_numbers: string[];
  confidence: 'low' | 'medium' | 'high';
  status: 'pending' | 'accepted' | 'dismissed';
  observation_id?: number;
}
export interface VideoAnalysisRow {
  id: number;
  source: 'drive' | 'youtube' | 'upload';
  source_url: string | null;
  our_color: string;
  status: 'queued' | 'downloading' | 'uploading' | 'processing' | 'analyzing' | 'done' | 'failed';
  stage_message: string;
  summary: string;
  footage_note: string;
  suggestions: Suggestion[];
  model: string | null;
  error: string | null;
  created_at: string;
}
interface VideoState {
  available: boolean;
  video_url: string | null;
  max_bytes: number;
  analyses: VideoAnalysisRow[];
}

const STAGES: VideoAnalysisRow['status'][] = ['downloading', 'uploading', 'processing', 'analyzing', 'done'];
const STAGE_LABEL: Record<string, string> = { downloading: 'Download', uploading: 'Send to Gemini', processing: 'Process video', analyzing: 'Analyze', done: 'Done' };
const running = (a?: VideoAnalysisRow) => !!a && a.status !== 'done' && a.status !== 'failed';

export function youTubeId(url: string | null) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/(?:shorts|live|embed)\/)([\w-]{11})/);
  return m ? m[1] : null;
}
export const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export function VideoAnalysisPanel({ game, players, priorities }: { game: Game; players: Player[]; priorities: Priority[] }) {
  const { canEdit, team } = useTeam();
  const qc = useQueryClient();
  const path = `/games/${game.id}/video`;
  const { data, refetch } = useTeamQuery<VideoState>(path, {
    refetchInterval: (q) => (running((q.state.data as VideoState | undefined)?.analyses[0]) ? 4000 : false),
  });
  const latest = data?.analyses[0];
  const wasRunning = useRef(false);
  useEffect(() => {
    // When a job finishes, refresh the rest of the game page.
    if (wasRunning.current && latest && !running(latest)) qc.invalidateQueries({ queryKey: ['team', team?.id] });
    wasRunning.current = running(latest);
  }, [latest, qc, team?.id]);

  const [seek, setSeek] = useState<number | null>(null);
  const ytId = youTubeId(latest?.source === 'youtube' ? latest.source_url : data?.video_url ?? null);

  if (!data) return null;
  return (
    <Card
      className="mb-6"
      title="Game video & AI analysis"
      icon={<Film className="h-4 w-4" />}
      actions={<Badge tone="info"><Sparkles className="h-3 w-3" /> Gemini · AI suggestions you approve</Badge>}
    >
      {!data.available ? (
        <p className="text-sm text-muted">
          Video analysis uses Google Gemini. Set <code className="rounded bg-raised px-1 text-ink">GEMINI_API_KEY</code> on the server (Render → your service → Environment) to turn it on.
        </p>
      ) : (
        <div className="space-y-5">
          {canEdit && !running(latest) && <StartAnalysis game={game} maxBytes={data.max_bytes} onStarted={() => refetch()} hasPrevious={!!latest} />}
          {latest && running(latest) && <Progress a={latest} />}
          {latest?.status === 'failed' && (
            <div className="flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div>
                <div className="font-semibold">The analysis didn’t finish</div>
                <p className="text-muted">{latest.error}</p>
              </div>
            </div>
          )}
          {ytId && (latest?.status === 'done' || seek !== null) && (
            <div className="aspect-video overflow-hidden rounded-xl border border-line bg-black">
              <iframe
                key={seek ?? 'start'}
                src={`https://www.youtube-nocookie.com/embed/${ytId}?start=${seek ?? 0}${seek !== null ? '&autoplay=1' : ''}`}
                title="Game video"
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {latest?.status === 'done' && <Results a={latest} game={game} players={players} priorities={priorities} onSeek={ytId ? setSeek : undefined} />}
          {data.analyses.length > 1 && (
            <p className="text-xs text-faint">
              {data.analyses.length - 1} earlier analys{data.analyses.length > 2 ? 'es' : 'is'} for this game. Starting a new one shows its results here.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function StartAnalysis({ game, maxBytes, onStarted, hasPrevious }: { game: Game; maxBytes: number; onStarted: () => void; hasPrevious: boolean }) {
  const { team } = useTeam();
  const toast = useToast();
  const [mode, setMode] = useState<'link' | 'upload'>('link');
  const [url, setUrl] = useState('');
  const [color, setColor] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [open, setOpen] = useState(!hasPrevious);
  const start = useTeamMutation((b) => api.post(`${b}/games/${game.id}/video/analyze`, { url, our_color: color }), { onSuccess: onStarted });

  const upload = () => {
    if (!file || !team) return;
    if (file.size > maxBytes) return toast(`That file is ${(file.size / 1024 ** 3).toFixed(2)} GB — the limit is 2 GB. Split it into periods or export at 720p.`, 'error');
    // XHR (not fetch) so we can show upload progress for large files.
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/teams/${team.id}/games/${game.id}/video/upload`);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    xhr.setRequestHeader('X-Our-Color', encodeURIComponent(color));
    xhr.upload.onprogress = (e) => e.lengthComputable && setUploadPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setUploadPct(null);
      if (xhr.status >= 200 && xhr.status < 300) onStarted();
      else {
        let msg = `Upload failed (${xhr.status})`;
        try {
          msg = JSON.parse(xhr.responseText).error ?? msg;
        } catch {
          /* keep default */
        }
        toast(msg, 'error');
      }
    };
    xhr.onerror = () => {
      setUploadPct(null);
      toast('Upload failed — check your connection and try again.', 'error');
    };
    setUploadPct(0);
    xhr.send(file);
  };

  if (!open)
    return (
      <Button size="sm" icon={<Film className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Analyze another video
      </Button>
    );

  return (
    <div className="rounded-xl border border-line bg-raised/40 p-4">
      <div className="mb-3 flex gap-1 rounded-lg bg-raised p-1 sm:w-fit">
        {(
          [
            ['link', 'Google Drive or YouTube link', <Link2 key="l" className="h-4 w-4" />],
            ['upload', 'Upload a file', <CloudUpload key="u" className="h-4 w-4" />],
          ] as const
        ).map(([m, label, icon]) => (
          <button key={m} onClick={() => setMode(m)} className={clsx('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', mode === m ? 'bg-surface text-ink shadow' : 'text-muted')}>
            {icon} {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_200px_auto] md:items-end">
        {mode === 'link' ? (
          <Field label="Video link">
            <Input placeholder="https://drive.google.com/file/d/… or https://youtu.be/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        ) : (
          <Field label="Video file (MP4, MOV — up to 2 GB)">
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="input file:mr-3 file:rounded file:border-0 file:bg-raised file:px-2 file:py-1 file:text-ink" />
          </Field>
        )}
        <Field label="Our jersey colour">
          <Input placeholder="e.g. red, white" value={color} onChange={(e) => setColor(e.target.value)} />
        </Field>
        {mode === 'link' ? (
          <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} disabled={!url.trim()} loading={start.isPending} onClick={() => start.mutate(undefined)}>
            Analyze game
          </Button>
        ) : (
          <Button variant="primary" icon={<CloudUpload className="h-4 w-4" />} disabled={!file || uploadPct !== null} onClick={upload}>
            {uploadPct !== null ? `Uploading ${uploadPct}%` : 'Upload & analyze'}
          </Button>
        )}
      </div>
      {uploadPct !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-accent transition-all" style={{ width: `${uploadPct}%` }} />
        </div>
      )}
      <ul className="mt-3 space-y-1 text-xs text-muted">
        <li>• Google Drive: set sharing to <strong className="text-ink">Anyone with the link → Viewer</strong>. YouTube: the video must be public or unlisted.</li>
        <li>• Gemini accepts up to 2 GB per video. Full games are often bigger — one video per period works best and gives more detailed results.</li>
        <li>• Expect a few minutes per period. The AI suggests moments; nothing is added to your observations until you keep it.</li>
      </ul>
    </div>
  );
}

function Progress({ a }: { a: VideoAnalysisRow }) {
  const steps = a.source === 'drive' ? STAGES : a.source === 'youtube' ? (['analyzing', 'done'] as const) : STAGES.slice(1);
  const current = Math.max(0, (steps as readonly string[]).indexOf(a.status));
  return (
    <div className="rounded-xl border border-info/40 bg-info/5 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin text-info" /> {a.stage_message || 'Starting…'}
      </div>
      <ol className="mt-3 flex flex-wrap gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s} className={clsx('flex items-center gap-1.5 rounded-full border px-2.5 py-1', i < current ? 'border-good/40 text-good' : i === current ? 'border-info/50 text-info' : 'border-line text-faint')}>
            {i < current ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            {STAGE_LABEL[s]}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">You can leave this page — the analysis keeps running and the results will be here when you come back.</p>
    </div>
  );
}

function Results({ a, game, players, priorities, onSeek }: { a: VideoAnalysisRow; game: Game; players: Player[]; priorities: Priority[]; onSeek?: (s: number) => void }) {
  const { canEdit } = useTeam();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const del = useTeamMutation((b) => api.del(`${b}/video-analyses/${a.id}`), { toast: 'Analysis deleted' });
  const act = useTeamMutation((b, v: { index: number; action: 'accept' | 'dismiss'; overrides?: Record<string, unknown> }) => api.post(`${b}/video-analyses/${a.id}/suggestions/${v.index}`, v));
  const toast = useToast();
  const pending = a.suggestions.filter((s) => s.status === 'pending');
  const accepted = a.suggestions.filter((s) => s.status === 'accepted').length;
  const list = a.suggestions.map((s, index) => ({ s, index })).filter(({ s }) => filter === 'all' || s.status === 'pending');

  const keepAllConfident = async () => {
    const targets = a.suggestions.map((s, index) => ({ s, index })).filter(({ s }) => s.status === 'pending' && s.confidence === 'high');
    for (const t of targets) {
      try {
        await act.mutateAsync({ index: t.index, action: 'accept' });
      } catch (e) {
        if (e instanceof ApiError) break;
      }
    }
    toast(`Kept ${targets.length} high-confidence moments`);
  };

  return (
    <div className="space-y-4">
      {(a.summary || a.footage_note) && (
        <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
          {a.summary && (
            <div className="rounded-lg bg-raised p-3 text-sm">
              <div className="label">AI summary</div>
              <p>{a.summary}</p>
            </div>
          )}
          {a.footage_note && (
            <div className="rounded-lg bg-raised p-3 text-sm text-muted">
              <div className="label">About the footage</div>
              <p>{a.footage_note}</p>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{a.suggestions.length} moments found</span>
        <span className="text-xs text-muted">
          · {pending.length} to review · {accepted} kept
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select className="h-8 w-auto py-0 text-xs" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Show">
            <option value="pending">Show: to review</option>
            <option value="all">Show: all</option>
          </Select>
          {canEdit && pending.some((s) => s.confidence === 'high') && (
            <Button size="sm" icon={<Check className="h-4 w-4" />} loading={act.isPending} onClick={keepAllConfident}>
              Keep all high-confidence
            </Button>
          )}
          {canEdit && (
            <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete analysis" icon={<Trash2 className="h-3.5 w-3.5" />}>
              <span className="sr-only">Delete analysis</span>
            </ConfirmButton>
          )}
        </div>
      </div>
      {a.suggestions.length === 0 && <p className="text-sm text-muted">Gemini didn’t identify any coaching moments in this video. Check “About the footage” above for why.</p>}
      {list.length === 0 && a.suggestions.length > 0 && <p className="text-sm text-muted">All moments reviewed. Kept moments are in the observation list below.</p>}
      <ul className="space-y-2">
        {list.map(({ s, index }) => (
          <SuggestionRow key={index} s={s} game={game} players={players} priorities={priorities} source={a.source} sourceUrl={a.source_url} onSeek={onSeek} busy={act.isPending} onAct={(action, overrides) => act.mutate({ index, action, overrides })} canEdit={canEdit} />
        ))}
      </ul>
      <p className="text-[11px] text-faint">
        AI-generated by {a.model ?? 'Gemini'} at low video resolution. It can misread plays and jersey numbers — review each moment before keeping it.
      </p>
    </div>
  );
}

function SuggestionRow({
  s,
  players,
  priorities,
  source,
  sourceUrl,
  onSeek,
  onAct,
  busy,
  canEdit,
}: {
  s: Suggestion;
  game: Game;
  players: Player[];
  priorities: Priority[];
  source: string;
  sourceUrl: string | null;
  onSeek?: (s: number) => void;
  onAct: (action: 'accept' | 'dismiss', overrides?: Record<string, unknown>) => void;
  busy: boolean;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const matched = s.jersey_numbers.map((n) => ({ n, p: players.find((p) => String(p.number) === n) }));
  const [v, setV] = useState({
    focus_area: s.focus_area,
    kind: s.kind,
    severity: s.severity,
    description: s.description,
    player_ids: matched.filter((m) => m.p).map((m) => m.p!.id),
    priority_id: String(priorities.find((p) => p.status !== 'resolved' && !p.player_id && p.focus_area === s.focus_area)?.id ?? ''),
  });
  const timeButton = onSeek ? (
    <button onClick={() => onSeek(s.seconds)} className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 font-mono text-xs hover:bg-accent/15 hover:text-accent" title="Play from here">
      <Play className="h-3 w-3" /> {fmtClock(s.seconds)}
    </button>
  ) : source === 'drive' && sourceUrl ? (
    <a href={sourceUrl} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 rounded-md bg-raised px-2 py-1 font-mono text-xs hover:text-accent" title="Open the video in Google Drive, then skip to this time">
      {fmtClock(s.seconds)} <ExternalLink className="h-3 w-3" />
    </a>
  ) : (
    <span className="rounded-md bg-raised px-2 py-1 font-mono text-xs">{fmtClock(s.seconds)}</span>
  );

  return (
    <li className={clsx('rounded-lg border p-3', s.status === 'accepted' ? 'border-good/40 bg-good/5' : s.status === 'dismissed' ? 'border-line opacity-50' : 'border-line')}>
      <div className="flex flex-wrap items-start gap-3">
        {timeButton}
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            {s.kind === 'issue' ? <AlertTriangle className="h-3.5 w-3.5 text-accent" /> : <ThumbsUp className="h-3.5 w-3.5 text-good" />}
            <Badge tone="info">{FOCUS_AREA_LABELS[s.focus_area as FocusArea] ?? s.focus_area}</Badge>
            <Badge tone={s.confidence === 'high' ? 'good' : s.confidence === 'low' ? 'warn' : 'neutral'}>{s.confidence} confidence</Badge>
            {matched.map(({ n, p }) => (
              <Badge key={n}>{p ? `#${n} ${p.last_name}` : `#${n} (not on roster)`}</Badge>
            ))}
          </div>
          <p className="mt-1.5">{s.description}</p>
        </div>
        {s.status === 'accepted' && (
          <span className="flex items-center gap-1 text-xs text-good">
            <Check className="h-3.5 w-3.5" /> Kept — added to observations
          </span>
        )}
        {s.status === 'dismissed' && <span className="text-xs text-muted">Dismissed</span>}
        {s.status === 'pending' && canEdit && !editing && (
          <div className="flex gap-1">
            <Button size="sm" variant="primary" icon={<Check className="h-3.5 w-3.5" />} disabled={busy} onClick={() => onAct('accept', { player_ids: v.player_ids, priority_id: v.priority_id || null })}>
              Keep
            </Button>
            <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)} aria-label="Edit before keeping" />
            <Button size="sm" variant="ghost" icon={<X className="h-3.5 w-3.5" />} disabled={busy} onClick={() => onAct('dismiss')} aria-label="Dismiss" />
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Category">
              <Select value={v.focus_area} onChange={(e) => setV({ ...v, focus_area: e.target.value })}>
                {FOCUS_AREAS.map((f) => (
                  <option key={f} value={f}>
                    {FOCUS_AREA_LABELS[f]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as Suggestion['kind'] })}>
                <option value="issue">Issue</option>
                <option value="positive">Positive play</option>
              </Select>
            </Field>
            <Field label="Link to priority">
              <Select value={v.priority_id} onChange={(e) => setV({ ...v, priority_id: e.target.value })}>
                <option value="">None</option>
                {priorities
                  .filter((p) => p.status !== 'resolved')
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label="Observation">
            <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <div>
            <span className="label">Players involved</span>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto scroll-thin">
              {players
                .filter((p) => p.status !== 'inactive')
                .map((p) => {
                  const on = v.player_ids.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => setV({ ...v, player_ids: on ? v.player_ids.filter((x) => x !== p.id) : [...v.player_ids, p.id] })} className={clsx('chip border', on ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink')}>
                      #{p.number} {p.last_name}
                    </button>
                  );
                })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={busy} onClick={() => onAct('accept', { ...v, priority_id: v.priority_id || null })}>
              Keep with changes
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
