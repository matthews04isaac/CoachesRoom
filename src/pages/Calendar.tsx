import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { useTeam, useTeamMutation, useTeamQuery } from '../lib/session';
import type { CalendarItem } from '../lib/types';
import { fmtDateLong, fmtTime, parseLocal, toLocalDate, todayStr } from '../lib/format';
import { Badge, Button, ConfirmButton, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui';

const TYPE_STYLE: Record<string, string> = {
  practice: 'bg-info/15 text-info border-info/30',
  game: 'bg-accent/15 text-accent border-accent/30',
  tournament: 'bg-warn/15 text-warn border-warn/30',
  meeting: 'bg-good/15 text-good border-good/30',
  other: 'bg-raised text-muted border-line',
};
const TYPES = ['practice', 'game', 'tournament', 'meeting', 'other'];

export default function Calendar() {
  const { canEdit } = useTeam();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [types, setTypes] = useState<string[]>(TYPES);
  const [editing, setEditing] = useState<CalendarItem | { date: string } | null>(null);
  const gridStart = new Date(month);
  gridStart.setDate(1 - ((month.getDay() + 6) % 7)); // weeks start Monday
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 42);
  const { data, isLoading } = useTeamQuery<CalendarItem[]>(`/calendar?from=${toLocalDate(gridStart)}&to=${toLocalDate(gridEnd)}`);
  const items = useMemo(() => (data ?? []).filter((i) => types.includes(i.type)), [data, types]);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const byDay = (d: Date) => {
    const key = toLocalDate(d);
    // Multi-day events (tournaments) show on every day they span.
    return items.filter((i) => i.starts_at.slice(0, 10) === key || (i.ends_at && i.starts_at.slice(0, 10) < key && i.ends_at.slice(0, 10) >= key));
  };
  const open = (i: CalendarItem) => (i.link ? navigate(i.link) : setEditing(i));
  const today = todayStr();
  const monthItems = items.filter((i) => parseLocal(i.starts_at).getMonth() === month.getMonth() && parseLocal(i.starts_at).getFullYear() === month.getFullYear());

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Practices, games, tournaments and meetings in one place. Practices and games come straight from the Practice Planner and Game Review."
        actions={
          canEdit && (
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing({ date: today })}>
              Add event
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month" />
          <h2 className="w-48 text-center text-2xl font-semibold">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <Button size="sm" variant="ghost" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month" />
          <Button size="sm" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Today
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]))} className={clsx('chip border py-1 capitalize', types.includes(t) ? TYPE_STYLE[t] : 'border-line text-faint line-through')}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="card hidden overflow-hidden md:block">
            <div className="grid grid-cols-7 border-b border-line bg-raised/50 text-center text-xs font-semibold uppercase tracking-wider text-muted">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((d) => {
                const key = toLocalDate(d);
                const inMonth = d.getMonth() === month.getMonth();
                const list = byDay(d);
                return (
                  <div
                    key={key}
                    className={clsx('group min-h-[110px] border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-bg/40')}
                    onDoubleClick={() => canEdit && setEditing({ date: key })}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={clsx('flex h-6 w-6 items-center justify-center rounded-full text-xs', key === today ? 'bg-accent font-bold text-accent-ink' : inMonth ? 'text-ink' : 'text-faint')}>{d.getDate()}</span>
                      {canEdit && (
                        <button onClick={() => setEditing({ date: key })} className="rounded p-0.5 text-faint opacity-0 hover:text-ink group-hover:opacity-100" aria-label={`Add event on ${key}`}>
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {list.slice(0, 4).map((i) => (
                        <button key={i.key} onClick={() => open(i)} className={clsx('block w-full truncate rounded border px-1.5 py-0.5 text-left text-[11px] font-medium', TYPE_STYLE[i.type] ?? TYPE_STYLE.other)} title={`${i.title} · ${fmtTime(i.starts_at)}`}>
                          {fmtTime(i.starts_at) && i.starts_at.slice(0, 10) === key ? `${fmtTime(i.starts_at)} ` : ''}
                          {i.title}
                          {i.score ? ` (${i.result} ${i.score})` : ''}
                        </button>
                      ))}
                      {list.length > 4 && <div className="px-1 text-[10px] text-muted">+{list.length - 4} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Agenda view on small screens */}
          <div className="space-y-2 md:hidden">
            {monthItems.length === 0 && <p className="text-sm text-muted">Nothing this month.</p>}
            {monthItems.map((i) => (
              <button key={i.key} onClick={() => open(i)} className="card flex w-full items-center gap-3 p-3 text-left">
                <div className="w-12 text-center">
                  <div className="text-[10px] font-semibold uppercase text-accent">{parseLocal(i.starts_at).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                  <div className="font-display text-xl font-semibold">{parseLocal(i.starts_at).getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.title}</div>
                  <div className="text-xs text-muted">
                    {fmtTime(i.starts_at)} {i.location ? `· ${i.location}` : ''}
                  </div>
                </div>
                <Badge className={clsx('border capitalize', TYPE_STYLE[i.type])}>{i.type}</Badge>
              </button>
            ))}
          </div>
        </>
      )}
      {editing && <EventModal item={'key' in editing ? editing : null} date={'date' in editing ? editing.date : undefined} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EventModal({ item, date, onClose }: { item: CalendarItem | null; date?: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { canEdit } = useTeam();
  const [v, setV] = useState({
    type: item?.type ?? 'meeting',
    title: item?.title ?? '',
    date: item?.starts_at.slice(0, 10) ?? date ?? todayStr(),
    time: item?.starts_at.slice(11, 16) ?? '18:00',
    end_date: item?.ends_at?.slice(0, 10) ?? '',
    end_time: item?.ends_at?.slice(11, 16) ?? '',
    location: item?.location ?? '',
    notes: item?.notes ?? '',
  });
  const body = () => ({
    type: v.type,
    title: v.title,
    starts_at: `${v.date}T${v.time || '00:00'}`,
    ends_at: v.end_date || v.end_time ? `${v.end_date || v.date}T${v.end_time || '23:59'}` : null,
    location: v.location,
    notes: v.notes,
  });
  const save = useTeamMutation((b) => (item ? api.patch(`${b}/events/${item.id}`, body()) : api.post(`${b}/events`, body())), { toast: 'Event saved', onSuccess: onClose });
  const del = useTeamMutation((b) => api.del(`${b}/events/${item!.id}`), { toast: 'Event deleted', onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={item ? (canEdit ? 'Edit event' : item.title) : 'Add event'}
      footer={
        canEdit && (
          <>
            {item && (
              <div className="mr-auto">
                <ConfirmButton onConfirm={() => del.mutate(undefined)} confirmText="Delete" icon={<Trash2 className="h-4 w-4" />}>
                  Delete
                </ConfirmButton>
              </div>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(undefined)}>
              Save
            </Button>
          </>
        )
      }
    >
      {!canEdit && item ? (
        <div className="space-y-2 text-sm">
          <p>
            {fmtDateLong(item.starts_at)} {fmtTime(item.starts_at)}
          </p>
          {item.location && <p className="text-muted">{item.location}</p>}
          {item.notes && <p>{item.notes}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {!item && (
            <div className="flex flex-wrap gap-2 rounded-lg bg-raised p-2 text-xs text-muted">
              Adding a practice or game?
              <button className="link" onClick={() => navigate('/practices?new=1')}>
                Plan a practice
              </button>
              ·
              <button className="link" onClick={() => navigate('/games?new=1')}>
                Schedule a game
              </button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
                <option value="tournament">Tournament</option>
                <option value="meeting">Meeting</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Title" className="sm:col-span-2">
              <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts">
              <Input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
            </Field>
            <Field label="Time">
              <Input type="time" value={v.time} onChange={(e) => setV({ ...v, time: e.target.value })} />
            </Field>
            <Field label="Ends (optional)">
              <Input type="date" value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} />
            </Field>
            <Field label="End time">
              <Input type="time" value={v.end_time} onChange={(e) => setV({ ...v, end_time: e.target.value })} />
            </Field>
          </div>
          <Field label="Location">
            <Input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
        </div>
      )}
    </Modal>
  );
}
