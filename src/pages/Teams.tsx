import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, UserPlus, Mail, Check, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery, useToast } from '../lib/session';
import type { Player, Staff, Team } from '../lib/types';
import { PERMISSIONS, PERMISSION_LABELS, POSITION_LABELS, type Permission, type Position } from '../../shared/domain';
import { Badge, Button, Card, ConfirmButton, Empty, Field, Input, Modal, PageHeader, PlayerAvatar, ReadOnlyNote, Select, Spinner, Tabs, TeamLogo } from '../components/ui';
import { TeamForm, type TeamFormValues } from '../components/TeamForm';
import { PlayerFormModal } from '../components/PlayerForm';

export default function Teams() {
  const { teams, team, setTeamId } = useTeam();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'roster' | 'staff' | 'details'>('roster');
  const qc = useQueryClient();
  const toast = useToast();
  const creating = params.get('new') === '1';
  const create = useMutation({
    mutationFn: (v: TeamFormValues) => api.post<Team>('/teams', v),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setTeamId(t.id);
      setParams({});
      toast('Team created');
    },
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const demo = useMutation({
    mutationFn: () => api.post<Team>('/teams/demo'),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setTeamId(t.id);
      toast('Demo team added');
    },
  });
  if (!team) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="My Teams"
        subtitle="Manage rosters, coaching staff and permissions. Switch teams any time from the top bar."
        actions={
          <>
            <Button icon={<Sparkles className="h-4 w-4" />} onClick={() => demo.mutate()} loading={demo.isPending}>
              Add demo team
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setParams({ new: '1' })}>
              New team
            </Button>
          </>
        }
      />
      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setTeamId(t.id)}
            className={`card flex items-center gap-3 p-4 text-left transition-colors ${t.id === team.id ? 'border-accent/60 ring-1 ring-accent/40' : 'hover:border-faint/50'}`}
          >
            <TeamLogo team={t} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{t.name}</div>
              <div className="text-xs text-muted">
                {t.division} {t.level} · {t.season} · {t.player_count} players
              </div>
              <div className="mt-1 text-xs text-faint">
                {t.record.w}-{t.record.l}-{t.record.otl}-{t.record.t} · {t.my_title} ({t.permission})
              </div>
            </div>
            {t.id === team.id && <Check className="h-5 w-5 text-accent" />}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-3">
        <TeamLogo team={team} />
        <h2 className="text-2xl font-semibold">{team.name}</h2>
      </div>
      <ReadOnlyNote />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'roster', label: 'Roster' },
          { value: 'staff', label: 'Coaching staff' },
          { value: 'details', label: 'Team details' },
        ]}
      />
      {tab === 'roster' && <Roster />}
      {tab === 'staff' && <StaffTab />}
      {tab === 'details' && <TeamDetails team={team} />}

      <Modal open={creating} onClose={() => setParams({})} title="Create a team" wide>
        <TeamForm submitLabel="Create team" onSubmit={(v) => create.mutate(v)} loading={create.isPending} showTitle />
      </Modal>
    </div>
  );
}

