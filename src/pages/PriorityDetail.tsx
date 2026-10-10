import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardPlus, Sparkles, Target, Trash2, AlertTriangle, ThumbsUp, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { DrillRecommendation, Goal, Observation, Practice, Priority, TrendPoint } from '../lib/types';
import { PRIORITY_STATUSES } from '../../shared/domain';
import { fmtDate, fmtDateTime, todayStr } from '../lib/format';
import { Badge, Button, Card, ConfirmButton, ErrorNote, LinkButton, PageHeader, ProgressBar, Select, Spinner, Textarea } from '../components/ui';
import { CategoryBadge, FocusBadge, StatusBadge, TrendBadge } from '../components/hockey';
import { FocusTrendChart } from '../components/charts';

interface PriorityData extends Priority {
  trend: TrendPoint[];
  observations: Observation[];
  practices: { id: number; title: string; scheduled_at: string | null; status: string }[];
  goals: Goal[];
  recommendations: DrillRecommendation[];
  nextPractice: { id: number; title: string; scheduled_at: string } | null;
}

export default function PriorityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useTeam();
  const { data: p, isLoading, error } = useTeamQuery<PriorityData>(`/priorities/${id}`);
  const { data: practices = [] } = useTeamQuery<Practice[]>('/practices');
  const [chosen, setChosen] = useState<number[]>([]);
  const [target, setTarget] = useState<string>('');
  const [desc, setDesc] = useState('');
  useEffect(() => {
    if (!p) return;
    setChosen(p.recommendations.filter((r) => !r.alreadyUsed).slice(0, 3).map((r) => r.drill.id));
    setTarget(p.nextPractice ? String(p.nextPractice.id) : 'new');
    setDesc(p.description);
  }, [p]);

  const update = useTeamMutation((b, v: Partial<Priority>) => api.patch(`${b}/priorities/${id}`, v), { toast: 'Priority updated' });
  const del = useTeamMutation((b) => api.del(`${b}/priorities/${id}`), { toast: 'Priority deleted', onSuccess: () => navigate('/games?tab=priorities') });
  const addToPractice = useTeamMutation((b) => api.post<{ practice_id: number }>(`${b}/priorities/${id}/add-to-practice`, { drill_ids: chosen, practice_id: target === 'new' ? null : Number(target) }), {
    toast: 'Drills added to practice',
    onSuccess: (r) => navigate(`/practices/${r.practice_id}`),
  });

  if (isLoading) return <Spinner />;
  if (error || !p) return <ErrorNote error={error} />;
  const upcoming = practices.filter((x) => !x.is_template && x.status !== 'completed' && (!x.scheduled_at || x.scheduled_at.slice(0, 10) >= todayStr()));
  const aiPrompt = `Our team has a development priority: "${p.title}". ${p.description} Recommend corrections and create a 60-minute practice to address it.`;

  return (
    <div>
      <Link to="/games?tab=priorities" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Development priorities
      </Link>
      <PageHeader
        eyebrow={p.player_id ? `Individual priority · #${p.number} ${p.first_name} ${p.last_name}` : 'Team development priority'}
        title={p.title}
        subtitle={`Created ${fmtDate(p.created_at.slice(0, 10))}${p.resolved_at ? ` · Resolved ${fmtDate(p.resolved_at.slice(0, 10))}` : ''}`}
        actions={
          <>
            <LinkButton to={`/ai?prompt=${encodeURIComponent(aiPrompt)}`} icon={<Sparkles className="h-4 w-4" />}>
              Ask AI Coach
            </LinkButton>
            {canEdit && (
              <Select className="h-9 w-40" value={p.status} onChange={(e) => update.mutate({ status: e.target.value as Priority['status'] })} aria-label="Status">
                {PRIORITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <FocusBadge area={p.focus_area} />
        <StatusBadge status={p.status} />
        <TrendBadge signal={p.signal} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Is it improving?" className="lg:col-span-2" actions={<span className="text-xs text-faint">From game observations{p.player_id ? ' tagged with this player' : ''}</span>}>
          {p.trend.length ? (
            <>
              <FocusTrendChart data={p.trend} since={p.created_at} />
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-raised p-3">
                  <div className="text-xs text-muted">Net issues / game before</div>
                  <div className="font-display text-2xl font-semibold">{p.before ?? '—'}</div>
                </div>
                <div className="rounded-lg bg-raised p-3">
                  <div className="text-xs text-muted">Net issues / game since</div>
                  <div className="font-display text-2xl font-semibold">{p.after ?? '—'}</div>
                </div>
                <div className="rounded-lg bg-raised p-3">
                  <div className="text-xs text-muted">Signal</div>
                  <div className="mt-1">
                    <TrendBadge signal={p.signal} />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-faint">Net = issues minus positive plays logged per game in this focus area. Compared before vs. since the priority was created (or first vs. second half of recent games when there isn’t enough data yet).</p>
            </>
          ) : (
            <p className="text-sm text-muted">Record games and log observations to see a trend.</p>
          )}
        </Card>

        <Card title="Standard / description">
          <Textarea rows={6} disabled={!canEdit} value={desc} onChange={(e) => setDesc(e.target.value)} />
          {canEdit && desc !== p.description && (
            <Button size="sm" className="mt-2" onClick={() => update.mutate({ description: desc })}>
              Save
            </Button>
          )}
        </Card>

        <Card title="Recommended drills" icon={<Sparkles className="h-4 w-4" />} className="lg:col-span-2" actions={<span className="text-xs text-faint">Matched by focus area & age · rule-based</span>}>
          {p.recommendations.length === 0 ? (
            <p className="text-sm text-muted">No drills are tagged with this focus area yet. Tag your custom drills in the Drill Library.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {p.recommendations.map((r) => {
                  const on = chosen.includes(r.drill.id);
                  return (
                    <li key={r.drill.id}>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${on ? 'border-accent/60 bg-accent/5' : 'border-line hover:border-faint/60'}`}>
                        {canEdit && <input type="checkbox" className="mt-1 accent-[rgb(var(--accent))]" checked={on} onChange={() => setChosen((c) => (on ? c.filter((x) => x !== r.drill.id) : [...c, r.drill.id]))} />}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{r.drill.name}</span>
                            <CategoryBadge category={r.drill.category} />
                            <span className="text-xs text-muted">{r.drill.duration} min</span>
                            {r.alreadyUsed && (
                              <Badge tone="good">
                                <Check className="h-3 w-3" /> Already in a linked practice
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-muted">{r.drill.description}</p>
                          <p className="mt-1 text-[11px] text-faint">{r.reasons.join(' · ')}</p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {canEdit && (
                <div className="mt-4 flex flex-col gap-2 rounded-lg border border-line bg-raised/50 p-3 sm:flex-row sm:items-center">
                  <span className="whitespace-nowrap text-sm text-muted">Add {chosen.length} drill(s) to</span>
                  <Select className="min-w-0 sm:flex-1" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target practice">
                    <option value="new">A new draft practice</option>
                    {upcoming.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.id === p.nextPractice?.id ? 'Next practice: ' : ''}
                        {x.title} {x.scheduled_at ? `· ${fmtDateTime(x.scheduled_at)}` : ''}
                      </option>
                    ))}
                  </Select>
                  <Button variant="primary" icon={<ClipboardPlus className="h-4 w-4" />} disabled={!chosen.length} loading={addToPractice.isPending} onClick={() => addToPractice.mutate(undefined)}>
                    Add to practice
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card title={`Practices addressing this (${p.practices.length})`}>
            {p.practices.length ? (
              <ul className="space-y-2">
                {p.practices.map((x) => (
                  <li key={x.id}>
                    <Link to={`/practices/${x.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-line p-2.5 text-sm hover:border-accent/50">
                      <span className="truncate">{x.title}</span>
                      <span className="shrink-0 text-xs text-muted">{x.scheduled_at ? fmtDate(x.scheduled_at) : x.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Not addressed in any practice yet.</p>
            )}
          </Card>
          {p.goals.length > 0 && (
            <Card title="Linked player goals">
              <ul className="space-y-3">
                {p.goals.map((g) => (
                  <li key={g.id} className="text-sm">
                    <Link to={`/players/${g.player_id}`} className="font-medium hover:text-accent">
                      {g.first_name} {g.last_name}
                    </Link>
                    <p className="text-xs text-muted">{g.title}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={g.progress} />
                      <span className="text-xs tabular-nums">{g.progress}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card title={`Linked observations (${p.observations.length})`} icon={<Target className="h-4 w-4" />} className="lg:col-span-3" bodyClass="p-0">
          {p.observations.length === 0 ? (
            <p className="p-4 text-sm text-muted">Link observations from a game review to build the evidence for this priority.</p>
          ) : (
            <ul className="divide-y divide-line">
              {p.observations.map((o) => (
                <li key={o.id} className="flex gap-3 px-4 py-3 text-sm">
                  {o.kind === 'issue' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> : <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-good" />}
                  <div className="min-w-0 flex-1">
                    <p>{o.description}</p>
                    <div className="mt-1 text-xs text-muted">
                      {o.game && (
                        <Link to={`/games/${o.game.id}`} className="hover:text-ink">
                          vs {o.game.opponent} · {fmtDate(o.game.played_at)}
                        </Link>
                      )}
                      {o.players.length > 0 && ` · ${o.players.map((pl) => `${pl.first_name} ${pl.last_name}`).join(', ')}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {canEdit && (
        <div className="mt-6 flex justify-end">
          <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete priority (observations are kept)" icon={<Trash2 className="h-4 w-4" />}>
            Delete priority
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}
