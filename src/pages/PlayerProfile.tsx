import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Pencil, Plus, Target, Trash2, TrendingUp, TrendingDown, MessageSquarePlus, Dumbbell } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { DrillRecommendation, Evaluation, Goal, Note, Observation, Player, Priority, SkillScore } from '../lib/types';
import { FOCUS_AREAS, FOCUS_AREA_LABELS, POSITION_LABELS, RATING_LABELS, type EvalCategory, type Position } from '../../shared/domain';
import { fmtDate, fmtDateLong, todayStr } from '../lib/format';
import { Badge, Button, Card, ConfirmButton, Empty, ErrorNote, Field, Input, LinkButton, Modal, PlayerAvatar, ProgressBar, RatingDots, Select, Spinner, Tabs, Textarea } from '../components/ui';
import { FocusBadge, StatusBadge } from '../components/hockey';
import { EvalHistoryChart, RatingRadar } from '../components/charts';
import { PlayerFormModal } from '../components/PlayerForm';

export interface PlayerProfileData extends Player {
  summary: { latestId: number; evaluatedOn: string; average: number | null; categories: SkillScore[]; strengths: SkillScore[]; weaknesses: SkillScore[] } | null;
  evaluations: Evaluation[];
  goals: Goal[];
  coach_notes: Note[];
  observations: Observation[];
  priorities: Priority[];
  recommendations: DrillRecommendation[];
  categories: EvalCategory[];
}

