import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Pencil, Plus, Search, Trash2, ClipboardPlus, Dumbbell } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { Drill, Practice } from '../lib/types';
import { AGE_DIVISIONS, DEFAULT_EVAL_CATEGORIES, DRILL_CATEGORIES, DRILL_CATEGORY_LABELS, FOCUS_AREAS, FOCUS_AREA_LABELS, emptyDiagram, type Diagram } from '../../shared/domain';
import { fmtDateTime, todayStr } from '../lib/format';
import { Badge, Button, ConfirmButton, Empty, Field, Input, ListInput, Modal, PageHeader, ReadOnlyNote, Select, Spinner, Textarea } from '../components/ui';
import { CategoryBadge, FocusBadge } from '../components/hockey';
import { DiagramEditor, DiagramLegend, DiagramView } from '../components/Rink';

export default function Drills() {
  const { canEdit } = useTeam();
  const { data: drills, isLoading } = useTeamQuery<Drill[]>('/drills');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [focus, setFocus] = useState('');
  const [age, setAge] = useState('');
  const [mine, setMine] = useState(false);
  const [viewing, setViewing] = useState<Drill | null>(null);
  const [editing, setEditing] = useState<Drill | 'new' | null>(null);

  const filtered = useMemo(
    () =>
      (drills ?? []).filter(
        (d) =>
          (!cat || d.category === cat) &&
          (!focus || d.focus_areas.includes(focus)) &&
          (!age || d.age_levels.includes(age)) &&
          (!mine || d.team_id !== null) &&
          (!q || `${d.name} ${d.description} ${d.coaching_points.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [drills, q, cat, focus, age, mine],
  );
  if (isLoading || !drills) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Drill Library"
        subtitle={`${drills.length} drills · BenchIQ library plus your team’s custom drills. Every drill is tagged with the focus areas it develops.`}
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              New drill
            </Button>
          )
        }
      />
      <ReadOnlyNote />
      <div className="card mb-5 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint" />
          <Input className="pl-8" placeholder="Search drills, coaching points…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {DRILL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {DRILL_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select value={focus} onChange={(e) => setFocus(e.target.value)} aria-label="Focus area">
          <option value="">All focus areas</option>
          {FOCUS_AREAS.map((c) => (
            <option key={c} value={c}>
              {FOCUS_AREA_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select value={age} onChange={(e) => setAge(e.target.value)} aria-label="Age">
          <option value="">All ages</option>
          {AGE_DIVISIONS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 px-1 text-sm text-muted">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-[rgb(var(--accent))]" /> Custom only
        </label>
      </div>

      {filtered.length === 0 ? (
        <Empty icon={<Dumbbell className="h-8 w-8" />} title="No drills match these filters" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((d) => (
            <button key={d.id} onClick={() => setViewing(d)} className="card animate-fade-up group overflow-hidden text-left transition-colors hover:border-accent/50">
              <div className="border-b border-line bg-raised/40 p-2">{d.diagram ? <DiagramView diagram={d.diagram} className="max-h-36" /> : <div className="flex h-28 items-center justify-center text-xs text-faint">No diagram</div>}</div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-sans text-sm font-semibold tracking-normal group-hover:text-accent">{d.name}</h3>
                  <span className="shrink-0 text-xs text-muted">{d.duration}′</span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{d.description}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <CategoryBadge category={d.category} />
                  {d.focus_areas.slice(0, 2).map((f) => (
                    <FocusBadge key={f} area={f} />
                  ))}
                  {d.team_id && <Badge tone="accent">Custom</Badge>}
                  {d.used ? <Badge>Used {d.used}×</Badge> : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <DrillDetailModal
          drill={viewing}
          onClose={() => setViewing(null)}
          onEdit={(d) => {
            setViewing(null);
            setEditing(d);
          }}
        />
      )}
      {editing && <DrillEditorModal drill={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DrillDetailModal({ drill, onClose, onEdit }: { drill: Drill; onClose: () => void; onEdit: (d: Drill) => void }) {
  const { canEdit } = useTeam();
  const navigate = useNavigate();
  const { data: practices = [] } = useTeamQuery<Practice[]>('/practices');
  const upcoming = practices.filter((p) => !p.is_template && (!p.scheduled_at || p.scheduled_at.slice(0, 10) >= todayStr()));
  const [target, setTarget] = useState('');
  const dup = useTeamMutation((b) => api.post<Drill>(`${b}/drills/${drill.id}/duplicate`), { toast: 'Copied to your team’s drills', onSuccess: (d) => onEdit(d) });
  const del = useTeamMutation((b) => api.del(`${b}/drills/${drill.id}`), { toast: 'Drill deleted', onSuccess: onClose });
  const addTo = useTeamMutation(
    async (b, practiceId: string) => {
      const p = await api.get<Practice>(`${b}/practices/${practiceId}`);
      await api.patch(`${b}/practices/${practiceId}`, {
        segments: [...p.segments.map(({ drill_id, title, duration, notes }) => ({ drill_id, title, duration, notes })), { drill_id: drill.id, title: drill.name, duration: drill.duration, notes: '' }],
      });
      return practiceId;
    },
    { toast: 'Added to practice', onSuccess: (pid) => navigate(`/practices/${pid}`) },
  );
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={drill.name}
      footer={
        canEdit && (
          <>
            {drill.team_id ? (
              <>
                <div className="mr-auto">
                  <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete drill" icon={<Trash2 className="h-4 w-4" />}>
                    Delete
                  </ConfirmButton>
                </div>
                <Button icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(drill)}>
                  Edit
                </Button>
              </>
            ) : (
              <Button icon={<Copy className="h-4 w-4" />} loading={dup.isPending} onClick={() => dup.mutate(undefined)}>
                Duplicate & customise
              </Button>
            )}
            <Select className="h-9 w-auto max-w-[220px]" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Practice">
              <option value="">Add to practice…</option>
              {upcoming.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} {p.scheduled_at ? `(${fmtDateTime(p.scheduled_at)})` : ''}
                </option>
              ))}
            </Select>
            <Button variant="primary" icon={<ClipboardPlus className="h-4 w-4" />} disabled={!target} loading={addTo.isPending} onClick={() => addTo.mutate(target)}>
              Add
            </Button>
          </>
        )
      }
    >
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          {drill.diagram ? <DiagramView diagram={drill.diagram} className="rounded-lg border border-line" /> : <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-line text-sm text-faint">No diagram</div>}
          <div className="mt-2">
            <DiagramLegend />
          </div>
        </div>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <CategoryBadge category={drill.category} />
            <Badge>{drill.duration} min</Badge>
            <Badge tone={drill.intensity === 'high' ? 'accent' : drill.intensity === 'medium' ? 'warn' : 'neutral'}>{drill.intensity} intensity</Badge>
            {drill.team_id ? <Badge tone="accent">Custom</Badge> : <Badge>BenchIQ library</Badge>}
          </div>
          <p className="leading-relaxed text-muted">{drill.description}</p>
          {drill.coaching_points.length > 0 && (
            <div>
              <div className="label">Coaching points</div>
              <ul className="space-y-1.5">
                {drill.coaching_points.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="label">Equipment</div>
              <p className="text-muted">{drill.equipment.join(', ') || '—'}</p>
            </div>
            <div>
              <div className="label">Ages</div>
              <p className="text-muted">{drill.age_levels.join(', ') || 'All'}</p>
            </div>
          </div>
          {drill.focus_areas.length > 0 && (
            <div>
              <div className="label">Develops</div>
              <div className="flex flex-wrap gap-1">
                {drill.focus_areas.map((f) => (
                  <FocusBadge key={f} area={f} />
                ))}
                {drill.skills.map((s) => (
                  <Badge key={s}>{DEFAULT_EVAL_CATEGORIES.find((c) => c.key === s)?.label ?? s}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function DrillEditorModal({ drill, onClose }: { drill: Drill | null; onClose: () => void }) {
  const [v, setV] = useState({
    name: drill?.name ?? '',
    category: drill?.category ?? 'skating',
    description: drill?.description ?? '',
    duration: drill?.duration ?? 10,
    intensity: drill?.intensity ?? 'medium',
    age_levels: drill?.age_levels ?? [],
    focus_areas: drill?.focus_areas ?? [],
    skills: drill?.skills ?? [],
    coaching_points: drill?.coaching_points ?? [],
    equipment: drill?.equipment ?? ['Pucks'],
  });
  const [diagram, setDiagram] = useState<Diagram>(drill?.diagram ?? emptyDiagram('full'));
  const save = useTeamMutation((b) => (drill ? api.patch(`${b}/drills/${drill.id}`, { ...v, diagram }) : api.post(`${b}/drills`, { ...v, diagram })), { toast: drill ? 'Drill updated' : 'Drill created', onSuccess: onClose });
  const toggle = (k: 'age_levels' | 'focus_areas' | 'skills', val: string) => setV({ ...v, [k]: v[k].includes(val) ? v[k].filter((x) => x !== val) : [...v[k], val] });
  return (
    <Modal
      open
      onClose={onClose}
      wide="xl"
      title={drill ? `Edit drill` : 'New drill'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Save drill
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <Field label="Name">
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category">
              <Select value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>
                {DRILL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DRILL_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Minutes">
              <Input type="number" min={1} max={120} value={v.duration} onChange={(e) => setV({ ...v, duration: Number(e.target.value) })} />
            </Field>
            <Field label="Intensity">
              <Select value={v.intensity} onChange={(e) => setV({ ...v, intensity: e.target.value as Drill['intensity'] })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </div>
          <Field label="Description / setup">
            <Textarea rows={4} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
          </Field>
          <Field label="Coaching points" hint="One per line">
            <ListInput value={v.coaching_points} onChange={(coaching_points) => setV({ ...v, coaching_points })} />
          </Field>
          <Field label="Equipment" hint="One per line">
            <ListInput value={v.equipment} onChange={(equipment) => setV({ ...v, equipment })} />
          </Field>
          <div>
            <span className="label">Focus areas (connects to game observations & priorities)</span>
            <div className="flex flex-wrap gap-1.5">
              {FOCUS_AREAS.map((f) => (
                <Chip key={f} on={v.focus_areas.includes(f)} onClick={() => toggle('focus_areas', f)}>
                  {FOCUS_AREA_LABELS[f]}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Skills developed (connects to evaluations)</span>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_EVAL_CATEGORIES.map((c) => (
                <Chip key={c.key} on={v.skills.includes(c.key)} onClick={() => toggle('skills', c.key)}>
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Age levels</span>
            <div className="flex flex-wrap gap-1.5">
              {AGE_DIVISIONS.map((a) => (
                <Chip key={a} on={v.age_levels.includes(a)} onClick={() => toggle('age_levels', a)}>
                  {a}
                </Chip>
              ))}
            </div>
          </div>
        </div>
        <div>
          <span className="label">Rink diagram</span>
          <DiagramEditor value={diagram} onChange={setDiagram} />
          <div className="mt-2">
            <DiagramLegend />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`chip border py-1 ${on ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line text-muted hover:text-ink'}`}>
      {children}
    </button>
  );
}
