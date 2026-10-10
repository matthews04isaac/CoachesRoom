import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Flag, Plus, Target, Video } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { Game, Observation, Player, Priority, RecurringIssue } from '../lib/types';
import { FOCUS_AREAS, FOCUS_AREA_LABELS, type FocusArea } from '../../shared/domain';
import { fmtDate, fmtTime, todayStr } from '../lib/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, NotYet, PageHeader, ReadOnlyNote, ResultBadge, Select, Spinner, Tabs, Textarea } from '../components/ui';
import { FocusBadge, StatusBadge, TrendBadge } from '../components/hockey';

type Tab = 'games' | 'priorities' | 'issues';

export default function Games() {
  const { canEdit } = useTeam();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'games';
  const setTab = (t: Tab) => setParams(t === 'games' ? {} : { tab: t });
  return (
    <div>
      <PageHeader
        title="Game Review"
        subtitle="Record results, log tactical observations, and turn recurring problems into development priorities."
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setParams({ ...Object.fromEntries(params), new: '1' })}>
              Log game
            </Button>
          )
        }
      />
      <ReadOnlyNote />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'games', label: 'Games' },
          { value: 'priorities', label: 'Development priorities' },
          { value: 'issues', label: 'Recurring issue tracker' },
        ]}
      />
      {tab === 'games' && <GamesList />}
      {tab === 'priorities' && <PrioritiesList />}
      {tab === 'issues' && <IssueTracker />}
      {params.get('new') === '1' && <GameFormModal game={null} onClose={() => setParams(tab === 'games' ? {} : { tab })} />}
    </div>
  );
}