function Roster() {
  const { canEdit } = useTeam();
  const { data: players, isLoading } = useTeamQuery<Player[]>('/players');
  const [editing, setEditing] = useState<Player | 'new' | null>(null);
  if (isLoading || !players) return <Spinner />;
  const groups: [string, Position[]][] = [
    ['Forwards', ['C', 'LW', 'RW']],
    ['Defence', ['D']],
    ['Goalies', ['G']],
  ];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">{players.filter((p) => p.status !== 'inactive').length} active players</p>
        {canEdit && (
          <Button variant="primary" size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Add player
          </Button>
        )}
      </div>
      {players.length === 0 ? (
        <Empty title="No players yet" action={canEdit && <Button onClick={() => setEditing('new')}>Add your first player</Button>}>
          Build your roster with names, numbers and positions.
        </Empty>
      ) : (
        <div className="space-y-6">
          {groups.map(([label, pos]) => {
            const list = players.filter((p) => pos.includes(p.position as Position));
            if (!list.length) return null;
            return (
              <div key={label}>
                <h3 className="mb-2 text-lg font-semibold text-muted">
                  {label} <span className="text-sm">({list.length})</span>
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((p) => (
                    <div key={p.id} className="card flex items-center gap-3 p-3">
                      <PlayerAvatar player={p} />
                      <Link to={`/players/${p.id}`} className="min-w-0 flex-1 hover:text-accent">
                        <div className="truncate font-medium">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-xs text-muted">
                          {POSITION_LABELS[p.position as Position]}
                          {p.shoots ? ` · Shoots ${p.shoots}` : ''}
                          {p.birth_year ? ` · ${p.birth_year}` : ''}
                        </div>
                      </Link>
                      {p.status !== 'active' && <Badge tone={p.status === 'injured' ? 'warn' : 'neutral'}>{p.status}</Badge>}
                      {canEdit && (
                        <button onClick={() => setEditing(p)} className="rounded p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label={`Edit ${p.first_name}`}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <PlayerFormModal player={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StaffTab() {
  const { isAdmin } = useTeam();
  const { data: staff, isLoading } = useTeamQuery<Staff[]>('/staff');
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', title: 'Assistant Coach', permission: 'edit' as Permission });
  const invite = useTeamMutation((b, v: typeof form) => api.post(`${b}/staff`, v), {
    toast: 'Staff member added',
    onSuccess: () => {
      setInviting(false);
      setForm({ name: '', email: '', title: 'Assistant Coach', permission: 'edit' });
    },
  });
  const update = useTeamMutation((b, v: { id: number; permission?: Permission; title?: string }) => api.patch(`${b}/staff/${v.id}`, v), { toast: 'Updated' });
  const remove = useTeamMutation((b, id: number) => api.del(`${b}/staff/${id}`), { toast: 'Removed from staff' });
  if (isLoading || !staff) return <Spinner />;
  return (
    <div className="space-y-4">
      <Card
        title="Coaching staff & permissions"
        actions={
          isAdmin && (
            <Button size="sm" variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setInviting(true)}>
              Add staff
            </Button>
          )
        }
        bodyClass="p-0"
      >
        <ul className="divide-y divide-line">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-bold">
                  {s.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)}
                </span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="truncate text-xs text-muted">
                    {s.title} · {s.email}
                  </div>
                </div>
                {!s.user_id && (
                  <Badge tone="warn">
                    <Mail className="h-3 w-3" /> Pending sign-up
                  </Badge>
                )}
              </div>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <Select className="h-8 w-36 py-0 text-xs" value={s.permission} onChange={(e) => update.mutate({ id: s.id, permission: e.target.value as Permission })} aria-label="Permission">
                    {PERMISSIONS.map((p) => (
                      <option key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </Select>
                  <ConfirmButton onConfirm={() => remove.mutate(s.id)} confirmText="Remove" icon={<Trash2 className="h-4 w-4" />}>
                    <span className="sr-only">Remove</span>
                  </ConfirmButton>
                </div>
              ) : (
                <Badge>{s.permission}</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-2 text-xs text-muted sm:grid-cols-3">
        {PERMISSIONS.map((p) => (
          <div key={p} className="rounded-lg border border-line bg-raised/50 p-3">
            {PERMISSION_LABELS[p]}
          </div>
        ))}
      </div>
      <p className="text-xs text-faint">
        Staff added by email get access as soon as they create a BenchIQ account with that address. BenchIQ does not send invitation emails yet — share the sign-up link yourself.
      </p>
      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Add staff member"
        footer={
          <>
            <Button onClick={() => setInviting(false)}>Cancel</Button>
            <Button variant="primary" loading={invite.isPending} onClick={() => invite.mutate(form)}>
              Add to staff
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role / title">
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Permission">
              <Select value={form.permission} onChange={(e) => setForm({ ...form, permission: e.target.value as Permission })}>
                {PERMISSIONS.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function TeamDetails({ team }: { team: Team }) {
  const { isAdmin, teams, setTeamId } = useTeam();
  const save = useTeamMutation((b, v: TeamFormValues) => api.patch(`${b}`, v), { toast: 'Team updated' });
  const del = useTeamMutation((b) => api.del(b), {
    toast: 'Team deleted',
    onSuccess: () => {
      const next = teams.find((t) => t.id !== team.id);
      if (next) setTeamId(next.id);
    },
  });
  if (!isAdmin)
    return (
      <Card>
        <p className="text-sm text-muted">Only team admins can edit team details.</p>
      </Card>
    );
  return (
    <div className="space-y-6">
      <Card title="Team details">
        <TeamForm key={team.id} initial={{ ...team, logo_url: team.logo_url ?? '' }} submitLabel="Save changes" onSubmit={(v) => save.mutate(v)} loading={save.isPending} />
      </Card>
      <Card title="Danger zone">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">Deleting a team permanently removes its roster, practices, evaluations, games and observations.</p>
          <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Yes, delete team" icon={<Trash2 className="h-4 w-4" />}>
            Delete team
          </ConfirmButton>
        </div>
      </Card>
    </div>
  );
}
