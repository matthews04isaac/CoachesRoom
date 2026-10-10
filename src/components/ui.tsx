import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Loader2, X, Info, Lock } from 'lucide-react';
import { useTeam } from '../lib/session';

// ---------------- Buttons ----------------
type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
const btnBase = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent/90 shadow-sm shadow-accent/20',
  secondary: 'bg-raised text-ink border border-line hover:border-faint/60',
  ghost: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'text-accent border border-accent/40 hover:bg-accent/10',
};
const btnSizes = { sm: 'h-8 px-3 text-xs', md: 'h-9 px-4 text-sm', lg: 'h-11 px-5 text-sm' };

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof btnSizes; loading?: boolean; icon?: ReactNode }) {
  return (
    <button type="button" className={clsx(btnBase, btnVariants[variant], btnSizes[size], className)} disabled={loading || rest.disabled} {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function LinkButton({ to, variant = 'secondary', size = 'md', icon, children, className }: { to: string; variant?: BtnVariant; size?: keyof typeof btnSizes; icon?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <Link to={to} className={clsx(btnBase, btnVariants[variant], btnSizes[size], className)}>
      {icon}
      {children}
    </Link>
  );
}

/** A button that asks for confirmation inline before running a destructive action. */
export function ConfirmButton({ onConfirm, children, confirmText = 'Confirm', loading, size = 'sm', icon }: { onConfirm: () => void; children: ReactNode; confirmText?: string; loading?: boolean; size?: keyof typeof btnSizes; icon?: ReactNode }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return armed ? (
    <Button variant="danger" size={size} loading={loading} onClick={() => (setArmed(false), onConfirm())}>
      {confirmText}
    </Button>
  ) : (
    <Button variant="ghost" size={size} icon={icon} onClick={() => setArmed(true)}>
      {children}
    </Button>
  );
}

// ---------------- Layout pieces ----------------
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</div>}
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className, bodyClass, icon }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: ReactNode }) {
  return (
    <section className={clsx('card animate-fade-up', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal text-ink">
            {icon && <span className="text-accent">{icon}</span>}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="card animate-fade-up p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className={clsx('mt-1 font-display text-3xl font-semibold', accent && 'text-accent')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  return <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">{(error as Error)?.message ?? 'Something went wrong'}</div>;
}

/** Honest labelling for features that are planned but not built yet. */
export function NotYet({ children, phase }: { children: ReactNode; phase?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-line bg-raised/50 px-3 py-2.5 text-xs text-muted">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <span className="font-semibold text-ink">Not yet available{phase ? ` · ${phase}` : ''}.</span> {children}
      </div>
    </div>
  );
}

export function ReadOnlyNote() {
  const { canEdit } = useTeam();
  if (canEdit) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted">
      <Lock className="h-3.5 w-3.5" /> You have view-only access to this team.
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'info'; className?: string }) {
  const tones = {
    neutral: 'bg-raised text-muted border border-line',
    accent: 'bg-accent/15 text-accent',
    good: 'bg-good/15 text-good',
    warn: 'bg-warn/15 text-warn',
    info: 'bg-info/15 text-info',
  };
  return <span className={clsx('chip', tones[tone], className)}>{children}</span>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-line scroll-thin" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors', value === t.value ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------- Forms ----------------
export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx('input', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={clsx('input', p.className)} />;
export const Select = ({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={clsx('input pr-8', p.className)}>
    {children}
  </select>
);

/** Comma/line separated list editor. */
export function ListInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(value.join('\n'));
  useEffect(() => setText(value.join('\n')), [value.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Textarea value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => onChange(text.split('\n').map((s) => s.trim()).filter(Boolean))} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <span className={clsx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={clsx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </label>
  );
}

// ---------------- Modal ----------------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean | 'xl' }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input,select,textarea')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={clsx('animate-fade-up flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl', wide === 'xl' ? 'sm:max-w-5xl' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 id={id} className="text-xl font-semibold">
            {title}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------- Hockey bits ----------------
export function PlayerAvatar({ player, size = 'md' }: { player: { first_name: string; last_name: string; number?: number | null; photo_url?: string | null; position?: string }; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-20 w-20 text-2xl' }[size];
  if (player.photo_url) return <img src={player.photo_url} alt="" className={clsx(dims, 'shrink-0 rounded-full object-cover')} />;
  return (
    <div className={clsx(dims, 'flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-display font-semibold')}>
      {player.number ?? `${player.first_name[0]}${player.last_name[0]}`}
    </div>
  );
}

export function TeamLogo({ team, size = 'md' }: { team: { short_name: string; color: string; logo_url?: string | null }; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-7 w-7 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-16 w-16 text-base' }[size];
  if (team.logo_url) return <img src={team.logo_url} alt="" className={clsx(dims, 'shrink-0 rounded-lg object-cover')} />;
  return (
    <div className={clsx(dims, 'flex shrink-0 items-center justify-center rounded-lg font-display font-bold tracking-wider text-white shadow-inner')} style={{ background: `linear-gradient(135deg, ${team.color}, ${team.color}aa)` }}>
      {team.short_name.slice(0, 4)}
    </div>
  );
}

export function RatingDots({ value, max = 5 }: { value: number | null | undefined; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value ? `${value} out of ${max}` : 'not rated'}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={clsx('h-2 w-2 rounded-full', value && i < value ? 'bg-accent' : 'bg-line')} />
      ))}
    </span>
  );
}

export function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <Badge>Scheduled</Badge>;
  const tone = result === 'W' ? 'good' : result === 'T' ? 'neutral' : 'accent';
  return <Badge tone={tone}>{result}</Badge>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
