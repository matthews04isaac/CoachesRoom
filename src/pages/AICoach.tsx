import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Send, Sparkles, ShieldCheck, Trash2, X, Plus, KeyRound, Target, Dumbbell, TrendingUp } from 'lucide-react';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery, useToast } from '../lib/session';
import type { Drill, Practice } from '../lib/types';
import { Badge, Button, Card, Input, LinkButton, PageHeader, Spinner, Textarea, Toggle } from '../components/ui';
import { Markdown } from '../components/Markdown';

interface Draft {
  title: string;
  duration: number;
  objectives: string;
  segments: { drill_id: number | null; title: string; duration: number; notes: string }[];
  priority_ids: number[];
}
interface Msg {
  role: 'user' | 'assistant';
  content: string;
  draft?: Draft | null;
}

const QUICK = [
  'Our wingers are leaving the defensive zone too early on breakouts. Create a 60-minute practice to fix it.',
  'Summarise our game observations from the last five games and tell me what to prioritise.',
  'Create a development plan for our lowest-rated defenceman based on their evaluations.',
  'Explain the 1-2-2 forecheck in a way I can teach to U13 players.',
  'Our power play entries keep stalling at the blue line. What corrections and drills do you suggest?',
  'What skills should we emphasise at U11 versus U15?',
];

