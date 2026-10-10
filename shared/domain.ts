// Shared domain vocabulary used by both the API server and the web client.
// Keeping these lists in one place is what lets game observations, development
// priorities, drills and evaluations "speak the same language".

export const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'] as const;
export type Position = (typeof POSITIONS)[number];
export const POSITION_LABELS: Record<Position, string> = {
  C: 'Centre',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defence',
  G: 'Goalie',
};

export const DRILL_CATEGORIES = ['skating', 'shooting', 'passing', 'defensive', 'tactics', 'conditioning'] as const;
export type DrillCategory = (typeof DRILL_CATEGORIES)[number];
export const DRILL_CATEGORY_LABELS: Record<DrillCategory, string> = {
  skating: 'Skating',
  shooting: 'Shooting',
  passing: 'Passing',
  defensive: 'Defensive Play',
  tactics: 'Tactics',
  conditioning: 'Conditioning',
};

/**
 * Focus areas are the backbone of Connected Coaching Development: every game
 * observation, development priority and drill is tagged with them, so an issue
 * logged in Game Review can be matched to drills and tracked across games.
 */
export const FOCUS_AREAS = ['breakout', 'forecheck', 'd-zone', 'neutral-zone', 'special-teams', 'individual'] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];
export const FOCUS_AREA_LABELS: Record<FocusArea, string> = {
  breakout: 'Breakout',
  forecheck: 'Forecheck',
  'd-zone': 'Defensive Coverage',
  'neutral-zone': 'Neutral Zone',
  'special-teams': 'Special Teams',
  individual: 'Individual Performance',
};

/** Default evaluation categories. Teams can customise these in Settings. */
export const DEFAULT_EVAL_CATEGORIES = [
  { key: 'skating', label: 'Skating' },
  { key: 'puck-skills', label: 'Puck Skills' },
  { key: 'shooting', label: 'Shooting' },
  { key: 'hockey-iq', label: 'Hockey IQ' },
  { key: 'positioning', label: 'Positioning' },
  { key: 'compete', label: 'Compete Level' },
  { key: 'decision-making', label: 'Decision-Making' },
];
export type EvalCategory = { key: string; label: string };
export const RATING_LABELS: Record<number, string> = {
  1: 'Needs significant work',
  2: 'Developing',
  3: 'Competent',
  4: 'Strong',
  5: 'Elite for level',
};

export const SYSTEM_CATEGORIES = ['forecheck', 'breakout', 'd-zone', 'neutral-zone', 'power-play', 'penalty-kill'] as const;
export type SystemCategory = (typeof SYSTEM_CATEGORIES)[number];
export const SYSTEM_CATEGORY_LABELS: Record<SystemCategory, string> = {
  forecheck: 'Forecheck',
  breakout: 'Breakout',
  'd-zone': 'Defensive Zone',
  'neutral-zone': 'Neutral Zone',
  'power-play': 'Power Play',
  'penalty-kill': 'Penalty Kill',
};
/** Map a tactical system category onto the focus area it develops. */
export const SYSTEM_TO_FOCUS: Record<SystemCategory, FocusArea> = {
  forecheck: 'forecheck',
  breakout: 'breakout',
  'd-zone': 'd-zone',
  'neutral-zone': 'neutral-zone',
  'power-play': 'special-teams',
  'penalty-kill': 'special-teams',
};

export const RESOURCE_CATEGORIES = [
  'skating',
  'offensive-skills',
  'defensive-skills',
  'team-systems',
  'hockey-iq',
  'practice-design',
  'player-development',
  'leadership',
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  skating: 'Skating Mechanics & Power Skating',
  'offensive-skills': 'Individual Offensive Skills',
  'defensive-skills': 'Individual Defensive Skills',
  'team-systems': 'Team Systems',
  'hockey-iq': 'Hockey IQ & Decision-Making',
  'practice-design': 'Practice Design',
  'player-development': 'Player Development',
  leadership: 'Communication & Leadership',
};

export const EVENT_TYPES = ['practice', 'game', 'tournament', 'meeting', 'other'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const AGE_DIVISIONS = ['U9', 'U11', 'U13', 'U15', 'U16', 'U18', 'Junior', 'Senior'] as const;
export const LEVELS = ['House', 'C', 'B', 'A', 'AA', 'AAA', 'Elite'] as const;

/** Permission levels for coaching staff. */
export const PERMISSIONS = ['admin', 'edit', 'view'] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const PERMISSION_LABELS: Record<Permission, string> = {
  admin: 'Admin — manage team, staff and all content',
  edit: 'Editor — create and edit practices, evaluations, games',
  view: 'Viewer — read-only access',
};

export const PRIORITY_STATUSES = ['active', 'monitoring', 'resolved'] as const;
export type PriorityStatus = (typeof PRIORITY_STATUSES)[number];

// ---------- Rink diagrams ----------
// Coordinates are in feet on a 200 x 85 ft rink. (0,0) is the top-left corner.

export type RinkView = 'full' | 'dzone' | 'ozone' | 'neutral';
export type DiagramItemKind = 'F' | 'D' | 'G' | 'X' | 'C' | 'puck' | 'cone' | 'net' | 'text';
export type DiagramPathKind = 'skate' | 'carry' | 'pass' | 'shot' | 'backward' | 'line';

export interface DiagramItem {
  id: string;
  kind: DiagramItemKind;
  x: number;
  y: number;
  label?: string;
  team?: 'home' | 'away';
}
export interface DiagramPath {
  id: string;
  kind: DiagramPathKind;
  points: [number, number][];
}
export interface Diagram {
  view: RinkView;
  items: DiagramItem[];
  paths: DiagramPath[];
}
export const emptyDiagram = (view: RinkView = 'full'): Diagram => ({ view, items: [], paths: [] });