export default function PlayerProfile() {
  const { id } = useParams();
  const { canEdit } = useTeam();
  const [params, setParams] = useSearchParams();
  const { data: p, isLoading, error } = useTeamQuery<PlayerProfileData>(`/players/${id}`);
  const [tab, setTab] = useState<'overview' | 'evaluations' | 'goals' | 'notes'>('overview');
  const [evalOpen, setEvalOpen] = useState<Evaluation | 'new' | null>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (params.get('evaluate') === '1' && canEdit) {
      setEvalOpen('new');
      setParams({}, { replace: true });
    }
  }, [params, canEdit, setParams]);

  if (isLoading) return <Spinner />;
  if (error || !p) return <ErrorNote error={error} />;
  const [latest, previous] = p.evaluations;
  const radar = p.categories.map((c) => ({ label: c.label, latest: latest?.ratings[c.key] ?? null, previous: previous?.ratings[c.key] ?? null }));
  const history = [...p.evaluations].reverse().map((e) => {
    const vals = Object.values(e.ratings);
    return { date: e.evaluated_on, label: e.label, average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 };
  });

  return (
    <div>
      <Link to="/players" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Player Development
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <PlayerAvatar player={p} size="lg" />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            #{p.number ?? '–'} · {POSITION_LABELS[p.position as Position]}
          </div>
          <h1 className="text-4xl font-semibold">
            {p.first_name} {p.last_name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {p.shoots && <span>Shoots {p.shoots}</span>}
            {p.birth_year && <span>· Born {p.birth_year}</span>}
            {p.status !== 'active' && <Badge tone="warn">{p.status}</Badge>}
            {p.summary && <span>· Last evaluated {fmtDate(p.summary.evaluatedOn)}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton to={`/players/${p.id}/report`} icon={<FileText className="h-4 w-4" />}>
            Report / PDF
          </LinkButton>
          {canEdit && (
            <>
              <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="primary" icon={<TrendingUp className="h-4 w-4" />} onClick={() => setEvalOpen('new')}>
                New evaluation
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'evaluations', label: `Evaluations (${p.evaluations.length})` },
          { value: 'goals', label: `Goals (${p.goals.filter((g) => g.status === 'active').length})` },
          { value: 'notes', label: `Notes & observations (${p.coach_notes.length + p.observations.length})` },
        ]}
      />

      {tab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Skill profile" className="lg:col-span-2" actions={p.summary && <span className="font-display text-2xl font-semibold">{p.summary.average}<span className="text-sm text-muted"> / 5 avg</span></span>}>
            {latest ? (
              <div className="grid gap-4 md:grid-cols-2">
                <RatingRadar data={radar} hasPrevious={!!previous} />
                <ul className="space-y-2 self-center">
                  {p.summary!.categories.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted">{c.label}</span>
                      <span className="flex items-center gap-2">
                        {c.delta ? (
                          <span className={`flex items-center text-xs ${c.delta > 0 ? 'text-good' : 'text-accent'}`}>
                            {c.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {c.delta > 0 ? `+${c.delta}` : c.delta}
                          </span>
                        ) : null}
                        <RatingDots value={c.value} />
                        <span className="w-3 text-right font-semibold tabular-nums">{c.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Empty title="Not evaluated yet" action={canEdit && <Button onClick={() => setEvalOpen('new')}>Run first evaluation</Button>} />
            )}
          </Card>
          <div className="space-y-6">
            {p.summary && (
              <Card title="Strengths & areas to improve">
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="label">Strengths</div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.summary.strengths.map((s) => (
                        <Badge key={s.key} tone="good">
                          {s.label} · {s.value}
                        </Badge>
                      ))}
                    </div>
                    {latest?.strengths && <p className="mt-2 text-muted">{latest.strengths}</p>}
                  </div>
                  <div>
                    <div className="label">Areas for improvement</div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.summary.weaknesses.map((s) => (
                        <Badge key={s.key} tone="warn">
                          {s.label} · {s.value}
                        </Badge>
                      ))}
                    </div>
                    {latest?.improvements && <p className="mt-2 text-muted">{latest.improvements}</p>}
                  </div>
                </div>
              </Card>
            )}
            <Card title="Development priorities" icon={<Target className="h-4 w-4" />} actions={canEdit && <PlayerPriorityButton player={p} />}>
              {p.priorities.length ? (
                <ul className="space-y-2">
                  {p.priorities.map((pr) => (
                    <li key={pr.id}>
                      <Link to={`/priorities/${pr.id}`} className="block rounded-lg border border-line p-2.5 text-sm hover:border-accent/50">
                        <div className="font-medium">{pr.title}</div>
                        <div className="mt-1 flex gap-1.5">
                          <FocusBadge area={pr.focus_area} />
                          <StatusBadge status={pr.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No individual priorities.</p>
              )}
            </Card>
          </div>
          {history.length > 1 && (
            <Card title="Average rating over time" className="lg:col-span-2">
              <EvalHistoryChart data={history} />
            </Card>
          )}
          <Card title="Recommended drills" icon={<Dumbbell className="h-4 w-4" />} className={history.length > 1 ? '' : 'lg:col-span-3'}>
            {p.recommendations.length ? (
              <ul className="space-y-2">
                {p.recommendations.map((r) => (
                  <li key={r.drill.id} className="rounded-lg border border-line p-2.5">
                    <div className="text-sm font-medium">{r.drill.name}</div>
                    <div className="mt-0.5 text-xs text-muted">{r.reasons.join(' · ')}</div>
                  </li>
                ))}
                <li className="pt-1 text-xs text-faint">Based on the lowest-rated skills and active priorities. Rule-based, not AI.</li>
              </ul>
            ) : (
              <p className="text-sm text-muted">Recommendations appear once the player is evaluated.</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'evaluations' && (
        <div className="space-y-3">
          {p.evaluations.length === 0 && <Empty title="No evaluations yet" />}
          {p.evaluations.map((e) => (
            <EvaluationCard key={e.id} e={e} categories={p.categories} onEdit={() => setEvalOpen(e)} />
          ))}
        </div>
      )}

      {tab === 'goals' && <GoalsTab player={p} />}
      {tab === 'notes' && <NotesTab player={p} />}

      {evalOpen && <EvaluationModal player={p} evaluation={evalOpen === 'new' ? null : evalOpen} latest={latest} onClose={() => setEvalOpen(null)} />}
      {editing && <PlayerFormModal player={p} onClose={() => setEditing(false)} />}
    </div>
  );
}


function EvaluationCard({ e, categories, onEdit }: { e: Evaluation; categories: EvalCategory[]; onEdit: () => void }) {
  const { canEdit } = useTeam();
  const del = useTeamMutation((b) => api.del(`${b}/evaluations/${e.id}`), { toast: 'Evaluation deleted' });
  const vals = Object.values(e.ratings);
  const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  return (
    <Card
      title={
        <span>
          {e.label || 'Evaluation'} <span className="font-normal text-muted">· {fmtDateLong(e.evaluated_on)}{e.evaluator ? ` · ${e.evaluator}` : ''}</span>
        </span>
      }
      actions={
        <>
          <span className="font-display text-xl font-semibold">{avg}</span>
          {canEdit && (
            <>
              <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={onEdit} aria-label="Edit evaluation" />
              <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete" icon={<Trash2 className="h-3.5 w-3.5" />}>
                <span className="sr-only">Delete</span>
              </ConfirmButton>
            </>
          )}
        </>
      }
    >
      <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted">{c.label}</span>
            <RatingDots value={e.ratings[c.key]} />
          </div>
        ))}
      </div>
      {(e.strengths || e.improvements || e.notes) && (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 text-sm md:grid-cols-3">
          {e.strengths && (
            <div>
              <div className="label">Strengths</div>
              <p className="text-muted">{e.strengths}</p>
            </div>
          )}
          {e.improvements && (
            <div>
              <div className="label">To improve</div>
              <p className="text-muted">{e.improvements}</p>
            </div>
          )}
          {e.notes && (
            <div>
              <div className="label">Notes</div>
              <p className="text-muted">{e.notes}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EvaluationModal({ player, evaluation, latest, onClose }: { player: PlayerProfileData; evaluation: Evaluation | null; latest?: Evaluation; onClose: () => void }) {
  const [v, setV] = useState({
    evaluated_on: evaluation?.evaluated_on ?? todayStr(),
    label: evaluation?.label ?? '',
    ratings: { ...(evaluation?.ratings ?? latest?.ratings ?? {}) } as Record<string, number>,
    strengths: evaluation?.strengths ?? '',
    improvements: evaluation?.improvements ?? '',
    notes: evaluation?.notes ?? '',
  });
  const save = useTeamMutation((b) => (evaluation ? api.patch(`${b}/evaluations/${evaluation.id}`, v) : api.post(`${b}/players/${player.id}/evaluations`, v)), { toast: 'Evaluation saved', onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${evaluation ? 'Edit' : 'New'} evaluation · ${player.first_name} ${player.last_name}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save evaluation
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date">
            <Input type="date" value={v.evaluated_on} onChange={(e) => setV({ ...v, evaluated_on: e.target.value })} />
          </Field>
          <Field label="Label">
            <Input placeholder="e.g. Mid-season" value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} />
          </Field>
        </div>
        {!evaluation && latest && <p className="text-xs text-muted">Ratings are pre-filled from the last evaluation ({fmtDate(latest.evaluated_on)}) — adjust what has changed.</p>}
        <div className="space-y-2">
          {player.categories.map((c) => (
            <div key={c.key} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted">{v.ratings[c.key] ? RATING_LABELS[v.ratings[c.key]] : 'Not rated'}</div>
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label={c.label}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={v.ratings[c.key] === n}
                    onClick={() => setV({ ...v, ratings: { ...v.ratings, [c.key]: n } })}
                    title={RATING_LABELS[n]}
                    className={`h-9 w-9 rounded-lg border text-sm font-semibold transition-colors ${v.ratings[c.key] === n ? 'border-accent bg-accent text-accent-ink' : 'border-line hover:border-faint'}`}
                  >
                    {n}
                  </button>
                ))}
                {v.ratings[c.key] && (
                  <button
                    onClick={() => {
                      const r = { ...v.ratings };
                      delete r[c.key];
                      setV({ ...v, ratings: r });
                    }}
                    className="px-1 text-xs text-faint hover:text-ink"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Strengths">
            <Textarea value={v.strengths} onChange={(e) => setV({ ...v, strengths: e.target.value })} />
          </Field>
          <Field label="Areas for improvement">
            <Textarea value={v.improvements} onChange={(e) => setV({ ...v, improvements: e.target.value })} />
          </Field>
        </div>
        <Field label="Coach notes">
          <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

function GoalsTab({ player }: { player: PlayerProfileData }) {
  const { canEdit } = useTeam();
  const { data: priorities = [] } = useTeamQuery<Priority[]>('/priorities');
  const [open, setOpen] = useState<Goal | 'new' | null>(null);
  const update = useTeamMutation((b, v: { id: number } & Partial<Goal>) => api.patch(`${b}/goals/${v.id}`, v));
  const del = useTeamMutation((b, id: number) => api.del(`${b}/goals/${id}`), { toast: 'Goal deleted' });
  return (
    <div>
      {canEdit && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen('new')}>
            Add goal
          </Button>
        </div>
      )}
      {player.goals.length === 0 ? (
        <Empty title="No development goals yet">Set 1–2 specific goals tied to the player’s evaluation.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {player.goals.map((g) => (
            <Card key={g.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{g.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <StatusBadge status={g.status} />
                    {g.skill && <Badge>{player.categories.find((c) => c.key === g.skill)?.label ?? g.skill}</Badge>}
                    {g.priority_id && (
                      <Link to={`/priorities/${g.priority_id}`}>
                        <Badge tone="accent">
                          <Target className="h-3 w-3" /> {priorities.find((p) => p.id === g.priority_id)?.title ?? 'Priority'}
                        </Badge>
                      </Link>
                    )}
                    {g.target_date && <Badge>Target {fmtDate(g.target_date)}</Badge>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex">
                    <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setOpen(g)} aria-label="Edit goal" />
                    <ConfirmButton onConfirm={() => del.mutate(g.id)} confirmText="Delete" icon={<Trash2 className="h-3.5 w-3.5" />}>
                      <span className="sr-only">Delete</span>
                    </ConfirmButton>
                  </div>
                )}
              </div>
              {g.description && <p className="mt-2 text-sm text-muted">{g.description}</p>}
              <div className="mt-3 flex items-center gap-3">
                <ProgressBar value={g.progress} />
                <span className="w-10 text-right text-xs font-semibold tabular-nums">{g.progress}%</span>
              </div>
              {canEdit && g.status === 'active' && (
                <div className="mt-2 flex gap-1">
                  {[25, 50, 75].map((n) => (
                    <Button key={n} size="sm" variant="ghost" onClick={() => update.mutate({ id: g.id, progress: n })}>
                      {n}%
                    </Button>
                  ))}
                  <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: g.id, status: 'achieved' })}>
                    Mark achieved
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {open && <GoalModal player={player} goal={open === 'new' ? null : open} priorities={priorities} onClose={() => setOpen(null)} />}
    </div>
  );
}

function GoalModal({ player, goal, priorities, onClose }: { player: PlayerProfileData; goal: Goal | null; priorities: Priority[]; onClose: () => void }) {
  const [v, setV] = useState({
    title: goal?.title ?? '',
    skill: goal?.skill ?? player.summary?.weaknesses[0]?.key ?? '',
    description: goal?.description ?? '',
    status: goal?.status ?? 'active',
    progress: goal?.progress ?? 0,
    target_date: goal?.target_date ?? '',
    priority_id: goal?.priority_id?.toString() ?? '',
  });
  const save = useTeamMutation((b) => (goal ? api.patch(`${b}/goals/${goal.id}`, v) : api.post(`${b}/players/${player.id}/goals`, v)), { toast: 'Goal saved', onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New development goal'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save goal
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Goal">
          <Input placeholder="Specific and observable, e.g. ‘Shoulder-check before every breakout reception’" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Skill">
            <Select value={v.skill} onChange={(e) => setV({ ...v, skill: e.target.value })}>
              <option value="">—</option>
              {player.categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target date">
            <Input type="date" value={v.target_date} onChange={(e) => setV({ ...v, target_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Linked development priority" hint="Connects this goal to team or individual priorities from Game Review.">
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
        <Field label="Details">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Goal['status'] })}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="achieved">Achieved</option>
            </Select>
          </Field>
          <Field label={`Progress · ${v.progress}%`}>
            <input type="range" min={0} max={100} step={5} value={v.progress} onChange={(e) => setV({ ...v, progress: Number(e.target.value) })} className="mt-2 w-full accent-[rgb(var(--accent))]" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function NotesTab({ player }: { player: PlayerProfileData }) {
  const { canEdit } = useTeam();
  const [body, setBody] = useState('');
  const add = useTeamMutation((b) => api.post(`${b}/players/${player.id}/notes`, { body }), { toast: 'Note added', onSuccess: () => setBody('') });
  const del = useTeamMutation((b, id: number) => api.del(`${b}/notes/${id}`));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Coach notes" icon={<MessageSquarePlus className="h-4 w-4" />}>
        {canEdit && (
          <div className="mb-4">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Conversation, observation from practice, parent communication…" />
            <Button size="sm" variant="primary" className="mt-2" disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate(undefined)}>
              Add note
            </Button>
          </div>
        )}
        {player.coach_notes.length === 0 ? (
          <p className="text-sm text-muted">No notes yet.</p>
        ) : (
          <ul className="space-y-3">
            {player.coach_notes.map((n) => (
              <li key={n.id} className="group rounded-lg border border-line p-3 text-sm">
                <p className="whitespace-pre-line">{n.body}</p>
                <div className="mt-1 flex items-center justify-between text-xs text-faint">
                  <span>
                    {n.author} · {fmtDate(n.created_at.slice(0, 10))}
                  </span>
                  {canEdit && (
                    <button onClick={() => del.mutate(n.id)} className="opacity-0 hover:text-accent group-hover:opacity-100" aria-label="Delete note">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Game observations involving this player">
        {player.observations.length === 0 ? (
          <p className="text-sm text-muted">Tag players on observations in Game Review to see them here.</p>
        ) : (
          <ul className="space-y-2">
            {player.observations.map((o) => (
              <li key={o.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={o.kind === 'issue' ? 'accent' : 'good'}>{o.kind === 'issue' ? 'Issue' : 'Positive'}</Badge>
                  <FocusBadge area={o.focus_area} />
                  <Link to={`/games/${o.game_id}`} className="text-xs text-muted hover:text-ink">
                    vs {o.opponent} · {fmtDate(o.played_at)}
                  </Link>
                </div>
                <p className="mt-1.5">{o.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PlayerPriorityButton({ player }: { player: PlayerProfileData }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ title: `${player.first_name} ${player.last_name} — `, focus_area: 'individual', description: '' });
  const save = useTeamMutation((b) => api.post(`${b}/priorities`, { ...v, player_id: player.id }), { toast: 'Priority created', onSuccess: () => setOpen(false) });
  return (
    <>
      <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
        Add
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Individual development priority"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
              Create priority
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Focus area" hint="Progress is tracked from game observations tagged with this player and focus area.">
            <Select value={v.focus_area} onChange={(e) => setV({ ...v, focus_area: e.target.value })}>
              {FOCUS_AREAS.map((f) => (
                <option key={f} value={f}>
                  {FOCUS_AREA_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description">
            <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

