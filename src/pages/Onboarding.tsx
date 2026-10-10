import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useLogout, useMe, useToast } from '../lib/session';
import { Button, Card } from '../components/ui';
import { Logo } from '../components/Layout';
import { TeamForm, type TeamFormValues } from '../components/TeamForm';

export default function Onboarding() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const logout = useLogout();
  const create = useMutation({
    mutationFn: (v: TeamFormValues) => api.post('/teams', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const demo = useMutation({
    mutationFn: () => api.post('/teams/demo'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
    onError: (e) => toast((e as Error).message, 'error'),
  });
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <button className="text-sm text-muted hover:text-ink" onClick={() => logout.mutate()}>
          Sign out
        </button>
      </div>
      <h1 className="text-4xl font-semibold">Welcome, {me?.name.split(' ')[0]}.</h1>
      <p className="mt-1 text-muted">Create your first team to get started — or load a fully populated demo team to explore.</p>
      <div className="mt-8 grid gap-6">
        <Card title="Create a team">
          <TeamForm submitLabel="Create team" onSubmit={(v) => create.mutate(v)} loading={create.isPending} showTitle />
        </Card>
        <Card title="Just looking around?" icon={<Sparkles className="h-4 w-4" />}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">Get your own copy of the Northside Hawks U15 AA: roster, evaluations, games, observations, priorities and practices. You can delete it any time.</p>
            <Button onClick={() => demo.mutate()} loading={demo.isPending}>
              Load demo team
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
