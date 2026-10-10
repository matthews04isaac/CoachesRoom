import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, UserPlus, TrendingUp, TrendingDown } from 'lucide-react';
import { useTeam, useTeamQuery } from '../lib/session';
import type { PlayerListItem } from '../lib/types';
import { POSITION_LABELS, type Position } from '../../shared/domain';
import { fmtDate } from '../lib/format';
import { Badge, Button, Empty, Input, Modal, PageHeader, PlayerAvatar, Select, Spinner } from '../components/ui';
import { PlayerFormModal } from '../components/PlayerForm';

export default function Players() {
  const { canEdit } = useTeam();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data, isLoading } = useTeamQuery<PlayerListItem[]>('/players');
  const [q, setQ] = useState('');
  const [pos, setPos] = useState('');
  const [sort, setSort] = useState<'number' | 'avg' | 'name'>('number');
  const [adding, setAdding] = useState(false);

  const list = useMemo(() => {
    const l = (data ?? []).filter((p) => (!pos || (pos === 'F' ? ['C', 'LW', 'RW'].includes(p.position) : p.position === pos)) && (!q || `${p.first_name} ${p.last_name} ${p.number}`.toLowerCase().includes(q.toLowerCase())));
    return [...l].sort((a, b) => (sort === 'avg' ? (b.eval?.average ?? 0) - (a.eval?.average ?? 0) : sort === 'name' ? a.last_name.localeCompare(b.last_name) : (a.number ?? 999) - (b.number ?? 999)));
  }, [data, q, pos, sort]);

  if (isLoading || !data) return <Spinner />;
  const unevaluated = data.filter((p) => !p.eval && p.status !== 'inactive').length;

  return (
    <div>
      <PageHeader
        title="Player Development"
        subtitle={`Evaluations, goals and progress for every player.${unevaluated ? ` ${unevaluated} player${unevaluated > 1 ? 's' : ''} not yet evaluated.` : ''}`}
        actions={
          canEdit && (
            <>
              <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdding(true)}>
                Add player
              </Button>
              <Button variant="primary" icon={<TrendingUp className="h-4 w-4" />} onClick={() => setParams({ evaluate: '1' })}>
                New evaluation
              </Button>
            </>
          )
        }
      />
      <div className="card mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-faint" />
          <Input className="pl-8" placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position">
          <option value="">All positions</option>
          <option value="F">Forwards</option>
          <option value="D">Defence</option>
          <option value="G">Goalies</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
          <option value="number">Sort by number</option>
          <option value="avg">Sort by rating</option>
          <option value="name">Sort by name</option>
        </Select>
      </div>

      {list.length === 0 ? (
        <Empty title="No players found" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line bg-raised/50 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5">Player</th>
                  <th className="px-2 py-2.5">Pos</th>
                  <th className="px-2 py-2.5">Avg</th>
                  <th className="px-2 py-2.5">Strengths</th>
                  <th className="px-2 py-2.5">Work on</th>
                  <th className="px-2 py-2.5">Goals</th>
                  <th className="px-4 py-2.5">Last eval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-raised/50" onClick={() => navigate(`/players/${p.id}`)}>
                    <td className="px-4 py-2.5">
                      <Link to={`/players/${p.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <PlayerAvatar player={p} size="sm" />
                        <span className="font-medium">
                          {p.first_name} {p.last_name}
                        </span>
                        {p.status !== 'active' && <Badge tone={p.status === 'injured' ? 'warn' : 'neutral'}>{p.status}</Badge>}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-muted" title={POSITION_LABELS[p.position as Position]}>
                      {p.position}
                    </td>
                    <td className="px-2 py-2.5 font-display text-lg font-semibold">{p.eval?.average ?? '—'}</td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.eval?.strengths.map((s) => (
                          <Badge key={s.key} tone="good">
                            {s.label} {s.value}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {p.eval?.weaknesses.map((s) => (
                          <Badge key={s.key} tone="warn">
                            {s.label} {s.value}
                            {s.delta ? s.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" /> : null}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-muted">{p.active_goals || '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{p.eval ? fmtDate(p.eval.evaluatedOn) : <span className="text-warn">Not evaluated</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {adding && <PlayerFormModal player={null} onClose={() => setAdding(false)} />}
      <Modal open={params.get('evaluate') === '1'} onClose={() => setParams({})} title="Who are you evaluating?">
        <ul className="grid gap-1 sm:grid-cols-2">
          {data
            .filter((p) => p.status !== 'inactive')
            .map((p) => (
              <li key={p.id}>
                <button onClick={() => navigate(`/players/${p.id}?evaluate=1`)} className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-raised">
                  <PlayerAvatar player={p} size="sm" />
                  <span className="flex-1">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="text-xs text-muted">{p.eval ? fmtDate(p.eval.evaluatedOn) : 'new'}</span>
                </button>
              </li>
            ))}
        </ul>
      </Modal>
    </div>
  );
}
