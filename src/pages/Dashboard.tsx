import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarDays, ClipboardList, Flag, Plus, Target, TrendingUp, Users, Repeat } from 'lucide-react';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import { api } from '../lib/api';
import type { Game, Practice, Priority, RecurringIssue, Record_ } from '../lib/types';
import { fmtDate, fmtTime, relDays } from '../lib/format';
import { Badge, Button, Card, Empty, ErrorNote, LinkButton, PageHeader, ResultBadge, Spinner, Stat } from '../components/ui';
import { FocusBadge, StatusBadge, TrendBadge } from '../components/hockey';
import { SkillBars } from '../components/charts';

interface DashboardData {
  record: Record_;
  counts: { players: number; practices: number; evaluations: number; observations: number };
  upcomingPractices: (Practice & { segment_count: number })[];
  upcomingGames: Game[];
  upcomingEvents: { id: number; type: string; title: string; starts_at: string; location: string }[];
  recentGames: Game[];
  recentEvaluations: { id: number; evaluated_on: string; label: string; player_id: number; first_name: string; last_name: string; number: number; position: string; average: number | null }[];
  priorities: Priority[];
  recurring: RecurringIssue[];
  skillAverages: { key: string; label: string; value: number | null }[];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { team, canEdit } = useTeam();
  const navigate = useNavigate();
  const { data, isLoading, error } = useTeamQuery<DashboardData>('/dashboard');
  const createPriority = useTeamMutation(
    (base, r: RecurringIssue) =>
      api.post<Priority>(`${base}/priorities`, {
        title: `Fix recurring ${r.label.toLowerCase()} issues`,
        focus_area: r.focusArea,
        description: `Created from recurring issues: logged in ${r.gamesAffected} of the last ${r.gamesConsidered} games. Examples: ${r.examples.map((e) => e.description).join(' / ')}`,
        link_focus_area_issues: true,
      }),
    { toast: 'Development priority created', onSuccess: (p) => navigate(`/priorities/${p.id}`) },
  );

