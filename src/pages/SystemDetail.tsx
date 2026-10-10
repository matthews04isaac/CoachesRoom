import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Save, Trash2, Check, X } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { TacticalSystem } from '../lib/types';
import { SYSTEM_CATEGORIES, SYSTEM_CATEGORY_LABELS, SYSTEM_TO_FOCUS, emptyDiagram, type SystemCategory } from '../../shared/domain';
import { Badge, Button, Card, ConfirmButton, ErrorNote, Field, Input, ListInput, PageHeader, Select, Spinner, Textarea } from '../components/ui';
import { DiagramEditor, DiagramLegend, DiagramView } from '../components/Rink';
import { FocusBadge } from '../components/hockey';

export default function SystemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { canEdit } = useTeam();
  const { data: s, isLoading, error } = useTeamQuery<TacticalSystem>(`/systems/${id}`);
  const [step, setStep] = useState(0);
  const editing = params.get('edit') === '1' && !!s?.team_id && canEdit;
  const [draft, setDraft] = useState<TacticalSystem | null>(null);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (s) {
      setDraft(structuredClone(s));
      setNotes(s.playbook_notes ?? '');
      setStep((st) => Math.min(st, Math.max(0, s.steps.length - 1)));
    }
  }, [s]);

  const save = useTeamMutation((b) => api.patch(`${b}/systems/${id}`, draft), { toast: 'System saved', onSuccess: () => setParams({}) });
  const dup = useTeamMutation((b) => api.post<TacticalSystem>(`${b}/systems/${id}/duplicate`), { toast: 'Team version created', onSuccess: (n) => navigate(`/playbook/${n.id}?edit=1`) });
  const del = useTeamMutation((b) => api.del(`${b}/systems/${id}`), { toast: 'System deleted', onSuccess: () => navigate('/playbook') });
  const toggle = useTeamMutation((b) => (s!.in_playbook ? api.del(`${b}/playbook/${id}`) : api.put(`${b}/playbook/${id}`, { notes })), { toast: 'Playbook updated' });
  const saveNotes = useTeamMutation((b) => api.put(`${b}/playbook/${id}`, { notes }), { toast: 'Notes saved' });

  if (isLoading) return <Spinner />;
  if (error || !s || !draft) return <ErrorNote error={error} />;
  const cur = s.steps[step];

  if (editing) {
    const setStepAt = (i: number, patch: Partial<TacticalSystem['steps'][number]>) => setDraft({ ...draft, steps: draft.steps.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
    return (
      <div>
        <PageHeader
          eyebrow="Editing team system"
          title={draft.name || 'Untitled system'}
          actions={
            <>
              <Button icon={<X className="h-4 w-4" />} onClick={() => (setDraft(structuredClone(s)), setParams({}))}>
                Cancel
              </Button>
              <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate(undefined)}>
                Save system
              </Button>
            </>
          }
        />
        <Card className="mb-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Name" className="md:col-span-2">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Category">
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {SYSTEM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SYSTEM_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Summary">
              <Textarea rows={4} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            </Field>
            <Field label="Key points" hint="One per line">
              <ListInput value={draft.key_points} onChange={(key_points) => setDraft({ ...draft, key_points })} />
            </Field>
          </div>
        </Card>
        <div className="space-y-6">
          {draft.steps.map((st, i) => (
            <Card
              key={i}
              title={`Step ${i + 1}`}
              actions={
                <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })}>
                  Remove step
                </Button>
              }
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                <div className="space-y-3">
                  <Field label="Title">
                    <Input value={st.title} onChange={(e) => setStepAt(i, { title: e.target.value })} />
                  </Field>
                  <Field label="Explanation">
                    <Textarea rows={6} value={st.body} onChange={(e) => setStepAt(i, { body: e.target.value })} />
                  </Field>
                </div>
                <DiagramEditor value={st.diagram ?? emptyDiagram('dzone')} onChange={(d) => setStepAt(i, { diagram: d })} height="45vh" />
              </div>
            </Card>
          ))}
          <Button
            icon={<Plus className="h-4 w-4" />}
            disabled={draft.steps.length >= 12}
            onClick={() => {
              const prev = draft.steps[draft.steps.length - 1]?.diagram;
              // Start the new step from the previous diagram so sequences are easy to build.
              setDraft({ ...draft, steps: [...draft.steps, { title: `Step ${draft.steps.length + 1}`, body: '', diagram: prev ? structuredClone(prev) : emptyDiagram('dzone') }] });
            }}
          >
            Add step (copies previous diagram)
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/playbook" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Team Playbook
      </Link>
      <PageHeader
        eyebrow={SYSTEM_CATEGORY_LABELS[s.category as SystemCategory]}
        title={s.name}
        actions={
          canEdit && (
            <>
              {s.team_id ? (
                <>
                  <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete system" icon={<Trash2 className="h-4 w-4" />}>
                    Delete
                  </ConfirmButton>
                  <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setParams({ edit: '1' })}>
                    Edit
                  </Button>
                </>
              ) : (
                <Button icon={<Copy className="h-4 w-4" />} loading={dup.isPending} onClick={() => dup.mutate(undefined)}>
                  Customise for my team
                </Button>
              )}
              <Button variant={s.in_playbook ? 'secondary' : 'primary'} icon={s.in_playbook ? <Check className="h-4 w-4 text-good" /> : <Plus className="h-4 w-4" />} onClick={() => toggle.mutate(undefined)}>
                {s.in_playbook ? 'In playbook' : 'Add to playbook'}
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div>
          {cur ? (
            <Card bodyClass="p-0">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <Button size="sm" variant="ghost" icon={<ChevronLeft className="h-4 w-4" />} disabled={step === 0} onClick={() => setStep(step - 1)}>
                  Prev
                </Button>
                <div className="text-center">
                  <div className="text-xs text-muted">
                    Step {step + 1} of {s.steps.length}
                  </div>
                  <div className="font-semibold">{cur.title}</div>
                </div>
                <Button size="sm" variant="ghost" disabled={step >= s.steps.length - 1} onClick={() => setStep(step + 1)}>
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-4">
                <DiagramView diagram={cur.diagram} />
                <p className="mt-4 leading-relaxed">{cur.body}</p>
                <div className="mt-4 flex gap-1.5">
                  {s.steps.map((_, i) => (
                    <button key={i} onClick={() => setStep(i)} className={`h-1.5 flex-1 rounded-full ${i === step ? 'bg-accent' : 'bg-line hover:bg-faint'}`} aria-label={`Go to step ${i + 1}`} />
                  ))}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-muted">This system has no steps yet.</p>
            </Card>
          )}
          <div className="mt-3">
            <DiagramLegend />
          </div>
        </div>
        <div className="space-y-6">
          <Card title="Overview">
            <p className="text-sm leading-relaxed text-muted">{s.summary}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              Develops <FocusBadge area={SYSTEM_TO_FOCUS[s.category as SystemCategory]} />
              {s.team_id ? <Badge tone="accent">Team system</Badge> : <Badge>BenchIQ library</Badge>}
            </div>
          </Card>
          {s.key_points.length > 0 && (
            <Card title="Key points">
              <ul className="space-y-2 text-sm">
                {s.key_points.map((k) => (
                  <li key={k} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> {k}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="All steps" bodyClass="p-2">
            <ol>
              {s.steps.map((st, i) => (
                <li key={i}>
                  <button onClick={() => setStep(i)} className={`flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm hover:bg-raised ${i === step ? 'bg-raised' : ''}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === step ? 'bg-accent text-accent-ink' : 'bg-line'}`}>{i + 1}</span>
                    {st.title}
                  </button>
                </li>
              ))}
            </ol>
          </Card>
          {s.in_playbook && (
            <Card title="Team notes">
              <Textarea rows={3} disabled={!canEdit} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How we run it, line-specific reminders…" />
              {canEdit && (
                <Button size="sm" className="mt-2" loading={saveNotes.isPending} disabled={notes === (s.playbook_notes ?? '')} onClick={() => saveNotes.mutate(undefined)}>
                  Save notes
                </Button>
              )}
            </Card>
          )}
          <Link to={`/drills`} className="block text-sm text-muted hover:text-ink">
            Find drills that teach this system →
          </Link>
        </div>
      </div>
    </div>
  );
}
