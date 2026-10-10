import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrendPoint } from '../lib/types';
import { fmtDate } from '../lib/format';

// Two-series palette validated for CVD separation and contrast in light & dark
// (see dataviz validator): series A = red, series B = blue.
export const SERIES_A = '#e5484d';
export const SERIES_B = '#3b82f6';

const axis = { stroke: 'rgb(var(--faint))', fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: 'rgb(var(--raised))', border: '1px solid rgb(var(--line))', borderRadius: 8, fontSize: 12, color: 'rgb(var(--ink))' },
  labelStyle: { color: 'rgb(var(--muted))', marginBottom: 4 },
  itemStyle: { color: 'rgb(var(--ink))' },
  cursor: { fill: 'rgb(var(--line) / 0.4)', stroke: 'rgb(var(--line))' },
};
const legendStyle = { fontSize: 12, color: 'rgb(var(--muted))' };

/** Skill profile: latest evaluation vs previous. */
export function RatingRadar({ data, hasPrevious }: { data: { label: string; latest: number | null; previous: number | null }[]; hasPrevious: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="rgb(var(--line))" />
        <PolarAngleAxis dataKey="label" tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={false} axisLine={false} />
        {hasPrevious && <Radar name="Previous" dataKey="previous" stroke={SERIES_B} strokeWidth={2} fill={SERIES_B} fillOpacity={0.08} dot={{ r: 3 }} />}
        <Radar name="Latest" dataKey="latest" stroke={SERIES_A} strokeWidth={2} fill={SERIES_A} fillOpacity={0.18} dot={{ r: 4 }} />
        <Tooltip {...tooltipStyle} />
        {hasPrevious && <Legend wrapperStyle={legendStyle} iconType="plainline" />}
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Average rating over time (single series — title names it). */
export function EvalHistoryChart({ data }: { data: { date: string; label: string; average: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -20 }}>
        <CartesianGrid stroke="rgb(var(--line))" strokeDasharray="0" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} {...axis} />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(d, p) => `${fmtDate(String(d))}${p?.[0]?.payload?.label ? ` · ${p[0].payload.label}` : ''}`} formatter={(v) => [v, 'Average rating']} />
        <Line type="monotone" dataKey="average" stroke={SERIES_A} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'rgb(var(--surface))' }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Issues vs positive plays per game for a focus area. */
export function FocusTrendChart({ data, since }: { data: TrendPoint[]; since?: string }) {
  const rows = data.map((d) => ({ ...d, name: d.opponent.split(' ')[0], after: since ? d.date >= since : false }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -24 }} barGap={2}>
        <CartesianGrid stroke="rgb(var(--line))" vertical={false} />
        <XAxis dataKey="name" {...axis} interval={0} tick={{ fontSize: 10, fill: 'rgb(var(--faint))' }} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltipStyle} labelFormatter={(_l, p) => (p?.[0] ? `${fmtDate(p[0].payload.date)} vs ${p[0].payload.opponent}${p[0].payload.after ? ' (after priority set)' : ''}` : '')} />
        <Legend wrapperStyle={legendStyle} iconType="square" />
        <Bar name="Issues" dataKey="issues" fill={SERIES_A} radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar name="Positive plays" dataKey="positives" fill={SERIES_B} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Team skill averages (single series) — horizontal bars. */
export function SkillBars({ data }: { data: { label: string; value: number | null }[] }) {
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="group" title={`${d.label}: ${d.value ?? 'not rated'} / 5`}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-muted">{d.label}</span>
            <span className="font-semibold tabular-nums">{d.value ?? '—'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${((d.value ?? 0) / 5) * 100}%`, background: SERIES_A }} />
          </div>
        </div>
      ))}
    </div>
  );
}
