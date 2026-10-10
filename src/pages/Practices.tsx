import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, Copy, Plus, Sparkles, Target, LayoutTemplate } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { Practice } from '../lib/types';
import { fmtDateTime, relDays, todayStr } from '../lib/format';
import { Badge, Button, Empty, Field, Input, LinkButton, Modal, PageHeader, ReadOnlyNote, Select, Spinner, Tabs } from '../components/ui';
import { StatusBadge } from '../components/hockey';

export default function Practices() {
  const { canEdit } = useTeam();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'templates'>('upcoming');
  const { data, isLoading } = useTeamQuery<Practice[]>('/practices');
  const navigate = useNavigate();
  const dup = useTeamMutation((b, v: { id: number; as_template?: boolean }) => api.post<Practice>(`${b}/practices/${v.id}/duplicate`, v), {
    toast: 'Practice copied',
    onSuccess: (p) => navigate(`/practices/${p.id}`),
  });
  if (isLoading || !data) return <Spinner />;
  const today = todayStr();
  const lists = {
    upcoming: data.filter((p) => !p.is_template && (!p.scheduled_at || p.scheduled_at.slice(0, 10) >= today)).sort((a, b) => (a.scheduled_at ?? '9').localeCompare(b.scheduled_at ?? '9')),
    past: data.filter((p) => !p.is_template && p.scheduled_at && p.scheduled_at.slice(0, 10) < today),
    templates: data.filter((p) => p.is_template),
  };
  const list = lists[tab];

  return (
    <div>
      <PageHeader
        title="Practice Planner"
        subtitle="Build timed practice plans from the drill library, link them to development priorities, and print them for the rink."
        actions={
          canEdit && (
            <>
              <LinkButton to="/ai" icon={<Sparkles className="h-4 w-4" />}>
                Generate with AI
              </LinkButton>
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setParams({ new: '1' })}>
                New practice
              </Button>
            </>
          )
        }
      />
      <ReadOnlyNote />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'upcoming', label: `Upcoming & drafts (${lists.upcoming.length})` },
          { value: 'past', label: `Past (${lists.past.length})` },
          { value: 'templates', label: `Templates (${lists.templates.length})` },
        ]}
      />
      {list.length === 0 ? (
        <Empty icon={<ClipboardList className="h-8 w-8" />} title={tab === 'templates' ? 'No templates yet' : 'No practices here'} action={canEdit && <Button onClick={() => setParams({ new: '1' })}>Plan a practice</Button>}>
          {tab === 'templates' ? 'Save any practice as a reusable template from the practice editor.' : 'Plan a practice from scratch, from a template, or with the AI Coach.'}
        </Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <div key={p.id} className="card animate-fade-up flex flex-col p-4">
              <Link to={`/practices/${p.id}`} className="group flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-sans text-base font-semibold tracking-normal group-hover:text-accent">{p.title}</h3>
                  {p.is_template ? (
                    <Badge>
                      <LayoutTemplate className="h-3 w-3" /> Template
                    </Badge>
                  ) : (
                    <StatusBadge status={p.status} />
                  )}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {p.is_template ? 'Reusable template' : p.scheduled_at ? `${fmtDateTime(p.scheduled_at)} · ${relDays(p.scheduled_at)}` : 'Not scheduled'}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <Badge>{p.duration} min</Badge>
                  <Badge>{p.segment_count} segments</Badge>
                  {p.planned_minutes !== p.duration && p.segment_count ? <Badge tone="warn">{p.planned_minutes} min planned</Badge> : null}
                  {p.source === 'ai' && (
                    <Badge tone="info">
                      <Sparkles className="h-3 w-3" /> AI-assisted
                    </Badge>
                  )}
                </div>
                {p.priority_titles && p.priority_titles.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {p.priority_titles.map((t) => (
                      <div key={t} className="flex items-center gap-1.5 text-xs text-muted">
                        <Target className="h-3 w-3 text-accent" /> {t}
                      </div>
                    ))}
                  </div>
                )}
              </Link>
              {canEdit && (
                <div className="mt-4 flex gap-2 border-t border-line pt-3">
                  <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => dup.mutate({ id: p.id })}>
                    {p.is_template ? 'Use template' : 'Duplicate'}
                  </Button>
                  {!p.is_template && (
                    <Button size="sm" variant="ghost" icon={<LayoutTemplate className="h-3.5 w-3.5" />} onClick={() => dup.mutate({ id: p.id, as_template: true })}>
                      Save as template
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {params.get('new') === '1' && <NewPracticeModal templates={lists.templates} onClose={() => setParams({})} />}
    </div>
  );
}

function NewPracticeModal({ templates, onClose }: { templates: Practice[]; onClose: () => void }) {
  const navigate = useNavigate();
  const [v, setV] = useState({ title: '', date: todayStr(), time: '17:30', duration: '60', location: '', template: '' });
  const create = useTeamMutation(
    (b) =>
      v.template
        ? api.post<Practice>(`${b}/practices/${v.template}/duplicate`, { title: v.title || undefined, scheduled_at: v.date ? `${v.date}T${v.time || '00:00'}` : null })
        : api.post<Practice>(`${b}/practices`, { title: v.title || 'Practice', scheduled_at: v.date ? `${v.date}T${v.time || '00:00'}` : null, duration: Number(v.duration), location: v.location }),
    { onSuccess: (p) => navigate(`/practices/${p.id}`) },
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="New practice"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate(undefined)}>
            Create & open planner
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Start from">
          <Select value={v.template} onChange={(e) => setV({ ...v, template: e.target.value })}>
            <option value="">Blank practice</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                Template: {t.title} ({t.duration} min)
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title">
          <Input placeholder="e.g. Breakout habits + compete" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">
            <Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
          </Field>
          <Field label="Start time">
            <Input type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
          </Field>
        </div>
        {!v.template && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ice time (minutes)">
              <Select value={v.duration} onChange={(e) => setV({ ...v, duration: e.target.value })}>
                {[30, 45, 50, 60, 75, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location">
              <Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}
