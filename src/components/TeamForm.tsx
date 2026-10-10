import { useState, type FormEvent } from 'react';
import { AGE_DIVISIONS, LEVELS } from '../../shared/domain';
import { Button, Field, Input, Select, TeamLogo } from './ui';

export interface TeamFormValues {
  name: string;
  short_name: string;
  color: string;
  logo_url: string;
  division: string;
  level: string;
  season: string;
  my_title?: string;
}

const COLORS = ['#e11d2e', '#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#0f172a', '#0891b2', '#db2777'];

export function defaultSeason() {
  const d = new Date();
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}–${String(y + 1).slice(2)}`;
}

export function TeamForm({ initial, onSubmit, submitLabel, loading, showTitle }: { initial?: Partial<TeamFormValues>; onSubmit: (v: TeamFormValues) => void; submitLabel: string; loading?: boolean; showTitle?: boolean }) {
  const [v, setV] = useState<TeamFormValues>({
    name: '',
    short_name: '',
    color: COLORS[0],
    logo_url: initial?.logo_url ?? '',
    division: 'U15',
    level: 'A',
    season: defaultSeason(),
    my_title: 'Head Coach',
    ...initial,
  });
  const set = (k: keyof TeamFormValues) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ ...v, short_name: v.short_name || v.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4) });
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <TeamLogo team={{ short_name: v.short_name || v.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4) || '?', color: v.color, logo_url: v.logo_url || null }} size="lg" />
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setV({ ...v, color: c })} className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-surface ${v.color === c ? 'ring-2 ring-ink' : ''}`} style={{ background: c }} aria-label={`Team colour ${c}`} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Team name" className="sm:col-span-2">
          <Input required maxLength={80} placeholder="e.g. Northside Hawks U15 AA" value={v.name} onChange={set('name')} />
        </Field>
        <Field label="Short name" hint="Up to 6 letters">
          <Input maxLength={6} placeholder="NSH" value={v.short_name} onChange={set('short_name')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Age division">
          <Select value={v.division} onChange={set('division')}>
            {AGE_DIVISIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Level">
          <Select value={v.level} onChange={set('level')}>
            {LEVELS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
        </Field>
        <Field label="Season">
          <Input required maxLength={30} value={v.season} onChange={set('season')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo URL (optional)" hint="Link to an image. File uploads are not supported yet.">
          <Input type="url" placeholder="https://…" value={v.logo_url} onChange={set('logo_url')} />
        </Field>
        {showTitle && (
          <Field label="Your role">
            <Input maxLength={60} value={v.my_title} onChange={set('my_title')} />
          </Field>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
