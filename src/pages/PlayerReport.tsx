import { useParams } from 'react-router-dom';
import { useMe, useTeam, useTeamQuery } from '../lib/session';
import { POSITION_LABELS, RATING_LABELS, type Position } from '../../shared/domain';
import { fmtDate, fmtDateLong } from '../lib/format';
import { ErrorNote, RatingDots, Spinner } from '../components/ui';
import { EvalHistoryChart, RatingRadar } from '../components/charts';
import { PrintToolbar } from './PracticePrint';
import type { PlayerProfileData } from './PlayerProfile';

export default function PlayerReport() {
  const { id } = useParams();
  const { team } = useTeam();
  const { data: me } = useMe();
  const { data: p, isLoading, error } = useTeamQuery<PlayerProfileData>(`/players/${id}`);
  if (isLoading || !team) return <Spinner />;
  if (error || !p) return <ErrorNote error={error} />;
  const [latest, previous] = p.evaluations;
  const history = [...p.evaluations].reverse().map((e) => {
    const vals = Object.values(e.ratings);
    return { date: e.evaluated_on, label: e.label, average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 };
  });
  const goals = p.goals.filter((g) => g.status !== 'paused');
  const positives = p.observations.filter((o) => o.kind === 'positive').slice(0, 4);
  const issues = p.observations.filter((o) => o.kind === 'issue').slice(0, 4);

  return (
    <div className="min-h-full bg-bg">
      <PrintToolbar back={`/players/${id}`} label="Back to profile" />
      <article className="mx-auto max-w-[850px] bg-surface p-8 text-ink print:max-w-none print:p-0">
        <header className="flex items-start justify-between border-b-2 border-accent pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{team.name} · Player evaluation report</div>
            <h1 className="mt-1 text-4xl font-bold">
              {p.first_name} {p.last_name}
            </h1>
            <div className="mt-1 text-sm text-muted">
              #{p.number ?? '–'} · {POSITION_LABELS[p.position as Position]}
              {p.shoots ? ` · Shoots ${p.shoots}` : ''}
              {p.birth_year ? ` · Born ${p.birth_year}` : ''} · {team.season}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-bold">
              Bench<span className="text-accent">IQ</span>
            </div>
            {latest && <div className="mt-1 text-xs text-muted">Evaluated {fmtDateLong(latest.evaluated_on)}</div>}
          </div>
        </header>

        {!latest ? (
          <p className="mt-6 text-muted">No evaluations recorded yet.</p>
        ) : (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="print-break">
                <RatingRadar data={p.categories.map((c) => ({ label: c.label, latest: latest.ratings[c.key] ?? null, previous: previous?.ratings[c.key] ?? null }))} hasPrevious={!!previous} />
              </div>
              <table className="w-full self-center text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                    <th className="py-1.5">Skill</th>
                    <th className="py-1.5">Rating</th>
                    {previous && <th className="py-1.5 text-right">Change</th>}
                  </tr>
                </thead>
                <tbody>
                  {p.categories.map((c) => {
                    const v = latest.ratings[c.key];
                    const d = previous && v != null && previous.ratings[c.key] != null ? v - previous.ratings[c.key] : null;
                    return (
                      <tr key={c.key} className="border-b border-line">
                        <td className="py-1.5">{c.label}</td>
                        <td className="py-1.5">
                          <span className="flex items-center gap-2">
                            <RatingDots value={v} /> <span className="text-xs text-muted">{v ? RATING_LABELS[v] : '—'}</span>
                          </span>
                        </td>
                        {previous && <td className={`py-1.5 text-right font-semibold ${d && d > 0 ? 'text-good' : d && d < 0 ? 'text-accent' : 'text-muted'}`}>{d ? (d > 0 ? `+${d}` : d) : '—'}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="print-break mt-6 grid gap-6 sm:grid-cols-2 text-sm">
              <div>
                <h2 className="text-xl font-semibold">Strengths</h2>
                <ul className="mt-1 list-disc pl-5">
                  {p.summary?.strengths.map((s) => (
                    <li key={s.key}>
                      {s.label} ({s.value}/5)
                    </li>
                  ))}
                </ul>
                {latest.strengths && <p className="mt-2">{latest.strengths}</p>}
              </div>
              <div>
                <h2 className="text-xl font-semibold">Areas for improvement</h2>
                <ul className="mt-1 list-disc pl-5">
                  {p.summary?.weaknesses.map((s) => (
                    <li key={s.key}>
                      {s.label} ({s.value}/5)
                    </li>
                  ))}
                </ul>
                {latest.improvements && <p className="mt-2">{latest.improvements}</p>}
              </div>
            </div>
            {history.length > 1 && (
              <div className="print-break mt-6">
                <h2 className="text-xl font-semibold">Progress over time</h2>
                <EvalHistoryChart data={history} />
              </div>
            )}
          </>
        )}

        <div className="print-break mt-6 text-sm">
          <h2 className="text-xl font-semibold">Development goals</h2>
          {goals.length ? (
            <table className="mt-2 w-full">
              <tbody>
                {goals.map((g) => (
                  <tr key={g.id} className="border-b border-line">
                    <td className="py-1.5 pr-3">{g.title}</td>
                    <td className="w-24 py-1.5 text-muted">{g.status}</td>
                    <td className="w-16 py-1.5 text-right font-semibold">{g.progress}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted">No goals set.</p>
          )}
        </div>

        {(positives.length > 0 || issues.length > 0) && (
          <div className="print-break mt-6 grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold">Recent positives in games</h2>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {positives.map((o) => (
                  <li key={o.id}>
                    {o.description} <span className="text-muted">({fmtDate(o.played_at)})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Recent things to work on</h2>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {issues.map((o) => (
                  <li key={o.id}>
                    {o.description} <span className="text-muted">({fmtDate(o.played_at)})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {latest?.notes && (
          <div className="print-break mt-6 text-sm">
            <h2 className="text-xl font-semibold">Coach comments</h2>
            <p className="mt-1">{latest.notes}</p>
          </div>
        )}
        <footer className="mt-10 grid grid-cols-2 gap-8 text-xs text-muted">
          <div className="border-t border-line pt-1">Coach: {me?.name}</div>
          <div className="border-t border-line pt-1">Player / parent signature</div>
        </footer>
      </article>
    </div>
  );
}
