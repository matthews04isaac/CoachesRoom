import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTeam, useTeamQuery } from '../lib/session';
import type { Practice } from '../lib/types';
import { fmtDateLong, fmtTime } from '../lib/format';
import { DRILL_CATEGORY_LABELS, type DrillCategory } from '../../shared/domain';
import { Button, ErrorNote, Spinner } from '../components/ui';
import { DiagramLegend, DiagramView } from '../components/Rink';

export function PrintToolbar({ back, label }: { back: string; label: string }) {
  return (
    <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur">
      <Link to={back} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> {label}
      </Link>
      <span className="ml-auto hidden text-xs text-muted sm:block">Use your browser’s print dialog and choose “Save as PDF”.</span>
      <Button variant="primary" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
        Print / Save as PDF
      </Button>
    </div>
  );
}

export default function PracticePrint() {
  const { id } = useParams();
  const { team } = useTeam();
  const { data: p, isLoading, error } = useTeamQuery<Practice>(`/practices/${id}`);
  if (isLoading || !team) return <Spinner />;
  if (error || !p) return <ErrorNote error={error} />;
  const total = p.segments.reduce((s, x) => s + x.duration, 0);
  const equipment = [...new Set(p.segments.flatMap((s) => s.equipment ?? []))];
  let t = 0;
  return (
    <div className="min-h-full bg-bg">
      <PrintToolbar back={`/practices/${id}`} label="Back to planner" />
      <article className="mx-auto max-w-[850px] bg-surface p-8 text-ink print:max-w-none print:p-0">
        <header className="flex items-start justify-between border-b-2 border-accent pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{team.name} · Practice plan</div>
            <h1 className="mt-1 text-4xl font-bold">{p.title}</h1>
            <div className="mt-1 text-sm text-muted">
              {p.scheduled_at ? `${fmtDateLong(p.scheduled_at)} ${fmtTime(p.scheduled_at)}` : p.is_template ? 'Template' : 'Unscheduled'}
              {p.location ? ` · ${p.location}` : ''} · {p.duration} min ice ({total} min planned)
            </div>
          </div>
          <div className="text-right font-display text-xl font-bold">
            Bench<span className="text-accent">IQ</span>
          </div>
        </header>

        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="label">Objectives</div>
            <p>{p.objectives || '—'}</p>
            {p.priorities.length > 0 && (
              <>
                <div className="label mt-3">Development priorities</div>
                <ul className="list-disc pl-5">
                  {p.priorities.map((pr) => (
                    <li key={pr.id}>{pr.title}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <div className="label">Equipment</div>
            <p>{equipment.length ? equipment.join(', ') : '—'}</p>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
              <th className="py-2 pr-2">Time</th>
              <th className="py-2 pr-2">Segment</th>
              <th className="py-2 text-right">Min</th>
            </tr>
          </thead>
          <tbody>
            {p.segments.map((s, i) => {
              const start = t;
              t += s.duration;
              return (
                <tr key={i} className="border-b border-line align-top">
                  <td className="py-1.5 pr-2 font-mono text-xs">
                    {start}–{t}′
                  </td>
                  <td className="py-1.5 pr-2 font-medium">
                    {s.title}
                    {s.category && <span className="ml-2 text-xs font-normal text-muted">{DRILL_CATEGORY_LABELS[s.category as DrillCategory]}</span>}
                  </td>
                  <td className="py-1.5 text-right">{s.duration}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-6 space-y-5">
          {p.segments.map((s, i) => (
            <section key={i} className="print-break grid gap-4 border-t border-line pt-4 sm:grid-cols-[260px_1fr]">
              <div>{s.diagram ? <DiagramView diagram={s.diagram} /> : <div className="flex h-24 items-center justify-center rounded border border-dashed border-line text-xs text-faint">No diagram</div>}</div>
              <div>
                <h2 className="font-sans text-base font-semibold tracking-normal">
                  {i + 1}. {s.title} <span className="font-normal text-muted">· {s.duration} min</span>
                </h2>
                {s.drill_description && <p className="mt-1 text-sm text-muted">{s.drill_description}</p>}
                {s.coaching_points && s.coaching_points.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                    {s.coaching_points.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                )}
                {s.notes && <p className="mt-2 whitespace-pre-line text-sm italic">{s.notes}</p>}
              </div>
            </section>
          ))}
        </div>
        {p.notes && (
          <div className="print-break mt-6 border-t border-line pt-4 text-sm">
            <div className="label">Coach notes</div>
            <p className="whitespace-pre-line">{p.notes}</p>
          </div>
        )}
        <div className="mt-6 border-t border-line pt-3">
          <DiagramLegend />
        </div>
      </article>
    </div>
  );
}
