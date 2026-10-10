import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Target, Trash2, ThumbsUp, AlertTriangle, Video } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { Game, Observation, Player, Priority } from '../lib/types';
import { FOCUS_AREAS, FOCUS_AREA_LABELS, type FocusArea } from '../../shared/domain';
import { fmtDateLong, fmtTime } from '../lib/format';
import { Badge, Button, Card, ConfirmButton, ErrorNote, Field, Input, Modal, NotYet, ResultBadge, Select, Spinner, Textarea } from '../components/ui';
import { GameFormModal, PriorityFormModal } from './Games';

export default function GameDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useTeam();
  const { data: g, isLoading, error } = useTeamQuery<Game>(`/games/${id}`);
  const { data: players = [] } = useTeamQuery<Player[]>('/players');
  const { data: priorities = [] } = useTeamQuery<Priority[]>('/priorities');
  const [editing, setEditing] = useState(false);
  const [editObs, setEditObs] = useState<Observation | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [priorityFrom, setPriorityFrom] = useState<Observation[] | null>(null);
  const del = useTeamMutation((b) => api.del(`${b}/games/${id}`), { toast: 'Game deleted', onSuccess: () => navigate('/games') });

  if (isLoading) return <Spinner />;
  if (error || !g) return <ErrorNote error={error} />;
  const obs = g.observations ?? [];
  const issues = obs.filter((o) => o.kind === 'issue');
  const positives = obs.filter((o) => o.kind === 'positive');
  const toggleSel = (oid: number) => setSelected((s) => (s.includes(oid) ? s.filter((x) => x !== oid) : [...s, oid]));

  return (
    <div>
      <Link to="/games" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Game Review
      </Link>
      <div className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {g.game_type} · {g.venue}
          </div>
          <h1 className="text-4xl font-semibold">
            {g.venue === 'away' ? '@' : 'vs'} {g.opponent}
          </h1>
          <div className="mt-1 text-sm text-muted">
            {fmtDateLong(g.played_at)} {fmtTime(g.played_at)} {g.location ? `· ${g.location}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {g.result ? (
            <div className="text-center">
              <div className="font-display text-5xl font-bold tabular-nums">
                {g.goals_for}–{g.goals_against}
              </div>
              <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted">
                <ResultBadge result={g.result} />
                {g.overtime ? 'OT' : ''}
                {g.shots_for != null && `Shots ${g.shots_for}–${g.shots_against}`}
              </div>
            </div>
          ) : (
            <ResultBadge result={null} />
          )}
          {canEdit && (
            <div className="flex flex-col gap-1">
              <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
                {g.result ? 'Edit' : 'Enter result'}
              </Button>
              <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete game" icon={<Trash2 className="h-3.5 w-3.5" />}>
                Delete
              </ConfirmButton>
            </div>
          )}
        </div>
      </div>
      {g.summary && <p className="mb-6 text-muted">{g.summary}</p>}

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <div className="space-y-4">
          {canEdit && <ObservationForm gameId={g.id} players={players} priorities={priorities} />}
          <NotYet phase="Phase 3">
            <Video className="mr-1 inline h-3.5 w-3.5" /> Attaching video clips with timestamps and drawing annotations to observations.
          </NotYet>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Issues" value={issues.length} tone="accent" />
            <MiniStat label="Positives" value={positives.length} tone="good" />
            <MiniStat label="Linked to priorities" value={obs.filter((o) => o.priority_id).length} />
            <MiniStat label="Players tagged" value={new Set(obs.flatMap((o) => o.players.map((p) => p.id))).size} />
          </div>
          {selected.length > 0 && canEdit && (
            <div className="sticky top-20 z-10 flex items-center gap-3 rounded-xl border border-accent/50 bg-surface p-3 shadow-xl">
              <span className="text-sm">{selected.length} selected</span>
              <Button size="sm" variant="primary" icon={<Target className="h-4 w-4" />} onClick={() => setPriorityFrom(obs.filter((o) => selected.includes(o.id)))}>
                Create development priority
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
            </div>
          )}
          {obs.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">No observations yet. Log tactical observations, mistakes and positive plays with the form{canEdit ? ' on the left' : ''}.</p>
            </Card>
          ) : (
            FOCUS_AREAS.filter((f) => obs.some((o) => o.focus_area === f)).map((f) => (
              <Card key={f} title={FOCUS_AREA_LABELS[f]} actions={<span className="text-xs text-muted">{obs.filter((o) => o.focus_area === f && o.kind === 'issue').length} issues · {obs.filter((o) => o.focus_area === f && o.kind === 'positive').length} positives</span>} bodyClass="p-0">
                <ul className="divide-y divide-line">
                  {obs
                    .filter((o) => o.focus_area === f)
                    .map((o) => (
                      <li key={o.id} className="flex gap-3 px-4 py-3">
                        {canEdit && <input type="checkbox" className="mt-1 accent-[rgb(var(--accent))]" checked={selected.includes(o.id)} onChange={() => toggleSel(o.id)} aria-label="Select observation" />}
                        <div className="mt-0.5">{o.kind === 'issue' ? <AlertTriangle className="h-4 w-4 text-accent" /> : <ThumbsUp className="h-4 w-4 text-good" />}</div>
                        <div className="min-w-0 flex-1 text-sm">
                          <p>{o.description}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                            {(o.period || o.game_time) && (
                              <span>
                                {o.period ? `P${o.period}` : ''} {o.game_time}
                              </span>
                            )}
                            {o.kind === 'issue' && <Badge tone={o.severity === 3 ? 'accent' : o.severity === 2 ? 'warn' : 'neutral'}>{['', 'Minor', 'Moderate', 'Major'][o.severity]}</Badge>}
                            {o.players.map((p) => (
                              <Link key={p.id} to={`/players/${p.id}`}>
                                <Badge>
                                  #{p.number} {p.last_name}
                                </Badge>
                              </Link>
                            ))}
                            {o.priority_id ? (
                              <Link to={`/priorities/${o.priority_id}`}>
                                <Badge tone="accent">
                                  <Target className="h-3 w-3" /> {o.priority_title}
                                </Badge>
                              </Link>
                            ) : (
                              o.kind === 'issue' &&
                              canEdit && (
                                <button onClick={() => setPriorityFrom([o])} className="text-accent hover:underline">
                                  → Make priority
                                </button>
                              )
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <button onClick={() => setEditObs(o)} className="self-start rounded p-1 text-faint hover:text-ink" aria-label="Edit observation">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                </ul>
              </Card>
            ))
          )}
        </div>
      </div>

      {editing && <GameFormModal game={g} onClose={() => setEditing(false)} />}
      {editObs && <ObservationEditModal obs={editObs} players={players} priorities={priorities} onClose={() => setEditObs(null)} />}
      {priorityFrom && (
        <PriorityFormModal
          onClose={() => {
            setPriorityFrom(null);
            setSelected([]);
          }}
          observationIds={priorityFrom.map((o) => o.id)}
          initial={{
            focus_area: priorityFrom[0].focus_area,
            title: `${FOCUS_AREA_LABELS[priorityFrom[0].focus_area as FocusArea]}: `,
            description: priorityFrom.map((o) => o.description).join('\n'),
            player_id: priorityFrom[0].focus_area === 'individual' && priorityFrom[0].players.length === 1 ? priorityFrom[0].players[0].id : null,
          }}
        />
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: 'accent' | 'good' }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={`font-display text-2xl font-semibold ${tone === 'accent' ? 'text-accent' : tone === 'good' ? 'text-good' : ''}`}>{value}</div>
    </div>
  );
}

type ObsForm = { focus_area: string; kind: 'issue' | 'positive'; severity: number; period: string; game_time: string; description: string; player_ids: number[]; priority_id: string };

function ObsFields({ v, setV, players, priorities }: { v: ObsForm; setV: (v: ObsForm) => void; players: Player[]; priorities: Priority[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-raised p-1">
        {(['issue', 'positive'] as const).map((k) => (
          <button key={k} onClick={() => setV({ ...v, kind: k })} className={`rounded-md py-1.5 text-sm font-medium ${v.kind === k ? (k === 'issue' ? 'bg-accent text-accent-ink' : 'bg-good text-white') : 'text-muted'}`}>
            {k === 'issue' ? 'Issue / mistake' : 'Positive play'}
          </button>
        ))}
      </div>
      <div>
        <span className="label">Category</span>
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_AREAS.map((f) => (
            <button key={f} onClick={() => setV({ ...v, focus_area: f })} className={`chip border py-1 ${v.focus_area === f ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'}`}>
              {FOCUS_AREA_LABELS[f]}
            </button>
          ))}
        </div>
      </div>
      <Field label="What happened?">
        <Textarea rows={3} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder={v.kind === 'issue' ? 'e.g. Wingers left the zone early; D had no outlet' : 'e.g. Clean breakout up the strong side'} />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Period">
          <Select value={v.period} onChange={(e) => setV({ ...v, period: e.target.value })}>
            <option value="">—</option>
            <option value="1">1st</option>
            <option value="2">2nd</option>
            <option value="3">3rd</option>
            <option value="OT">OT</option>
          </Select>
        </Field>
        <Field label="Time">
          <Input placeholder="12:40" value={v.game_time} onChange={(e) => setV({ ...v, game_time: e.target.value })} />
        </Field>
        {v.kind === 'issue' && (
          <Field label="Severity">
            <Select value={v.severity} onChange={(e) => setV({ ...v, severity: Number(e.target.value) })}>
              <option value={1}>Minor</option>
              <option value={2}>Moderate</option>
              <option value={3}>Major</option>
            </Select>
          </Field>
        )}
      </div>
      <div>
        <span className="label">Players involved (optional — leave empty for whole team)</span>
        <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto scroll-thin">
          {players
            .filter((p) => p.status !== 'inactive')
            .map((p) => {
              const on = v.player_ids.includes(p.id);
              return (
                <button key={p.id} onClick={() => setV({ ...v, player_ids: on ? v.player_ids.filter((x) => x !== p.id) : [...v.player_ids, p.id] })} className={`chip border ${on ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'}`}>
                  #{p.number} {p.last_name}
                </button>
              );
            })}
        </div>
      </div>
      <Field label="Link to development priority">
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
  );
}