function GamesList() {
  const { data, isLoading } = useTeamQuery<Game[]>('/games');
  if (isLoading || !data) return <Spinner />;
  const upcoming = data.filter((g) => g.result === null).reverse();
  const played = data.filter((g) => g.result !== null);
  const row = (g: Game) => (
    <li key={g.id}>
      <Link to={`/games/${g.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-raised/60">
        <div className="w-14 shrink-0 text-center">
          <div className="text-[10px] font-semibold uppercase text-accent">{fmtDate(g.played_at, { month: 'short' })}</div>
          <div className="font-display text-2xl font-semibold leading-none">{fmtDate(g.played_at, { day: 'numeric' })}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {g.venue === 'away' ? '@' : 'vs'} {g.opponent}
          </div>
          <div className="truncate text-xs text-muted">
            {g.game_type} · {fmtTime(g.played_at)} {g.location ? `· ${g.location}` : ''}
          </div>
        </div>
        {g.result && (
          <div className="hidden gap-1.5 sm:flex">
            {!!g.issue_count && <Badge tone="accent">{g.issue_count} issues</Badge>}
            {!!g.positive_count && <Badge tone="good">{g.positive_count} positives</Badge>}
            {!g.issue_count && !g.positive_count && <Badge tone="warn">Not reviewed</Badge>}
          </div>
        )}
        <ResultBadge result={g.result} />
        {g.result && (
          <div className="w-16 text-right font-display text-xl font-semibold tabular-nums">
            {g.goals_for}–{g.goals_against}
          </div>
        )}
      </Link>
    </li>
  );
  return (
    <div className="space-y-6">
      {upcoming.length > 0 && (
        <Card title="Scheduled" bodyClass="p-0">
          <ul className="divide-y divide-line">{upcoming.map(row)}</ul>
        </Card>
      )}
      <Card title={`Results (${played.length})`} bodyClass="p-0">
        {played.length ? <ul className="divide-y divide-line">{played.map(row)}</ul> : <div className="p-4"><Empty icon={<Flag className="h-8 w-8" />} title="No games recorded yet" /></div>}
      </Card>
      <NotYet phase="Phase 3">
        <Video className="mr-1 inline h-3.5 w-3.5" />
        Game video uploads, timestamped clips, drawing annotations and automated video analysis. Observations already reserve a field for linking to future video clips.
      </NotYet>
    </div>
  );
}

export function GameFormModal({ game, onClose }: { game: Game | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [v, setV] = useState({
    date: game?.played_at.slice(0, 10) ?? todayStr(),
    time: game?.played_at.slice(11, 16) ?? '19:00',
    opponent: game?.opponent ?? '',
    venue: game?.venue ?? 'home',
    game_type: game?.game_type ?? 'league',
    location: game?.location ?? '',
    goals_for: game?.goals_for?.toString() ?? '',
    goals_against: game?.goals_against?.toString() ?? '',
    shots_for: game?.shots_for?.toString() ?? '',
    shots_against: game?.shots_against?.toString() ?? '',
    overtime: !!game?.overtime,
    summary: game?.summary ?? '',
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const body = () => ({ ...v, played_at: `${v.date}T${v.time || '00:00'}` });
  const save = useTeamMutation((b) => (game ? api.patch<Game>(`${b}/games/${game.id}`, body()) : api.post<Game>(`${b}/games`, body())), {
    toast: game ? 'Game updated' : 'Game recorded',
    onSuccess: (g) => {
      onClose();
      if (!game) navigate(`/games/${g.id}`);
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={game ? 'Edit game' : 'Log a game'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            {game ? 'Save' : 'Save & review game'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Opponent" className="sm:col-span-3">
            <Input value={v.opponent} onChange={set('opponent')} placeholder="e.g. Lakeshore Lightning" />
          </Field>
          <Field label="Date">
            <Input type="date" value={v.date} onChange={set('date')} />
          </Field>
          <Field label="Time">
            <Input type="time" value={v.time} onChange={set('time')} />
          </Field>
          <Field label="Venue">
            <Select value={v.venue} onChange={set('venue')}>
              <option value="home">Home</option>
              <option value="away">Away</option>
              <option value="neutral">Neutral</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={v.game_type} onChange={set('game_type')}>
              <option value="league">League</option>
              <option value="exhibition">Exhibition</option>
              <option value="tournament">Tournament</option>
              <option value="playoff">Playoff</option>
            </Select>
          </Field>
          <Field label="Location" className="sm:col-span-2">
            <Input value={v.location} onChange={set('location')} />
          </Field>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="mb-3 text-xs text-muted">Leave the score blank to add a scheduled game.</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Goals for">
              <Input type="number" min={0} value={v.goals_for} onChange={set('goals_for')} />
            </Field>
            <Field label="Goals against">
              <Input type="number" min={0} value={v.goals_against} onChange={set('goals_against')} />
            </Field>
            <Field label="Shots for">
              <Input type="number" min={0} value={v.shots_for} onChange={set('shots_for')} />
            </Field>
            <Field label="Shots against">
              <Input type="number" min={0} value={v.shots_against} onChange={set('shots_against')} />
            </Field>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.overtime} onChange={(e) => setV({ ...v, overtime: e.target.checked })} className="accent-[rgb(var(--accent))]" /> Decided in overtime / shootout
          </label>
        </div>
        <Field label="Game summary">
          <Textarea value={v.summary} onChange={set('summary')} />
        </Field>
      </div>
    </Modal>
  );
}

function PrioritiesList() {
  const { canEdit } = useTeam();
  const { data, isLoading } = useTeamQuery<Priority[]>('/priorities');
  const [open, setOpen] = useState(false);
  if (isLoading || !data) return <Spinner />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted">Priorities connect game observations to drills, practices, player goals and trend tracking.</p>
        {canEdit && (
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
            New priority
          </Button>
        )}
      </div>
      {data.length === 0 ? (
        <Empty icon={<Target className="h-8 w-8" />} title="No development priorities yet">
          Create one from a recurring issue or directly from an observation in a game review.
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <Link key={p.id} to={`/priorities/${p.id}`} className="card animate-fade-up block p-4 hover:border-accent/50">
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">{p.title}</div>
                <TrendBadge signal={p.signal} compact />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <FocusBadge area={p.focus_area} />
                <StatusBadge status={p.status} />
                {p.player_id && (
                  <Badge>
                    #{p.number} {p.first_name} {p.last_name}
                  </Badge>
                )}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-muted">
                <span>{p.observation_count} linked observations</span>
                <span>{p.practice_count} practices</span>
                {p.before != null && p.after != null && (
                  <span>
                    Net issues/game {p.before} → {p.after}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      {open && <PriorityFormModal onClose={() => setOpen(false)} />}
    </div>
  );
}

export function PriorityFormModal({ onClose, initial, observationIds }: { onClose: () => void; initial?: { title?: string; focus_area?: string; description?: string; player_id?: number | null }; observationIds?: number[] }) {
  const navigate = useNavigate();
  const { data: players = [] } = useTeamQuery<Player[]>('/players');
  const [v, setV] = useState({ title: initial?.title ?? '', focus_area: initial?.focus_area ?? 'breakout', description: initial?.description ?? '', player_id: initial?.player_id?.toString() ?? '', link_focus_area_issues: !observationIds });
  const save = useTeamMutation((b) => api.post<Priority>(`${b}/priorities`, { ...v, observation_ids: observationIds }), {
    toast: 'Development priority created',
    onSuccess: (p) => {
      onClose();
      navigate(`/priorities/${p.id}`);
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="New development priority"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Create priority
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Winger support on breakouts" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Focus area">
            <Select value={v.focus_area} onChange={(e) => setV({ ...v, focus_area: e.target.value })}>
              {FOCUS_AREAS.map((f) => (
                <option key={f} value={f}>
                  {FOCUS_AREA_LABELS[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Applies to">
            <Select value={v.player_id} onChange={(e) => setV({ ...v, player_id: e.target.value })}>
              <option value="">Whole team</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.first_name} {p.last_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description / standard we want">
          <Textarea value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </Field>
        {observationIds ? (
          <p className="text-xs text-muted">{observationIds.length} observation(s) will be linked to this priority.</p>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={v.link_focus_area_issues} onChange={(e) => setV({ ...v, link_focus_area_issues: e.target.checked })} className="accent-[rgb(var(--accent))]" />
            Link existing unassigned issues in this focus area
          </label>
        )}
      </div>
    </Modal>
  );
}

function IssueTracker() {
  const { data: obs, isLoading } = useTeamQuery<Observation[]>('/observations');
  const { data: games = [] } = useTeamQuery<Game[]>('/games');
  const { data: recurring = [] } = useTeamQuery<RecurringIssue[]>('/insights/recurring');
  const [area, setArea] = useState('');
  const [kind, setKind] = useState('');
  const played = useMemo(() => games.filter((g) => g.result).slice(0, 10).reverse(), [games]);
  if (isLoading || !obs) return <Spinner />;
  const count = (gameId: number, f: string, k: string) => obs.filter((o) => o.game_id === gameId && o.focus_area === f && o.kind === k).length;
  const filtered = obs.filter((o) => (!area || o.focus_area === area) && (!kind || o.kind === kind));

  return (
    <div className="space-y-6">
      {recurring.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {recurring.map((r) => (
            <div key={r.focusArea} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{r.label}</div>
                <Badge tone="accent">
                  {r.gamesAffected}/{r.gamesConsidered} games
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">{r.issueCount} issues logged in the last 5 games.</p>
              {r.priority ? (
                <Link to={`/priorities/${r.priority.id}`} className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  <Target className="h-3.5 w-3.5" /> {r.priority.title}
                </Link>
              ) : (
                <p className="mt-2 text-sm text-warn">No priority yet — create one from the dashboard or a game review.</p>
              )}
            </div>
          ))}
        </div>
      )}
      <Card title="Issues by game and focus area (last 10 games)" bodyClass="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="px-4 py-2 text-left font-semibold">Focus area</th>
              {played.map((g) => (
                <th key={g.id} className="px-1 py-2 text-center font-normal" title={`${fmtDate(g.played_at)} vs ${g.opponent}`}>
                  <Link to={`/games/${g.id}`} className="hover:text-ink">
                    {g.opponent.split(' ')[0]}
                    <div className="text-[10px] text-faint">{fmtDate(g.played_at)}</div>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FOCUS_AREAS.map((f) => (
              <tr key={f} className="border-b border-line">
                <td className="px-4 py-2 text-muted">{FOCUS_AREA_LABELS[f]}</td>
                {played.map((g) => {
                  const i = count(g.id, f, 'issue');
                  const p = count(g.id, f, 'positive');
                  return (
                    <td key={g.id} className="px-1 py-1.5 text-center" title={`${FOCUS_AREA_LABELS[f]} vs ${g.opponent}: ${i} issues, ${p} positives`}>
                      <div className="mx-auto flex h-8 w-12 items-center justify-center gap-1 rounded-md text-xs font-semibold" style={{ background: i ? `rgb(var(--accent) / ${Math.min(0.15 + i * 0.22, 0.85)})` : p ? 'rgb(59 130 246 / 0.18)' : 'rgb(var(--raised))' }}>
                        {i ? <span>{i}</span> : null}
                        {p ? <span className="text-[#3b82f6]">+{p}</span> : null}
                        {!i && !p ? <span className="text-faint">·</span> : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-faint">Number = issues logged (darker = more). Blue +n = positive plays logged.</p>
      </Card>

      <Card
        title={`All observations (${filtered.length})`}
        actions={
          <div className="flex gap-2">
            <Select className="h-8 py-0 text-xs" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Focus area">
              <option value="">All areas</option>
              {FOCUS_AREAS.map((f) => (
                <option key={f} value={f}>
                  {FOCUS_AREA_LABELS[f]}
                </option>
              ))}
            </Select>
            <Select className="h-8 py-0 text-xs" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
              <option value="">Issues & positives</option>
              <option value="issue">Issues</option>
              <option value="positive">Positives</option>
            </Select>
          </div>
        }
        bodyClass="p-0"
      >
        <ul className="divide-y divide-line">
          {filtered.map((o) => (
            <li key={o.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={o.kind === 'issue' ? 'accent' : 'good'}>{o.kind === 'issue' ? 'Issue' : 'Positive'}</Badge>
                <FocusBadge area={o.focus_area as FocusArea} />
                {o.game && (
                  <Link to={`/games/${o.game.id}`} className="text-xs text-muted hover:text-ink">
                    vs {o.game.opponent} · {fmtDate(o.game.played_at)}
                  </Link>
                )}
                {o.priority_title && (
                  <Link to={`/priorities/${o.priority_id}`} className="text-xs text-accent hover:underline">
                    → {o.priority_title}
                  </Link>
                )}
              </div>
              <p className="mt-1">{o.description}</p>
              {o.players.length > 0 && <p className="mt-0.5 text-xs text-muted">{o.players.map((p) => `#${p.number} ${p.first_name} ${p.last_name}`).join(', ')}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
