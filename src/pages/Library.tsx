import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Plus, Search, Video, PenTool } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { Resource } from '../lib/types';
import { RESOURCE_CATEGORIES, RESOURCE_CATEGORY_LABELS, type ResourceCategory } from '../../shared/domain';
import { Badge, Button, Empty, Field, Input, ListInput, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui';

export default function Library() {
  const { canEdit } = useTeam();
  const { data, isLoading } = useTeamQuery<Resource[]>('/resources');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ResourceCategory | ''>('');
  const [adding, setAdding] = useState(false);
  if (isLoading || !data) return <Spinner />;
  const list = data.filter((r) => (!cat || r.category === cat) && (!q || `${r.title} ${r.summary}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHeader
        title="Coaching Library"
        subtitle="Searchable coaching education: skating, skills, systems, hockey IQ, practice design, player development and leadership."
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Add resource
            </Button>
          )
        }
      />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-faint" />
        <Input className="pl-9" placeholder="Search the library…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-6 flex flex-wrap gap-1.5">
        <button onClick={() => setCat('')} className={`chip border py-1 ${!cat ? 'border-accent/60 text-ink' : 'border-line text-muted'}`}>
          All ({data.length})
        </button>
        {RESOURCE_CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`chip border py-1 ${cat === c ? 'border-accent/60 text-ink' : 'border-line text-muted hover:text-ink'}`}>
            {RESOURCE_CATEGORY_LABELS[c]} ({data.filter((r) => r.category === c).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon={<GraduationCap className="h-8 w-8" />} title="Nothing matches" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <Link key={r.id} to={`/library/${r.id}`} className="card animate-fade-up group flex flex-col p-5 hover:border-accent/50">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">{RESOURCE_CATEGORY_LABELS[r.category as ResourceCategory]}</div>
              <h3 className="mt-1 font-sans text-base font-semibold tracking-normal group-hover:text-accent">{r.title}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{r.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{r.read_minutes} min read</Badge>
                <Badge>{r.level}</Badge>
                {!!r.has_video && (
                  <Badge tone="info">
                    <Video className="h-3 w-3" /> Video
                  </Badge>
                )}
                {!!r.has_diagram && (
                  <Badge tone="info">
                    <PenTool className="h-3 w-3" /> Diagram
                  </Badge>
                )}
                {r.team_id && <Badge tone="accent">Team resource</Badge>}
              </div>
            </Link>
          ))}
        </div>
      )}
      {adding && <AddResourceModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddResourceModal({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState({ title: '', category: 'team-systems', summary: '', body: '', tips: [] as string[], video_url: '', level: 'All ages' });
  const save = useTeamMutation((b) => api.post(`${b}/resources`, v), { toast: 'Resource added', onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Add a coaching resource"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save resource
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Title" className="sm:col-span-2">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
              {RESOURCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {RESOURCE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Summary">
          <Input value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} />
        </Field>
        <Field label="Article" hint="Supports simple formatting: ## headings, - bullet lists, **bold**.">
          <Textarea rows={10} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coaching tips" hint="One per line">
            <ListInput value={v.tips} onChange={(tips) => setV({ ...v, tips })} />
          </Field>
          <div className="space-y-4">
            <Field label="Video link (optional)" hint="YouTube or Vimeo links are embedded; other links open in a new tab. Video uploads are not supported yet.">
              <Input type="url" placeholder="https://…" value={v.video_url} onChange={(e) => setV({ ...v, video_url: e.target.value })} />
            </Field>
            <Field label="Level">
              <Input value={v.level} onChange={(e) => setV({ ...v, level: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}
