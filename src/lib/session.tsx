import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { Team, User } from './types';

// ---------------- Auth ----------------
export function useMe() {
  return useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<User>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(['me'], null);
    },
  });
}

// ---------------- Current team ----------------
interface TeamCtx {
  teams: Team[];
  team: Team | null;
  setTeamId: (id: number) => void;
  canEdit: boolean;
  isAdmin: boolean;
  loading: boolean;
}
const TeamContext = createContext<TeamCtx>(null!);
const KEY = 'biq-team';

export function TeamProvider({ children }: { children: ReactNode }) {
  const { data: teams = [], isLoading } = useQuery<Team[]>({ queryKey: ['teams'], queryFn: () => api.get('/teams') });
  const [teamId, setTeamIdState] = useState<number | null>(() => {
    try {
      return Number(localStorage.getItem(KEY)) || null;
    } catch {
      return null;
    }
  });
  const team = teams.find((t) => t.id === teamId) ?? teams[0] ?? null;
  useEffect(() => {
    if (team && team.id !== teamId) setTeamIdState(team.id);
  }, [team, teamId]);
  const value = useMemo<TeamCtx>(
    () => ({
      teams,
      team,
      loading: isLoading,
      canEdit: team ? team.permission !== 'view' : false,
      isAdmin: team?.permission === 'admin',
      setTeamId: (id) => {
        setTeamIdState(id);
        try {
          localStorage.setItem(KEY, String(id));
        } catch {
          /* ignore */
        }
      },
    }),
    [teams, team, isLoading],
  );
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export const useTeam = () => useContext(TeamContext);

/** GET a team-scoped resource, e.g. useTeamQuery<Player[]>('/players'). */
export function useTeamQuery<T>(path: string, opts: Partial<UseQueryOptions<T>> = {}) {
  const { team } = useTeam();
  return useQuery<T>({
    queryKey: ['team', team?.id, path],
    queryFn: () => api.get<T>(`/teams/${team!.id}${path}`),
    enabled: !!team && (opts.enabled ?? true),
    ...opts,
  } as UseQueryOptions<T>);
}

/**
 * Team-scoped mutation. On success every query for the team is invalidated —
 * simple and always consistent, since most writes ripple through the connected
 * views (dashboard, priorities, trends).
 */
export function useTeamMutation<TVars = any, TRes = any>(fn: (teamPath: string, vars: TVars) => Promise<TRes>, opts: { onSuccess?: (res: TRes, vars: TVars) => void; toast?: string } = {}) {
  const { team } = useTeam();
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation<TRes, ApiError, TVars>({
    mutationFn: (vars) => fn(`/teams/${team!.id}`, vars),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['team', team!.id] });
      qc.invalidateQueries({ queryKey: ['teams'] });
      if (opts.toast) toast(opts.toast);
      opts.onSuccess?.(res, vars);
    },
    onError: (e) => toast(e.message, 'error'),
  });
}

// ---------------- Toasts ----------------
type Toast = { id: number; msg: string; kind: 'ok' | 'error' };
const ToastContext = createContext<(msg: string, kind?: 'ok' | 'error') => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (msg: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 2800);
  };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[100] flex flex-col gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-up rounded-lg border px-4 py-2.5 text-sm shadow-lg ${t.kind === 'error' ? 'border-accent/50 bg-accent text-accent-ink' : 'border-line bg-raised text-ink'}`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// ---------------- Theme ----------------
export type ThemePref = 'dark' | 'light' | 'system';
function useThemeState() {
  const [pref, setPref] = useState<ThemePref>(() => {
    try {
      return (localStorage.getItem('biq-theme') as ThemePref) || 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    const apply = () => {
      const t = pref === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : pref;
      document.documentElement.dataset.theme = t;
    };
    apply();
    try {
      localStorage.setItem('biq-theme', pref);
    } catch {
      /* ignore */
    }
    if (pref === 'system') {
      const mq = matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [pref]);
  return [pref, setPref] as const;
}

const ThemeContext = createContext<readonly [ThemePref, (t: ThemePref) => void]>(['dark', () => {}]);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useThemeState();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