export default function AICoach() {
  const { team, canEdit } = useTeam();
  const [params] = useSearchParams();
  const status = useQuery<{ enabled: boolean; model: string | null }>({ queryKey: ['ai-status'], queryFn: () => api.get('/ai/status') });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(params.get('prompt') ?? '');
  const [useTeamData, setUseTeamData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages, busy]);

  if (status.isLoading || !team) return <Spinner />;
  if (!status.data?.enabled) return <AIDisabled />;

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setErr('');
    try {
      const res = await api.post<{ reply: string; draft: Draft | null; truncated?: boolean }>(`/teams/${team.id}/ai/chat`, {
        use_team_data: useTeamData,
        messages: next.map((m) => ({ role: m.role, content: m.content + (m.draft ? `\n\n[Practice draft proposed: ${m.draft.title}, ${m.draft.segments.map((s) => `${s.title} ${s.duration}min`).join('; ')}]` : '') })),
      });
      setMessages([...next, { role: 'assistant', content: res.reply + (res.truncated ? '\n\n*(Response was cut off — ask me to continue.)*' : ''), draft: res.draft }]);
    } catch (e) {
      setErr((e as Error).message);
      setMessages(messages);
      setInput(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            AI Coach <Badge tone="info">Beta</Badge>
          </span>
        }
        subtitle="Practice plans, drill recommendations, system explanations and development plans grounded in your team’s data. Everything it suggests is editable and nothing is saved without your approval."
        actions={
          messages.length > 0 && (
            <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setMessages([])}>
              New conversation
            </Button>
          )
        }
      />
      <div className="card flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4 scroll-thin sm:p-6">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl py-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-2xl font-semibold">How can I help you coach {team.short_name} today?</h2>
              <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => send(q)} className="rounded-xl border border-line bg-raised/50 p-3 text-sm text-muted transition-colors hover:border-accent/50 hover:text-ink">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-ink">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <Markdown text={m.content} />
                      {m.draft && <DraftCard draft={m.draft} canSave={canEdit} />}
                    </div>
                  </div>
                ),
              )}
              {busy && (
                <div className="flex gap-3 text-sm text-muted">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Sparkles className="h-4 w-4 animate-pulse" />
                  </div>
                  <span className="self-center">Thinking through your team’s data…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
        <div className="border-t border-line p-3 sm:p-4">
          {err && <div className="mb-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">{err}</div>}
          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea
              rows={2}
              className="flex-1 resize-none"
              placeholder="Ask about practices, drills, systems, players…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!input.trim()} icon={<Send className="h-4 w-4" />} aria-label="Send" />
          </form>
          <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <Toggle checked={useTeamData} onChange={setUseTeamData} label={<span>Share {team.short_name} data (roster, evaluations, observations, priorities, drills) with the assistant</span>} />
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> {status.data.model}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftCard({ draft, canSave }: { draft: Draft; canSave: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: drills = [] } = useTeamQuery<Drill[]>('/drills');
  const [d, setD] = useState<Draft>(draft);
  const [saved, setSaved] = useState<number | null>(null);
  const total = d.segments.reduce((a, s) => a + s.duration, 0);
  const save = useTeamMutation(
    (b) =>
      api.post<Practice>(`${b}/practices`, {
        title: d.title,
        duration: d.duration,
        objectives: d.objectives,
        status: 'draft',
        source: 'ai',
        segments: d.segments,
        priority_ids: d.priority_ids,
      }),
    {
      onSuccess: (p) => {
        setSaved(p.id);
        toast('Saved as a draft practice');
      },
    },
  );
  const setSeg = (i: number, patch: Partial<Draft['segments'][number]>) => setD({ ...d, segments: d.segments.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-accent/40 bg-raised/40">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent/5 px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-accent" />
        <span className="text-sm font-semibold">Proposed practice — review & edit before saving</span>
        <span className={`ml-auto text-xs font-semibold ${total === d.duration ? 'text-good' : 'text-warn'}`}>
          {total} / {d.duration} min
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
          <Input value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} aria-label="Practice title" />
          <Input type="number" value={d.duration} onChange={(e) => setD({ ...d, duration: Number(e.target.value) })} aria-label="Total minutes" />
        </div>
        <Textarea rows={2} value={d.objectives} onChange={(e) => setD({ ...d, objectives: e.target.value })} aria-label="Objectives" />
        <ol className="space-y-2">
          {d.segments.map((s, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 text-center text-xs text-muted">{i + 1}</span>
                <input className="flex-1 bg-transparent text-sm font-medium focus:outline-none" value={s.title} onChange={(e) => setSeg(i, { title: e.target.value })} aria-label="Segment title" />
                {s.drill_id ? (
                  <Badge tone="info">
                    <Dumbbell className="h-3 w-3" /> {drills.find((x) => x.id === s.drill_id)?.name ? 'Library drill' : 'Drill'}
                  </Badge>
                ) : (
                  <Badge>Custom</Badge>
                )}
                <input type="number" min={1} className="input h-7 w-14 px-1 py-0 text-center text-xs" value={s.duration} onChange={(e) => setSeg(i, { duration: Math.max(1, Number(e.target.value) || 1) })} aria-label="Minutes" />
                <button onClick={() => setD({ ...d, segments: d.segments.filter((_, j) => j !== i) })} className="text-faint hover:text-accent" aria-label="Remove segment">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {s.notes && <textarea className="mt-1 w-full resize-y bg-transparent pl-7 text-xs text-muted focus:text-ink focus:outline-none" rows={2} value={s.notes} onChange={(e) => setSeg(i, { notes: e.target.value })} />}
            </li>
          ))}
        </ol>
        <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setD({ ...d, segments: [...d.segments, { drill_id: null, title: 'New segment', duration: 5, notes: '' }] })}>
          Add segment
        </Button>
        {d.priority_ids.length > 0 && (
          <p className="flex items-center gap-1 text-xs text-muted">
            <Target className="h-3.5 w-3.5 text-accent" /> Will be linked to {d.priority_ids.length} development priorit{d.priority_ids.length > 1 ? 'ies' : 'y'}.
          </p>
        )}
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          {saved ? (
            <Button variant="primary" onClick={() => navigate(`/practices/${saved}`)}>
              Open in Practice Planner
            </Button>
          ) : canSave ? (
            <Button variant="primary" loading={save.isPending} disabled={!d.segments.length} onClick={() => save.mutate(undefined)}>
              Approve & save as draft practice
            </Button>
          ) : (
            <span className="text-xs text-muted">View-only access — you can’t save practices.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AIDisabled() {
  const { team } = useTeam();
  const ctx = useTeamQuery<string>('/ai/context', { enabled: false });
  return (
    <div>
      <PageHeader title="AI Coach" subtitle="A hockey-specific assistant that uses your team’s data to generate practices, recommend drills and explain systems." />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card title="The AI Coach isn’t configured on this server" icon={<KeyRound className="h-4 w-4" />}>
          <div className="space-y-3 text-sm text-muted">
            <p>
              The AI Coach uses Anthropic’s Claude API. To turn it on, set <code className="rounded bg-raised px-1 text-ink">ANTHROPIC_API_KEY</code> in the server environment (see <code className="rounded bg-raised px-1 text-ink">.env.example</code>) and restart BenchIQ.
            </p>
            <p>When enabled, it can draft practices from prompts like “Our U15 team is struggling with breakouts — create a 60-minute practice”, using your roster, evaluations, game observations, priorities and drill library. Every plan is shown as an editable draft that you must approve before it’s saved.</p>
            <Button size="sm" onClick={() => ctx.refetch()} loading={ctx.isFetching}>
              Preview the team data it would use
            </Button>
            {ctx.data && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-raised p-3 text-[11px] leading-relaxed text-ink scroll-thin">{ctx.data}</pre>}
          </div>
        </Card>
        <Card title={`Available now without AI`}>
          <p className="mb-4 text-sm text-muted">These rule-based tools work today and use the same connected data for {team?.short_name}:</p>
          <div className="space-y-2">
            <LinkButton to="/games?tab=priorities" className="w-full justify-start" icon={<Target className="h-4 w-4" />}>
              Priority → recommended drills → next practice
            </LinkButton>
            <LinkButton to="/players" className="w-full justify-start" icon={<TrendingUp className="h-4 w-4" />}>
              Drill recommendations from player evaluations
            </LinkButton>
            <LinkButton to="/practices" className="w-full justify-start" icon={<Dumbbell className="h-4 w-4" />}>
              Practice templates
            </LinkButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
