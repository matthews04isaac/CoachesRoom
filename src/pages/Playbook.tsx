import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookMarked, Check, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { TacticalSystem } from '../lib/types';
import { SYSTEM_CATEGORIES, SYSTEM_CATEGORY_LABELS, type SystemCategory } from '../../shared/domain';
import { Badge, Button, Empty, PageHeader, Spinner, Tabs } from '../components/ui';
import { DiagramView } from '../components/Rink';

export default function Playbook() {
  const { canEdit } = useTeam();
  const navigate = useNavigate();
  const { data, isLoading } = useTeamQuery<TacticalSystem[]>('/systems');
  const [tab, setTab] = useState<'playbook' | 'library'>('playbook');
  const [cat, setCat] = useState<SystemCategory | ''>('');
  const toggle = useTeamMutation((b, s: TacticalSystem) => (s.in_playbook ? api.del(`${b}/playbook/${s.id}`) : api.put(`${b}/playbook/${s.id}`)));
  const create = useTeamMutation((b) => api.post<TacticalSystem>(`${b}/systems`, { name: 'New system', category: cat || 'breakout', summary: '', steps: [{ title: 'Step 1', body: '', diagram: { view: 'dzone', items: [], paths: [] } }] }), {
    onSuccess: (s) => navigate(`/playbook/${s.id}?edit=1`),
  });
  if (isLoading || !data) return <Spinner />;
  const list = data.filter((s) => (tab === 'playbook' ? s.in_playbook : true) && (!cat || s.category === cat));

  return (
    <div>
      <PageHeader
        title="Team Playbook"
        subtitle="Your team’s systems — forechecks, breakouts, D-zone coverage, neutral zone, power play and penalty kill — with step-by-step explanations and diagrams."
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} loading={create.isPending} onClick={() => create.mutate(undefined)}>
              New system
            </Button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'playbook', label: `Our playbook (${data.filter((s) => s.in_playbook).length})` },
          { value: 'library', label: `Systems library (${data.length})` },
        ]}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button onClick={() => setCat('')} className={`chip border py-1 ${!cat ? 'border-accent/60 text-ink' : 'border-line text-muted'}`}>
          All
        </button>
        {SYSTEM_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`chip border py-1 ${cat === c ? 'border-accent/60 text-ink' : 'border-line text-muted'}`}>
            {SYSTEM_CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon={<BookMarked className="h-8 w-8" />} title={tab === 'playbook' ? 'Your playbook is empty' : 'No systems'} action={tab === 'playbook' && <Button onClick={() => setTab('library')}>Browse the systems library</Button>}>
          Add systems from the library or create your own.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => (
            <div key={s.id} className="card animate-fade-up flex flex-col overflow-hidden">
              <Link to={`/playbook/${s.id}`} className="group flex-1">
                <div className="border-b border-line bg-raised/40 p-2">{s.steps[0]?.diagram ? <DiagramView diagram={s.steps[0].diagram} className="max-h-40" /> : <div className="h-28" />}</div>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="info">{SYSTEM_CATEGORY_LABELS[s.category as SystemCategory]}</Badge>
                    <Badge>{s.steps.length} steps</Badge>
                    {s.team_id && <Badge tone="accent">Team system</Badge>}
                  </div>
                  <h3 className="mt-2 font-sans text-base font-semibold tracking-normal group-hover:text-accent">{s.name}</h3>
                  <p className="mt-1 line-clamp-3 text-sm text-muted">{s.summary}</p>
                </div>
              </Link>
              {canEdit && (
                <div className="border-t border-line px-4 py-2.5">
                  <Button size="sm" variant={s.in_playbook ? 'ghost' : 'secondary'} icon={s.in_playbook ? <Check className="h-4 w-4 text-good" /> : <Plus className="h-4 w-4" />} onClick={() => toggle.mutate(s)}>
                    {s.in_playbook ? 'In playbook — remove' : 'Add to playbook'}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
