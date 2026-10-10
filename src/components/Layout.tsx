import { useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Dumbbell,
  PenTool,
  BookMarked,
  TrendingUp,
  Flag,
  Sparkles,
  GraduationCap,
  CalendarDays,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  Check,
  Plus,
} from 'lucide-react';
import { useLogout, useMe, useTeam, useTheme } from '../lib/session';
import { TeamLogo } from './ui';

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard />, end: true },
  { to: '/teams', label: 'My Teams', icon: <Users /> },
  { to: '/practices', label: 'Practice Planner', icon: <ClipboardList /> },
  { to: '/drills', label: 'Drill Library', icon: <Dumbbell /> },
  { to: '/board', label: 'Tactical Board', icon: <PenTool /> },
  { to: '/playbook', label: 'Team Playbook', icon: <BookMarked /> },
  { to: '/players', label: 'Player Development', icon: <TrendingUp /> },
  { to: '/games', label: 'Game Review', icon: <Flag /> },
  { to: '/ai', label: 'AI Coach', icon: <Sparkles /> },
  { to: '/library', label: 'Coaching Library', icon: <GraduationCap /> },
  { to: '/calendar', label: 'Calendar', icon: <CalendarDays /> },
  { to: '/settings', label: 'Settings', icon: <Settings /> },
];

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#111113" />
        <path d="M8 22 L14 9 L18 17 L21 12 L25 22" fill="none" stroke="#e11d2e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!collapsed && (
        <span className="font-display text-2xl font-bold tracking-wide">
          Bench<span className="text-accent">IQ</span>
        </span>
      )}
    </div>
  );
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('biq-sidebar') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);
  useEffect(() => {
    try {
      localStorage.setItem('biq-sidebar', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const nav = (isCollapsed: boolean) => (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 scroll-thin" aria-label="Main">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          title={isCollapsed ? n.label : undefined}
          className={({ isActive }) =>
            clsx(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:shrink-0',
              isActive ? 'bg-accent/10 text-ink [&>svg]:text-accent' : 'text-muted hover:bg-raised hover:text-ink',
              isCollapsed && 'justify-center px-0',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" />}
              {n.icon}
              {!isCollapsed && <span className="truncate">{n.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-full">
      {/* Desktop sidebar */}
      <aside className={clsx('no-print sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex', collapsed ? 'w-[68px]' : 'w-60')}>
        <div className={clsx('flex h-16 items-center border-b border-line', collapsed ? 'justify-center' : 'px-4')}>
          <Logo collapsed={collapsed} />
        </div>
        {nav(collapsed)}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 flex items-center justify-center gap-2 rounded-lg py-2 text-xs text-muted hover:bg-raised hover:text-ink"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : (
            <>
              <ChevronsLeft className="h-4 w-4" /> Collapse
            </>
          )}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="animate-fade-up absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-surface">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <button onClick={() => setMobileOpen(false)} className="rounded p-1 text-muted hover:text-ink" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { data: me } = useMe();
  const { teams, team, setTeamId } = useTeam();
  const [theme, setTheme] = useTheme();
  const logout = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState<'team' | 'user' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const isDark = theme === 'dark' || (theme === 'system' && document.documentElement.dataset.theme === 'dark');

  return (
    <header ref={ref} className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button onClick={onMenu} className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="lg:hidden">
        <Logo collapsed />
      </div>

      {team && (
        <div className="relative">
          <button onClick={() => setOpen(open === 'team' ? null : 'team')} className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2.5 hover:bg-raised" aria-haspopup="listbox" aria-expanded={open === 'team'}>
            <TeamLogo team={team} size="sm" />
            <div className="hidden text-left sm:block">
              <div className="max-w-[220px] truncate text-sm font-semibold leading-tight">{team.name}</div>
              <div className="text-[11px] text-muted">
                {team.division} {team.level} · {team.season}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
          {open === 'team' && (
            <div className="animate-fade-up absolute left-0 top-full mt-1 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-2xl" role="listbox">
              <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Switch team</div>
              {teams.map((t) => (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={t.id === team.id}
                  onClick={() => {
                    setTeamId(t.id);
                    setOpen(null);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-raised"
                >
                  <TeamLogo team={t} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.name}</div>
                    <div className="text-[11px] text-muted">
                      {t.division} {t.level} · {t.permission}
                    </div>
                  </div>
                  {t.id === team.id && <Check className="h-4 w-4 text-accent" />}
                </button>
              ))}
              <button
                onClick={() => {
                  setOpen(null);
                  navigate('/teams?new=1');
                }}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-line px-2.5 py-2 text-sm text-muted hover:bg-raised hover:text-ink"
              >
                <Plus className="h-4 w-4" /> Create a team
              </button>
            </div>
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className="rounded-lg p-2 text-muted hover:bg-raised hover:text-ink" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} title="Toggle light / dark">
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <div className="relative">
          <button onClick={() => setOpen(open === 'user' ? null : 'user')} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-raised" aria-label="Account menu">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
              {me?.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .slice(0, 2)}
            </span>
          </button>
          {open === 'user' && (
            <div className="animate-fade-up absolute right-0 top-full mt-1 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-2xl">
              <div className="px-3 py-2">
                <div className="text-sm font-semibold">{me?.name}</div>
                <div className="truncate text-xs text-muted">{me?.email}</div>
              </div>
              <button onClick={() => (setOpen(null), navigate('/settings'))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
                <Settings className="h-4 w-4" /> Settings
              </button>
              <button onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login') })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-raised hover:text-ink">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
