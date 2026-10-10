import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Flag, TrendingUp, PenTool } from 'lucide-react';
import { api } from '../lib/api';
import { Button, Field, Input } from '../components/ui';
import { Logo } from '../components/Layout';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'form' | 'demo' | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const done = (user: unknown) => {
    qc.setQueryData(['me'], user);
    navigate('/', { replace: true });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy('form');
    try {
      done(await api.post(mode === 'login' ? '/auth/login' : '/auth/signup', form));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const demo = async () => {
    setError('');
    setBusy('demo');
    try {
      done(await api.post('/auth/demo'));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-surface p-12 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-accent/10 blur-3xl" />
        <Logo />
        <div className="relative mt-auto">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Hockey coaching platform</div>
          <h1 className="mt-3 text-6xl font-bold leading-[0.95]">
            Plan Smarter.
            <br />
            Coach Better.
            <br />
            <span className="text-accent">Develop Every Player.</span>
          </h1>
          <p className="mt-6 max-w-md text-muted">
            Turn game observations into development priorities, the right drills, and measurable player progress — all in one coaching workspace.
          </p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3 text-sm">
            {[
              [<Flag key="f" />, 'Log game observations'],
              [<TrendingUp key="t" />, 'Track priorities & progress'],
              [<ClipboardList key="c" />, 'Build practices in minutes'],
              [<PenTool key="p" />, 'Draw drills & systems'],
            ].map(([icon, label], i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line bg-raised/60 px-3 py-2.5 text-muted [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-accent">
                {icon}
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
            <p className="mt-2 text-sm text-muted">Plan Smarter. Coach Better. Develop Every Player.</p>
          </div>
          <h2 className="text-3xl font-semibold">{mode === 'login' ? 'Welcome back, coach' : 'Create your account'}</h2>
          <p className="mt-1 text-sm text-muted">{mode === 'login' ? 'Sign in to your coaching workspace.' : 'Set up BenchIQ for your team in under a minute.'}</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <Field label="Full name">
                <Input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            )}
            <Field label="Email">
              <Input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
              <Input required type="password" minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            {error && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">{error}</div>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === 'form'}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
          </div>
          <Button size="lg" className="w-full" onClick={demo} loading={busy === 'demo'}>
            Explore the demo team
          </Button>
          <p className="mt-2 text-center text-xs text-faint">Demo login: coach@benchiq.app / hockey123</p>

          <p className="mt-8 text-center text-sm text-muted">
            {mode === 'login' ? 'New to BenchIQ?' : 'Already have an account?'}{' '}
            <button className="link" onClick={() => (setMode(mode === 'login' ? 'signup' : 'login'), setError(''))}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
