import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FilePlus2, Save, Trash2, PenTool, CopyPlus } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { SavedDiagram } from '../lib/types';
import { emptyDiagram, type Diagram } from '../../shared/domain';
import { fmtDate } from '../lib/format';
import { Button, Card, ConfirmButton, Field, Input, NotYet, PageHeader, Spinner, Textarea } from '../components/ui';
import { DiagramEditor, DiagramLegend, DiagramView } from '../components/Rink';

export default function TacticalBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canEdit } = useTeam();
  const { data: saved, isLoading } = useTeamQuery<SavedDiagram[]>('/diagrams');
  const current = saved?.find((d) => String(d.id) === id);
  const [diagram, setDiagram] = useState<Diagram>(emptyDiagram('full'));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (current) {
      setDiagram(current.data);
      setName(current.name);
      setDescription(current.description);
    } else if (!id) {
      setDiagram(emptyDiagram('full'));
      setName('');
      setDescription('');
    }
    setDirty(false);
  }, [current, id]);

  const save = useTeamMutation(
    (b, asNew: boolean) => (current && !asNew ? api.patch<SavedDiagram>(`${b}/diagrams/${current.id}`, { name, description, data: diagram }) : api.post<SavedDiagram>(`${b}/diagrams`, { name: name || 'Untitled diagram', description, data: diagram })),
    {
      toast: 'Diagram saved',
      onSuccess: (d) => {
        setDirty(false);
        navigate(`/board/${d.id}`);
      },
    },
  );
  const del = useTeamMutation((b) => api.del(`${b}/diagrams/${current!.id}`), { toast: 'Diagram deleted', onSuccess: () => navigate('/board') });

  if (isLoading || !saved) return <Spinner />;
  return (
    <div>
      <PageHeader
        title="Tactical Board"
        subtitle="Position players, draw skating routes, passes and shots. Switch between full-rink and zone views. Save diagrams to reuse in meetings and systems."
        actions={
          canEdit && (
            <>
              <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => navigate('/board')}>
                New board
              </Button>
              {current && (
                <Button icon={<CopyPlus className="h-4 w-4" />} onClick={() => save.mutate(true)}>
                  Save as new
                </Button>
              )}
              <Button variant="primary" icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate(false)} disabled={!dirty && !!current}>
                {current ? (dirty ? 'Save changes' : 'Saved') : 'Save diagram'}
              </Button>
            </>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {canEdit ? (
            <DiagramEditor
              value={diagram}
              height="70vh"
              onChange={(d) => {
                setDiagram(d);
                setDirty(true);
              }}
            />
          ) : (
            <div className="card p-3">
              <DiagramView diagram={diagram} />
            </div>
          )}
          <DiagramLegend />
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <Field label="Diagram name">
              <Input disabled={!canEdit} value={name} placeholder="e.g. Breakout vs 2-man forecheck" onChange={(e) => (setName(e.target.value), setDirty(true))} />
            </Field>
            <Field label="Notes">
              <Textarea disabled={!canEdit} rows={2} value={description} onChange={(e) => (setDescription(e.target.value), setDirty(true))} />
            </Field>
          </div>
          {current && canEdit && (
            <div className="flex justify-end">
              <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete diagram" icon={<Trash2 className="h-4 w-4" />}>
                Delete diagram
              </ConfirmButton>
            </div>
          )}
          <NotYet phase="Phase 2+">Animated player movement and multi-step play sequences. For now, build step-by-step sequences as a custom system in the Team Playbook (one diagram per step).</NotYet>
        </div>
        <aside>
          <Card title={`Saved diagrams (${saved.length})`} icon={<PenTool className="h-4 w-4" />} bodyClass="p-2">
            {saved.length === 0 ? (
              <p className="p-3 text-sm text-muted">Nothing saved yet.</p>
            ) : (
              <ul className="space-y-1">
                {saved.map((d) => (
                  <li key={d.id}>
                    <Link to={`/board/${d.id}`} className={`flex gap-3 rounded-lg p-2 hover:bg-raised ${String(d.id) === id ? 'bg-raised ring-1 ring-accent/40' : ''}`}>
                      <div className="w-24 shrink-0">
                        <DiagramView diagram={d.data} />
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-medium">{d.name}</div>
                        <div className="text-xs text-muted">{fmtDate(d.updated_at.slice(0, 10))}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
