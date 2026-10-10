import { TrendingDown, TrendingUp, Minus, HelpCircle } from 'lucide-react';
import { DRILL_CATEGORY_LABELS, FOCUS_AREA_LABELS, type DrillCategory, type FocusArea } from '../../shared/domain';
import type { TrendSignal } from '../lib/types';
import { Badge } from './ui';

export function FocusBadge({ area }: { area: string }) {
  return <Badge tone="info">{FOCUS_AREA_LABELS[area as FocusArea] ?? area}</Badge>;
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge>{DRILL_CATEGORY_LABELS[category as DrillCategory] ?? category}</Badge>;
}

/** Trend of a development priority, computed from game observations. Lower issue rate = improving. */
export function TrendBadge({ signal, compact }: { signal?: TrendSignal; compact?: boolean }) {
  if (!signal) return null;
  const map = {
    improving: { tone: 'good' as const, icon: <TrendingDown className="h-3 w-3" />, label: 'Improving' },
    worsening: { tone: 'accent' as const, icon: <TrendingUp className="h-3 w-3" />, label: 'Getting worse' },
    steady: { tone: 'warn' as const, icon: <Minus className="h-3 w-3" />, label: 'No change' },
    'not-enough-data': { tone: 'neutral' as const, icon: <HelpCircle className="h-3 w-3" />, label: compact ? 'Need data' : 'Not enough data' },
  }[signal];
  return (
    <Badge tone={map.tone}>
      {map.icon}
      {map.label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === 'active' ? 'accent' : status === 'monitoring' ? 'warn' : status === 'resolved' || status === 'achieved' || status === 'completed' ? 'good' : 'neutral';
  return <Badge tone={tone}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}
