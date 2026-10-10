import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Moon, Sun, Monitor, Plus, X, ArrowUp, ArrowDown, CheckCircle2, CircleDashed } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { useMe, useTeam, useTeamMutation, useTheme, useToast } from '../lib/session';
import type { EvalCategory } from '../../shared/domain';
import { Badge, Button, Card, Field, Input, PageHeader } from '../components/ui';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" subtitle="Your profile, appearance, team configuration and data." />
      <div className="space-y-6">
        <Profile />
        <Appearance />
        <EvalCategories />
        <DataAndAI />
        <Roadmap />
      </div>
    </div>
  );
}

function Profile() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(me?.name ?? '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const save = async (body: object, msg: string) => {
    setBusy(true);
    try {
      const u = await api.patch('/auth/me', body);
      qc.setQueryData(['me'], u);
      qc.invalidateQueries({ queryKey: ['team'] });
      toast(msg);
      setPw({ currentPassword: '', newPassword: '' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Profile">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={me?.email ?? ''} disabled />
          </Field>
          <Button size="sm" loading={busy} disabled={!name.trim() || name === me?.name} onClick={() => save({ name }, 'Profile updated')}>
            Save name
          </Button>
        </div>
        <div className="space-y-3">
          <Field label="Current password">
            <Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </Field>
          <Button size="sm" loading={busy} disabled={!pw.currentPassword || pw.newPassword.length < 8} onClick={() => save(pw, 'Password changed')}>
            Change password
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Appearance() {
  const [theme, setTheme] = useTheme();
  const opts = [
    { v: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { v: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { v: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ] as const;
  return (
    <Card title="Appearance">
      <div className="grid grid-cols-3 gap-3">
        {opts.map((o) => (
          <button key={o.v} onClick={() => setTheme(o.v)} className={clsx('flex items-center justify-center gap-2 rounded-xl border p-4 text-sm font-medium', theme === o.v ? 'border-accent bg-accent/10' : 'border-line hover:border-faint')}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function EvalCategories() {
  const { team, isAdmin } = useTeam();
  const [cats, setCats] = useState<EvalCategory[]>(team?.eval_categories ?? []);
  const [label, setLabel] = useState('');
  useEffect(() => setCats(team?.eval_categories ?? []), [team]);
  const save = useTeamMutation((b) => api.patch(b, { eval_categories: cats }), { toast: 'Evaluation categories saved' });
  const move = (i: number, d: number) => {
    const c = [...cats];
    [c[i], c[i + d]] = [c[i + d], c[i]];
    setCats(c);
  };
  if (!team) return null;
  const changed = JSON.stringify(cats) !== JSON.stringify(team.eval_categories);
  return (
    <Card title={`Evaluation categories · ${team.name}`} actions={<Badge>1–5 scale</Badge>}>
      <p className="mb-3 text-sm text-muted">Customise the skills you rate players on. Existing ratings for removed categories are kept in history but no longer shown. Renaming keeps the same underlying key.</p>
      <ul className="space-y-1.5">
        {cats.map((c, i) => (
          <li key={c.key} className="flex items-center gap-2">
            <Input disabled={!isAdmin} value={c.label} onChange={(e) => setCats(cats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            {isAdmin && (
              <>
                <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} icon={<ArrowUp className="h-3.5 w-3.5" />} aria-label="Move up" />
                <Button size="sm" variant="ghost" disabled={i === cats.length - 1} onClick={() => move(i, 1)} icon={<ArrowDown className="h-3.5 w-3.5" />} aria-label="Move down" />
                <Button size="sm" variant="ghost" disabled={cats.length <= 1} onClick={() => setCats(cats.filter((_, j) => j !== i))} icon={<X className="h-3.5 w-3.5" />} aria-label="Remove" />
              </>
            )}
          </li>
        ))}
      </ul>
      {isAdmin ? (
        <div className="mt-3 flex gap-2">
          <Input placeholder="New category, e.g. Faceoffs" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Button
            icon={<Plus className="h-4 w-4" />}
            disabled={!label.trim()}
            onClick={() => {
              const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              if (!cats.some((c) => c.key === key)) setCats([...cats, { key, label: label.trim() }]);
              setLabel('');
            }}
          >
            Add
          </Button>
          <Button variant="primary" disabled={!changed} loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-faint">Only team admins can change categories.</p>
      )}
    </Card>
  );
}

function DataAndAI() {
  const { team } = useTeam();
  const ai = useQuery<{ enabled: boolean; model: string | null }>({ queryKey: ['ai-status'], queryFn: () => api.get('/ai/status') });
  return (
    <Card title="Data & integrations">
      <div className="space-y-4 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Export team data</div>
            <div className="text-muted">Download roster, practices, evaluations, games, observations and priorities as JSON.</div>
          </div>
          <a href={`/api/teams/${team?.id}/export`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-raised px-4 text-sm font-medium hover:border-faint/60">
            <Download className="h-4 w-4" /> Export JSON
          </a>
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">AI Coach</div>
            <div className="text-muted">{ai.data?.enabled ? `Enabled · model ${ai.data.model}` : 'Disabled — set ANTHROPIC_API_KEY on the server to enable.'}</div>
          </div>
          <Badge tone={ai.data?.enabled ? 'good' : 'neutral'}>{ai.data?.enabled ? 'Connected' : 'Not configured'}</Badge>
        </div>
      </div>
    </Card>
  );
}

const ROADMAP: [string, boolean][] = [
  ['Accounts, multiple teams, roster & staff permissions', true],
  ['Dashboard with record, schedule, evaluations & priorities', true],
  ['Practice planner with drag & drop, templates, duplication', true],
  ['Drill library with custom drills and rink diagram editor', true],
  ['Player evaluations, goals, notes, progress charts', true],
  ['Game review, observations, recurring-issue tracking', true],
  ['Connected development priorities → drills → practices → trends', true],
  ['Tactical board, systems library & team playbook', true],
  ['Printable practice plans & player reports (Save as PDF)', true],
  ['AI Coach (requires an Anthropic API key)', true],
  ['Animated tactical sequences', false],
  ['Video uploads, clip tagging & annotation', false],
  ['Automated video / tactical analysis', false],
  ['Email invitations & notifications', false],
  ['Organisation-level management (clubs & associations)', false],
  ['Photo and file uploads', false],
  ['Additional sports', false],
];

function Roadmap() {
  return (
    <Card title="What’s in this release">
      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        {ROADMAP.map(([label, done]) => (
          <li key={label} className={clsx('flex items-start gap-2', !done && 'text-muted')}>
            {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-faint" />}
            <span>
              {label}
              {!done && <span className="ml-1 text-xs text-faint">(not yet available)</span>}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
