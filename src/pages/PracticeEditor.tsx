import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ChevronDown, ChevronRight, Copy, GripVertical, LayoutTemplate, Plus, Printer, Save, Search, Sparkles, Target, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { Drill, Practice, Priority, Segment } from '../lib/types';
import { DRILL_CATEGORIES, DRILL_CATEGORY_LABELS } from '../../shared/domain';
import { parseLocal, toLocalDate } from '../lib/format';
import { Button, Card, ConfirmButton, ErrorNote, Field, Input, PageHeader, ReadOnlyNote, Select, Spinner, Textarea } from '../components/ui';
import { FocusBadge } from '../components/hockey';
import { DiagramView } from '../components/Rink';

type EditSegment = Segment & { key: string };
const CAT_COLORS: Record<string, string> = {
  skating: '#3b82f6',
  shooting: '#e5484d',
  passing: '#14b8a6',
  defensive: '#8b5cf6',
  tactics: '#f59e0b',
  conditioning: '#22c55e',
};

export default function PracticeEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useTeam();
  const { data: practice, isLoading, error } = useTeamQuery<Practice>(`/practices/${id}`);
  const { data: drills = [] } = useTeamQuery<Drill[]>('/drills');
  const { data: priorities = [] } = useTeamQuery<Priority[]>('/priorities');

  const [form, setForm] = useState({ title: '', date: '', time: '', duration: 60, location: '', objectives: '', notes: '', status: 'planned' as Practice['status'] });
  const [segments, setSegments] = useState<EditSegment[]>([]);
  const [priorityIds, setPriorityIds] = useState<number[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!practice) return;
    const d = practice.scheduled_at ? parseLocal(practice.scheduled_at) : null;
    setForm({
      title: practice.title,
      date: d ? toLocalDate(d) : '',
      time: practice.scheduled_at && practice.scheduled_at.length > 10 ? practice.scheduled_at.slice(11, 16) : '',
      duration: practice.duration,
      location: practice.location,
      objectives: practice.objectives,
      notes: practice.notes,
      status: practice.status,
    });
    setSegments(practice.segments.map((s, i) => ({ ...s, key: `${s.id ?? 'n'}-${i}` })));
    setPriorityIds(practice.priorities.map((p) => p.id));
    setDirty(false);
  }, [practice]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useTeamMutation(
    (b) =>
      api.patch(`${b}/practices/${id}`, {
        ...form,
        scheduled_at: form.date ? `${form.date}T${form.time || '00:00'}` : null,
        segments: segments.map(({ drill_id, title, duration, notes }) => ({ drill_id, title, duration, notes })),
        priority_ids: priorityIds,
      }),
    { toast: 'Practice saved', onSuccess: () => setDirty(false) },
  );
  const dup = useTeamMutation((b, v: { as_template?: boolean }) => api.post<Practice>(`${b}/practices/${id}/duplicate`, v), {
    toast: 'Copy created',
    onSuccess: (p) => navigate(`/practices/${p.id}`),
  });
  const del = useTeamMutation((b) => api.del(`${b}/practices/${id}`), { toast: 'Practice deleted', onSuccess: () => navigate('/practices') });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const total = segments.reduce((s, x) => s + (Number(x.duration) || 0), 0);
  const change = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
  };
  const setF = (k: keyof typeof form) => change((e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: k === 'duration' ? Number(e.target.value) : e.target.value })));
  const addDrill = (d: Drill) => {
    setSegments((s) => [...s, { key: `d${d.id}-${Date.now()}`, drill_id: d.id, title: d.name, duration: d.duration, notes: '', category: d.category, coaching_points: d.coaching_points, equipment: d.equipment, diagram: d.diagram, drill_description: d.description, focus_areas: d.focus_areas }]);
    setDirty(true);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setSegments((s) => arrayMove(s, s.findIndex((x) => x.key === e.active.id), s.findIndex((x) => x.key === e.over!.id)));
    setDirty(true);
  };

  const linkedAreas = priorities.filter((p) => priorityIds.includes(p.id)).map((p) => p.focus_area);
  const equipment = useMemo(() => [...new Set(segments.flatMap((s) => s.equipment ?? []))], [segments]);

  if (isLoading) return <Spinner />;
  if (error || !practice) return <ErrorNote error={error ?? new Error('Practice not found')} />;
  const ro = !canEdit;

  return (
    <div>
      <Link to="/practices" className="no-print mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Practice Planner
      </Link>
      <PageHeader
        eyebrow={practice.is_template ? 'Template' : practice.source === 'ai' ? 'AI-assisted practice' : 'Practice plan'}
        title={form.title || 'Untitled practice'}
        actions={
          <>
            <Button icon={<Printer className="h-4 w-4" />} onClick={() => (dirty ? alert('Save your changes before printing.') : navigate(`/practices/${id}/print`))}>
              Print / PDF
            </Button>
            {canEdit && (
              <>
                <Button icon={<Copy className="h-4 w-4" />} onClick={() => dup.mutate({})} title="Duplicate">
                  <span className="hidden sm:inline">Duplicate</span>
                </Button>
                {!practice.is_template && (
                  <Button icon={<LayoutTemplate className="h-4 w-4" />} onClick={() => dup.mutate({ as_template: true })}>
                    <span className="hidden sm:inline">Save as template</span>
                  </Button>
                )}
                <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={save.isPending} disabled={!dirty} onClick={() => save.mutate(undefined)}>
                  {dirty ? 'Save changes' : 'Saved'}
                </Button>
              </>
            )}
          </>
        }
      />
      <ReadOnlyNote />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <fieldset disabled={ro} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-6">
                <Field label="Title" className="sm:col-span-6">
                  <Input value={form.title} onChange={setF('title')} />
                </Field>
                {!practice.is_template && (
                  <>
                    <Field label="Date" className="sm:col-span-2">
                      <Input type="date" value={form.date} onChange={setF('date')} />
                    </Field>
                    <Field label="Start" className="sm:col-span-1">
                      <Input type="time" value={form.time} onChange={setF('time')} />
                    </Field>
                  </>
                )}
                <Field label="Ice time (min)" className="sm:col-span-1">
                  <Input type="number" min={10} max={240} value={form.duration} onChange={setF('duration')} />
                </Field>
                <Field label="Location" className={practice.is_template ? 'sm:col-span-3' : 'sm:col-span-2'}>
                  <Input value={form.location} onChange={setF('location')} />
                </Field>
                {practice.is_template ? null : (
                  <Field label="Status" className="sm:col-span-2">
                    <Select value={form.status} onChange={setF('status')}>
                      <option value="draft">Draft</option>
                      <option value="planned">Planned</option>
                      <option value="completed">Completed</option>
                    </Select>
                  </Field>
                )}
              </div>
              <Field label="Objectives">
                <Textarea rows={2} value={form.objectives} onChange={setF('objectives')} placeholder="What should players be better at when they leave the ice?" />
              </Field>
            </fieldset>
            <div className="mt-4">
              <span className="label">Development priorities addressed</span>
              <div className="flex flex-wrap gap-2">
                {priorities
                  .filter((p) => p.status !== 'resolved' || priorityIds.includes(p.id))
                  .map((p) => {
                    const on = priorityIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        disabled={ro}
                        onClick={change(() => setPriorityIds((ids) => (on ? ids.filter((x) => x !== p.id) : [...ids, p.id])))}
                        className={`chip border py-1 ${on ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'}`}
                      >
                        <Target className={`h-3 w-3 ${on ? 'text-accent' : ''}`} /> {p.title}
                      </button>
                    );
                  })}
                {priorities.length === 0 && <span className="text-xs text-faint">No priorities yet — create them from Game Review.</span>}
              </div>
            </div>
          </Card>

          <Card
            title={`Plan · ${segments.length} segments`}
            actions={
              <span className={`text-xs font-semibold tabular-nums ${total > form.duration ? 'text-accent' : total < form.duration ? 'text-warn' : 'text-good'}`}>
                {total} / {form.duration} min {total > form.duration ? `(${total - form.duration} over)` : total < form.duration ? `(${form.duration - total} unplanned)` : '✓'}
              </span>
            }
          >
            {segments.length > 0 && (
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden>
                {segments.map((s) => (
                  <div key={s.key} title={`${s.title} · ${s.duration} min`} style={{ width: `${(s.duration / Math.max(total, form.duration)) * 100}%`, background: CAT_COLORS[s.category ?? ''] ?? 'rgb(var(--faint))' }} className="border-r-2 border-surface last:border-r-0" />
                ))}
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={segments.map((s) => s.key)} strategy={verticalListSortingStrategy}>
                <ol className="space-y-2">
                  {segments.map((s, i) => (
                    <SegmentRow
                      key={s.key}
                      seg={s}
                      start={segments.slice(0, i).reduce((a, x) => a + x.duration, 0)}
                      readOnly={ro}
                      onChange={(patch) => {
                        setSegments((list) => list.map((x) => (x.key === s.key ? { ...x, ...patch } : x)));
                        setDirty(true);
                      }}
                      onRemove={() => {
                        setSegments((list) => list.filter((x) => x.key !== s.key));
                        setDirty(true);
                      }}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
            {segments.length === 0 && <p className="py-6 text-center text-sm text-muted">Add drills from the library on the right, or add a custom segment.</p>}
            {canEdit && (
              <Button
                className="mt-3"
                size="sm"
                variant="ghost"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setSegments((s) => [...s, { key: `c${Date.now()}`, drill_id: null, title: 'Custom segment', duration: 5, notes: '' }]);
                  setDirty(true);
                }}
              >
                Add custom segment (water break, talk, game…)
              </Button>
            )}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Equipment checklist">
              {equipment.length ? (
                <ul className="grid grid-cols-2 gap-1 text-sm">
                  {equipment.map((e) => (
                    <li key={e} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {e}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Equipment from library drills appears here.</p>
              )}
            </Card>
            <Card title="Coach notes">
              <Textarea rows={4} disabled={ro} value={form.notes} onChange={setF('notes')} placeholder="Line combinations, reminders, ice layout…" />
            </Card>
          </div>
          {canEdit && (
            <div className="flex justify-end">
              <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete this practice" icon={<Trash2 className="h-4 w-4" />}>
                Delete practice
              </ConfirmButton>
            </div>
          )}
        </div>

        {canEdit && <DrillPicker drills={drills} focusAreas={linkedAreas} onAdd={addDrill} usedIds={segments.map((s) => s.drill_id)} />}
      </div>
    </div>
  );
}

function SegmentRow({ seg, start, readOnly, onChange, onRemove }: { seg: EditSegment; start: number; readOnly: boolean; onChange: (p: Partial<EditSegment>) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: seg.key, disabled: readOnly });
  const [open, setOpen] = useState(false);
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`rounded-lg border border-line bg-raised/60 ${isDragging ? 'relative z-10 shadow-2xl ring-1 ring-accent/50' : ''}`}>
      <div className="flex items-center gap-2 p-2">
        {!readOnly && (
          <button {...attributes} {...listeners} className="cursor-grab touch-none rounded p-1 text-faint hover:text-ink active:cursor-grabbing" aria-label={`Reorder ${seg.title}`}>
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <span className="w-12 shrink-0 text-center font-mono text-[11px] text-muted">
          {start}–{start + seg.duration}′
        </span>
        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: CAT_COLORS[seg.category ?? ''] ?? 'rgb(var(--faint))' }} />
        <div className="min-w-0 flex-1">
          {seg.drill_id ? (
            <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1 text-left text-sm font-medium hover:text-accent">
              {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{seg.title}</span>
            </button>
          ) : (
            <input className="w-full bg-transparent text-sm font-medium focus:outline-none" disabled={readOnly} value={seg.title} onChange={(e) => onChange({ title: e.target.value })} aria-label="Segment title" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <input type="number" min={1} max={120} disabled={readOnly} value={seg.duration} onChange={(e) => onChange({ duration: Math.max(1, Number(e.target.value) || 1) })} className="input h-8 w-14 px-2 py-0 text-center text-sm" aria-label="Minutes" />
          <span className="text-xs text-muted">min</span>
        </div>
        {!readOnly && (
          <button onClick={onRemove} className="rounded p-1.5 text-faint hover:bg-raised hover:text-accent" aria-label="Remove segment">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {(open || !seg.drill_id || seg.notes) && (
        <div className="space-y-3 border-t border-line px-3 pb-3 pt-2">
          {open && seg.drill_id && (
            <div className="grid gap-3 md:grid-cols-[220px_1fr]">
              {seg.diagram && <DiagramView diagram={seg.diagram} className="rounded-md" />}
              <div className="space-y-2 text-sm">
                {seg.drill_description && <p className="text-muted">{seg.drill_description}</p>}
                {seg.coaching_points && seg.coaching_points.length > 0 && (
                  <ul className="space-y-1">
                    {seg.coaching_points.map((c) => (
                      <li key={c} className="flex gap-2 text-xs">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" /> {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <textarea
            rows={1}
            disabled={readOnly}
            value={seg.notes}
            placeholder="Segment notes / emphasis…"
            onChange={(e) => onChange({ notes: e.target.value })}
            className="w-full resize-y bg-transparent text-xs text-muted placeholder:text-faint focus:text-ink focus:outline-none"
          />
        </div>
      )}
    </li>
  );
}

function DrillPicker({ drills, focusAreas, onAdd, usedIds }: { drills: Drill[]; focusAreas: string[]; onAdd: (d: Drill) => void; usedIds: (number | null)[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const recommended = useMemo(
    () => (focusAreas.length ? drills.filter((d) => d.focus_areas.some((f) => focusAreas.includes(f))).sort((a, b) => Number(focusAreas.includes(b.focus_areas[0])) - Number(focusAreas.includes(a.focus_areas[0]))).slice(0, 6) : []),
    [drills, focusAreas],
  );
  const filtered = drills.filter((d) => (!cat || d.category === cat) && (!q || `${d.name} ${d.description} ${d.focus_areas.join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const row = (d: Drill) => (
    <li key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-raised">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{d.name}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          {DRILL_CATEGORY_LABELS[d.category as keyof typeof DRILL_CATEGORY_LABELS]} · {d.duration} min{d.team_id ? ' · custom' : ''}
          {usedIds.includes(d.id) && <span className="text-good">· in plan</span>}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={() => onAdd(d)} aria-label={`Add ${d.name}`} icon={<Plus className="h-4 w-4" />} />
    </li>
  );
  return (
    <aside className="no-print xl:sticky xl:top-20 xl:self-start">
      <Card title="Drill library" bodyClass="p-3">
        {recommended.length > 0 && (
          <div className="mb-3 rounded-lg border border-accent/30 bg-accent/5 p-2">
            <div className="mb-1 flex items-center gap-1.5 px-2 text-xs font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" /> Recommended for linked priorities
            </div>
            <div className="mb-1 flex flex-wrap gap-1 px-2">
              {[...new Set(focusAreas)].map((f) => (
                <FocusBadge key={f} area={f} />
              ))}
            </div>
            <ul>{recommended.map(row)}</ul>
          </div>
        )}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint" />
          <Input className="pl-8" placeholder="Search drills…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          <button onClick={() => setCat('')} className={`chip border ${!cat ? 'border-accent/60 text-ink' : 'border-line text-muted'}`}>
            All
          </button>
          {DRILL_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={`chip border ${cat === c ? 'border-accent/60 text-ink' : 'border-line text-muted'}`}>
              {DRILL_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <ul className="max-h-[50vh] overflow-y-auto scroll-thin">{filtered.map(row)}</ul>
        {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted">No drills match.</p>}
      </Card>
      <Link to="/drills" className="mt-2 block text-center text-xs text-muted hover:text-ink">
        Create a custom drill →
      </Link>
    </aside>
  );
}

