import type { Diagram, EvalCategory, Permission } from '../../shared/domain';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Record_ {
  gp: number;
  w: number;
  l: number;
  otl: number;
  t: number;
  gf: number;
  ga: number;
  sf: number;
  sa: number;
}

export interface Team {
  id: number;
  name: string;
  short_name: string;
  color: string;
  logo_url: string | null;
  division: string;
  level: string;
  season: string;
  eval_categories: EvalCategory[];
  permission: Permission;
  my_title?: string;
  player_count?: number;
  record: Record_;
}

export interface Staff {
  id: number;
  user_id: number | null;
  name: string;
  email: string;
  title: string;
  permission: Permission;
}

export interface Player {
  id: number;
  team_id: number;
  first_name: string;
  last_name: string;
  number: number | null;
  position: string;
  shoots: string | null;
  birth_year: number | null;
  photo_url: string | null;
  status: 'active' | 'injured' | 'inactive';
  notes: string;
}

export interface SkillScore {
  key: string;
  label: string;
  value: number;
  delta: number | null;
}

export interface PlayerListItem extends Player {
  eval: { average: number | null; evaluatedOn: string; strengths: SkillScore[]; weaknesses: SkillScore[] } | null;
  active_goals: number;
}

export interface Evaluation {
  id: number;
  player_id: number;
  evaluated_on: string;
  label: string;
  evaluator: string;
  ratings: Record<string, number>;
  strengths: string;
  improvements: string;
  notes: string;
}

export interface Goal {
  id: number;
  player_id: number;
  title: string;
  skill: string | null;
  description: string;
  status: 'active' | 'achieved' | 'paused';
  progress: number;
  target_date: string | null;
  priority_id: number | null;
  first_name?: string;
  last_name?: string;
}

export interface Note {
  id: number;
  body: string;
  author: string;
  created_at: string;
}

export interface Drill {
  id: number;
  team_id: number | null;
  name: string;
  category: string;
  description: string;
  duration: number;
  intensity: 'low' | 'medium' | 'high';
  age_levels: string[];
  focus_areas: string[];
  skills: string[];
  coaching_points: string[];
  equipment: string[];
  diagram: Diagram | null;
  used?: number;
}

export interface DrillRecommendation {
  drill: Drill;
  score: number;
  reasons: string[];
  alreadyUsed?: boolean;
}

export interface Priority {
  id: number;
  title: string;
  focus_area: string;
  description: string;
  status: 'active' | 'monitoring' | 'resolved';
  player_id: number | null;
  first_name?: string | null;
  last_name?: string | null;
  number?: number | null;
  created_at: string;
  resolved_at: string | null;
  signal?: TrendSignal;
  before?: number | null;
  after?: number | null;
  observation_count?: number;
  practice_count?: number;
}
export type TrendSignal = 'improving' | 'worsening' | 'steady' | 'not-enough-data';

export interface TrendPoint {
  gameId: number;
  date: string;
  opponent: string;
  issues: number;
  positives: number;
}

export interface Observation {
  id: number;
  game_id: number;
  focus_area: string;
  kind: 'issue' | 'positive';
  severity: number;
  period: string | null;
  game_time: string | null;
  description: string;
  priority_id: number | null;
  priority_title?: string | null;
  video_ref?: string | null;
  players: { id: number; first_name: string; last_name: string; number: number | null }[];
  game?: { id: number; opponent: string; played_at: string };
  opponent?: string;
  played_at?: string;
}

export interface Game {
  id: number;
  played_at: string;
  opponent: string;
  venue: 'home' | 'away' | 'neutral';
  game_type: string;
  location: string;
  goals_for: number | null;
  goals_against: number | null;
  shots_for: number | null;
  shots_against: number | null;
  overtime: number;
  summary: string;
  video_url?: string | null;
  result: 'W' | 'L' | 'OTL' | 'T' | null;
  issue_count?: number;
  positive_count?: number;
  observations?: Observation[];
}

export interface Segment {
  id?: number;
  drill_id: number | null;
  title: string;
  duration: number;
  notes: string;
  category?: string | null;
  drill_description?: string | null;
  coaching_points?: string[] | null;
  equipment?: string[] | null;
  diagram?: Diagram | null;
  focus_areas?: string[] | null;
  intensity?: string | null;
}

export interface Practice {
  id: number;
  title: string;
  scheduled_at: string | null;
  duration: number;
  location: string;
  objectives: string;
  notes: string;
  is_template: number;
  status: 'draft' | 'planned' | 'completed';
  source: 'manual' | 'ai' | 'template';
  segments: Segment[];
  priorities: Priority[];
  segment_count?: number;
  planned_minutes?: number;
  priority_titles?: string[];
}

export interface RecurringIssue {
  focusArea: string;
  label: string;
  gamesAffected: number;
  gamesConsidered: number;
  issueCount: number;
  examples: { description: string; opponent: string }[];
  priority: { id: number; title: string } | null;
}

export interface TacticalSystem {
  id: number;
  team_id: number | null;
  name: string;
  category: string;
  summary: string;
  key_points: string[];
  steps: { title: string; body: string; diagram: Diagram | null }[];
  in_playbook: boolean;
  playbook_notes: string | null;
}

export interface SavedDiagram {
  id: number;
  name: string;
  description: string;
  data: Diagram;
  updated_at: string;
}

export interface Resource {
  id: number;
  team_id: number | null;
  category: string;
  title: string;
  summary: string;
  body?: string;
  tips?: string[];
  video_url?: string | null;
  diagram?: Diagram | null;
  level: string;
  read_minutes: number;
  has_video?: number;
  has_diagram?: number;
}

export interface CalendarItem {
  key: string;
  id: number;
  type: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  notes?: string;
  link: string | null;
  result?: string | null;
  score?: string | null;
}