  if (isLoading || !team) return <Spinner />;
  if (error) return <ErrorNote error={error} />;
  if (!data) return null;
  const rec = data.record;
  const diff = rec.gf - rec.ga;
  const schedule = [
    ...data.upcomingPractices.map((p) => ({ key: `p${p.id}`, when: p.scheduled_at!, title: p.title, kind: 'Practice', link: `/practices/${p.id}`, sub: `${p.duration} min · ${p.segment_count} segments${p.status === 'draft' ? ' · draft' : ''}` })),
    ...data.upcomingGames.map((g) => ({ key: `g${g.id}`, when: g.played_at, title: `${g.venue === 'away' ? '@' : 'vs'} ${g.opponent}`, kind: 'Game', link: `/games/${g.id}`, sub: g.location })),
    ...data.upcomingEvents.map((e) => ({ key: `e${e.id}`, when: e.starts_at, title: e.title, kind: e.type[0].toUpperCase() + e.type.slice(1), link: '/calendar', sub: e.location })),
  ]
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 6);
  const unaddressed = data.recurring.filter((r) => !r.priority);

  return (
    <div>
      <PageHeader
        eyebrow={`${team.division} ${team.level} · ${team.season}`}
        title={team.name}
        subtitle={`${greeting()}, coach. Here’s where your team stands.`}
        actions={
          canEdit && (
            <>
              <LinkButton to="/games?new=1" icon={<Flag className="h-4 w-4" />}>
                Log game
              </LinkButton>
              <LinkButton to="/players?evaluate=1" icon={<TrendingUp className="h-4 w-4" />}>
                Evaluate
              </LinkButton>
              <LinkButton to="/practices?new=1" variant="primary" icon={<Plus className="h-4 w-4" />}>
                New practice
              </LinkButton>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Record" value={`${rec.w}-${rec.l}-${rec.otl}-${rec.t}`} sub={`W-L-OTL-T · ${rec.gp} games played`} />
        <Stat label="Goal differential" value={`${diff > 0 ? '+' : ''}${diff}`} sub={`${rec.gf} GF · ${rec.ga} GA`} accent={diff < 0} />
        <Stat label="Shot share" value={rec.sf + rec.sa ? `${Math.round((rec.sf / (rec.sf + rec.sa)) * 100)}%` : '—'} sub={`${rec.sf} for · ${rec.sa} against`} />
        <Stat label="Active priorities" value={data.priorities.filter((p) => p.status === 'active').length} sub={`${data.counts.observations} observations logged`} />
      </div>

      {unaddressed.length > 0 && (
        <div className="mt-6 space-y-2">
          {unaddressed.map((r) => (
            <div key={r.focusArea} className="animate-fade-up flex flex-col gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4 sm:flex-row sm:items-center">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
              <div className="flex-1 text-sm">
                <div className="font-semibold">Recurring issue: {r.label}</div>
                <div className="text-muted">
                  Logged in {r.gamesAffected} of your last {r.gamesConsidered} games ({r.issueCount} observations) with no development priority yet. Latest: “{r.examples[0]?.description}”
                </div>
              </div>
              {canEdit && (
                <Button variant="primary" size="sm" loading={createPriority.isPending} onClick={() => createPriority.mutate(r)} icon={<Target className="h-4 w-4" />}>
                  Make it a priority
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="Development priorities"
          icon={<Target className="h-4 w-4" />}
          actions={
            <Link to="/games?tab=priorities" className="text-xs text-muted hover:text-ink">
              View all
            </Link>
          }
          bodyClass="p-0"
        >
          {data.priorities.length === 0 ? (
            <div className="p-4">
              <Empty title="No active priorities">Log observations in Game Review and turn recurring problems into priorities.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.priorities.map((p) => (
                <li key={p.id}>
                  <Link to={`/priorities/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-raised/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{p.title}</span>
                        {p.player_id ? <Badge>Player</Badge> : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <FocusBadge area={p.focus_area} />
                        <StatusBadge status={p.status} />
                        {p.before != null && p.after != null && (
                          <span className="text-xs text-muted">
                            Net issues/game: {p.before} → {p.after}
                          </span>
                        )}
                      </div>
                    </div>
                    <TrendBadge signal={p.signal} />
                    <ArrowRight className="h-4 w-4 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Coming up" icon={<CalendarDays className="h-4 w-4" />} actions={<Link to="/calendar" className="text-xs text-muted hover:text-ink">Calendar</Link>} bodyClass="p-0">
          {schedule.length === 0 ? (
            <div className="p-4">
              <Empty title="Nothing scheduled">Plan a practice or add a game.</Empty>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {schedule.map((s) => (
                <li key={s.key}>
                  <Link to={s.link} className="flex gap-3 px-4 py-3 hover:bg-raised/60">
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-[10px] font-semibold uppercase text-accent">{fmtDate(s.when, { weekday: 'short' })}</div>
                      <div className="font-display text-2xl font-semibold leading-none">{fmtDate(s.when, { day: 'numeric' })}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.title}</div>
                      <div className="truncate text-xs text-muted">
                        {s.kind} · {fmtTime(s.when)} · {relDays(s.when)}
                      </div>
                      {s.sub && <div className="truncate text-xs text-faint">{s.sub}</div>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Recent results" icon={<Flag className="h-4 w-4" />} actions={<Link to="/games" className="text-xs text-muted hover:text-ink">Game Review</Link>} bodyClass="p-0">
          {data.recentGames.length === 0 ? (
            <div className="p-4">
              <Empty title="No games yet" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentGames.map((g) => (
                <li key={g.id}>
                  <Link to={`/games/${g.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised/60">
                    <ResultBadge result={g.result} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {g.venue === 'away' ? '@' : 'vs'} {g.opponent}
                      </div>
                      <div className="text-xs text-muted">{fmtDate(g.played_at)}</div>
                    </div>
                    <div className="font-display text-xl font-semibold tabular-nums">
                      {g.goals_for}–{g.goals_against}
                      {g.overtime ? <span className="ml-1 text-xs text-muted">OT</span> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent evaluations" icon={<TrendingUp className="h-4 w-4" />} actions={<Link to="/players" className="text-xs text-muted hover:text-ink">All players</Link>} bodyClass="p-0">
          {data.recentEvaluations.length === 0 ? (
            <div className="p-4">
              <Empty title="No evaluations yet" />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {data.recentEvaluations.map((e) => (
                <li key={e.id}>
                  <Link to={`/players/${e.player_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-raised/60">
                    <span className="w-8 font-display text-lg font-semibold text-muted">#{e.number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {e.first_name} {e.last_name}
                      </div>
                      <div className="text-xs text-muted">
                        {e.label || 'Evaluation'} · {fmtDate(e.evaluated_on)}
                      </div>
                    </div>
                    <span className="font-display text-xl font-semibold">{e.average ?? '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Team skill profile" icon={<Users className="h-4 w-4" />} actions={<span className="text-xs text-faint">Latest evals · 1–5</span>}>
          <SkillBars data={data.skillAverages} />
        </Card>
      </div>

      <Card className="mt-6" title="The BenchIQ coaching loop" icon={<Repeat className="h-4 w-4" />}>
        <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Observe', 'Log issues & positive plays after each game.', '/games'],
            ['Prioritise', 'Recurring problems become development priorities.', '/games?tab=priorities'],
            ['Plan', 'Recommended drills go straight into the next practice.', '/practices'],
            ['Develop', 'Evaluations and goals track every player.', '/players'],
            ['Measure', 'Trends show whether the team is improving.', '/games?tab=issues'],
          ].map(([t, d, to], i) => (
            <li key={t}>
              <Link to={to} className="block h-full rounded-lg border border-line bg-raised/50 p-3 hover:border-accent/50">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-accent-ink">{i + 1}</span>
                  {t}
                </div>
                <p className="mt-1 text-xs text-muted">{d}</p>
              </Link>
            </li>
          ))}
        </ol>
      </Card>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
        <ClipboardList className="h-3.5 w-3.5" /> {data.counts.practices} practices · {data.counts.evaluations} evaluations · {data.counts.players} active players
      </p>
    </div>
  );
}