function ObservationForm({ gameId, players, priorities }: { gameId: number; players: Player[]; priorities: Priority[] }) {
  const blank: ObsForm = { focus_area: 'breakout', kind: 'issue', severity: 2, period: '', game_time: '', description: '', player_ids: [], priority_id: '' };
  const [v, setV] = useState<ObsForm>(blank);
  // Suggest the matching active priority when the category changes.
  const setWithSuggestion = (n: ObsForm) => {
    if (n.focus_area !== v.focus_area && !n.priority_id) {
      const match = priorities.find((p) => p.status !== 'resolved' && !p.player_id && p.focus_area === n.focus_area);
      if (match) n = { ...n, priority_id: String(match.id) };
    }
    setV(n);
  };
  const add = useTeamMutation((b) => api.post(`${b}/games/${gameId}/observations`, { ...v, priority_id: v.priority_id || null }), {
    toast: 'Observation logged',
    onSuccess: () => setV({ ...blank, focus_area: v.focus_area, kind: v.kind, period: v.period, priority_id: v.priority_id }),
  });
  return (
    <Card title="Log observation" icon={<Plus className="h-4 w-4" />}>
      <ObsFields v={v} setV={setWithSuggestion} players={players} priorities={priorities} />
      <Button className="mt-4 w-full" variant="primary" disabled={!v.description.trim()} loading={add.isPending} onClick={() => add.mutate(undefined)}>
        Add observation
      </Button>
    </Card>
  );
}

function ObservationEditModal({ obs, players, priorities, onClose }: { obs: Observation; players: Player[]; priorities: Priority[]; onClose: () => void }) {
  const [v, setV] = useState<ObsForm>({
    focus_area: obs.focus_area,
    kind: obs.kind,
    severity: obs.severity,
    period: obs.period ?? '',
    game_time: obs.game_time ?? '',
    description: obs.description,
    player_ids: obs.players.map((p) => p.id),
    priority_id: obs.priority_id?.toString() ?? '',
  });
  const save = useTeamMutation((b) => api.patch(`${b}/observations/${obs.id}`, { ...v, priority_id: v.priority_id || null }), { toast: 'Observation updated', onSuccess: onClose });
  const del = useTeamMutation((b) => api.del(`${b}/observations/${obs.id}`), { toast: 'Observation deleted', onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title="Edit observation"
      footer={
        <>
          <div className="mr-auto">
            <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete" icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </ConfirmButton>
          </div>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save
          </Button>
        </>
      }
    >
      <ObsFields v={v} setV={setV} players={players} priorities={priorities} />
    </Modal>
  );
}

