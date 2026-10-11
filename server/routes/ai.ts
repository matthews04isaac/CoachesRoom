import { Router, type Request } from 'express';
import { q, type DB } from '../db.ts';
import { bad, HttpError } from '../validate.ts';
import { FOCUS_AREA_LABELS, type FocusArea } from '../../shared/domain.ts';
import { focusTrend, playerEvalSummary, recurringIssues, teamRecord, trendSignal } from '../insights.ts';
import { teamCategories } from './team.ts';

import { aiProvider, type ChatMessage } from '../ai-providers.ts';

export const aiEnabled = () => aiProvider() !== null;

const SYSTEM_PROMPT = `You are BenchIQ Coach, an assistant for ice hockey coaches inside the BenchIQ coaching platform.

You help with: practice plans tailored to age, level, ice time and objectives; drill recommendations for identified weaknesses; explaining systems and tactical concepts (forechecks, breakouts, defensive-zone coverage, neutral-zone play, power play, penalty kill); corrections for recurring game problems; player development plans from recorded evaluations; summarising coaching observations; and age-appropriate progressions (follow Long-Term Player Development principles — e.g. U9–U11 emphasise skating, puck skills, small-area games and fun; body contact and complex systems come later).

Style: practical and specific, like an experienced coach talking to a colleague. Use short sections and bullet points. Give concrete coaching points and cues players can understand. When team data is provided, ground your advice in it (name players, reference logged observations and evaluation scores) and say when the data is thin. Never invent statistics, video analysis or observations that are not in the provided data.

Practice plans: when the coach asks you to create or modify a practice plan, write a brief explanation, then include exactly one fenced code block whose info string is \`benchiq-practice\` containing JSON with this shape:
{"title": string, "duration": number (total minutes), "objectives": string,
 "segments": [{"drill_id": number | null, "title": string, "duration": number, "notes": string, "coaching_points": string[]}],
 "priority_ids": number[]}
Rules: segment durations must add up to the total duration and include a warm-up and a cool-down/stretch. Prefer drills from the provided team drill library (use their exact drill_id); use drill_id null for drills not in the library and describe the setup in "notes". Use priority_ids only for development priorities listed in the team data. The coach will review and edit the plan before anything is saved, so do not claim it has been saved.`;

/** Build a compact, factual snapshot of the team for the model. */
export function teamContext(db: DB, teamId: number) {
  const d = q(db);
  const team = d.get('SELECT * FROM teams WHERE id = ?', teamId)!;
  const cats = teamCategories(team);
  const rec = teamRecord(db, teamId);
  const lines: string[] = [];
  lines.push(`TEAM: ${team.name} — ${team.division} ${team.level}, season ${team.season}. Record ${rec.w}-${rec.l}-${rec.otl}-${rec.t} (W-L-OTL-T), GF ${rec.gf}, GA ${rec.ga}.`);

  lines.push('\nROSTER (latest evaluation, 1–5 scale):');
  for (const p of d.all("SELECT * FROM players WHERE team_id = ? AND status != 'inactive' ORDER BY position, number", teamId)) {
    const s = playerEvalSummary(db, p.id, cats);
    const ratings = s ? s.categories.map((c) => `${c.label} ${c.value}${c.delta ? (c.delta > 0 ? ` (+${c.delta})` : ` (${c.delta})`) : ''}`).join(', ') : 'not yet evaluated';
    lines.push(`- #${p.number ?? '–'} ${p.first_name} ${p.last_name} (${p.position}${p.status === 'injured' ? ', injured' : ''}): ${ratings}`);
  }

  const priorities = d.all("SELECT pr.*, p.first_name, p.last_name FROM priorities pr LEFT JOIN players p ON p.id = pr.player_id WHERE pr.team_id = ? AND pr.status != 'resolved'", teamId);
  lines.push('\nACTIVE DEVELOPMENT PRIORITIES:');
  if (!priorities.length) lines.push('- none');
  for (const p of priorities) {
    const t = trendSignal(focusTrend(db, teamId, p.focus_area, p.player_id), p.created_at);
    lines.push(`- [priority_id ${p.id}] ${p.title} (${FOCUS_AREA_LABELS[p.focus_area as FocusArea]}${p.player_id ? `, player: ${p.first_name} ${p.last_name}` : ', team-wide'}; trend: ${t.signal}). ${p.description}`);
  }

  const recurring = recurringIssues(db, teamId);
  if (recurring.length) {
    lines.push('\nRECURRING ISSUES (last 5 games):');
    for (const r of recurring) lines.push(`- ${r.label}: issues in ${r.gamesAffected}/${r.gamesConsidered} games (${r.issueCount} logged).`);
  }

  lines.push('\nRECENT GAMES AND OBSERVATIONS:');
  const games = d.all('SELECT * FROM games WHERE team_id = ? AND goals_for IS NOT NULL ORDER BY played_at DESC LIMIT 5', teamId);
  for (const g of games) {
    lines.push(`- ${g.played_at.slice(0, 10)} vs ${g.opponent}: ${g.goals_for}-${g.goals_against}${g.overtime ? ' (OT)' : ''}. ${g.summary}`);
    const obs = d.all(
      `SELECT o.*, GROUP_CONCAT(p.first_name || ' ' || p.last_name, ', ') AS players FROM observations o
       LEFT JOIN observation_players op ON op.observation_id = o.id LEFT JOIN players p ON p.id = op.player_id
       WHERE o.game_id = ? GROUP BY o.id`,
      g.id,
    );
    for (const o of obs) lines.push(`    • ${o.kind === 'issue' ? 'ISSUE' : 'POSITIVE'} [${FOCUS_AREA_LABELS[o.focus_area as FocusArea]}] ${o.description}${o.players ? ` (players: ${o.players})` : ''}`);
  }

  lines.push('\nTEAM DRILL LIBRARY (drill_id: name — category, minutes, focus areas):');
  for (const dr of d.all('SELECT id, name, category, duration, focus_areas FROM drills WHERE team_id IS NULL OR team_id = ? ORDER BY category, name', teamId)) {
    lines.push(`- ${dr.id}: ${dr.name} — ${dr.category}, ${dr.duration} min, ${JSON.parse(dr.focus_areas).join('/') || 'general'}`);
  }
  return lines.join('\n');
}

export interface PracticeDraft {
  title: string;
  duration: number;
  objectives: string;
  segments: { drill_id: number | null; title: string; duration: number; notes: string }[];
  priority_ids: number[];
}

/** Pull the benchiq-practice block out of a reply and sanitise it against team data. */
export function extractPracticeDraft(db: DB, teamId: number, text: string): { reply: string; draft: PracticeDraft | null } {
  const m = text.match(/```benchiq-practice\s*([\s\S]*?)```/);
  if (!m) return { reply: text.trim(), draft: null };
  const reply = text.replace(m[0], '').trim();
  try {
    const raw = JSON.parse(m[1]);
    const d = q(db);
    const validDrill = (id: unknown) => (typeof id === 'number' && d.get('SELECT id FROM drills WHERE id = ? AND (team_id IS NULL OR team_id = ?)', id, teamId) ? id : null);
    const segments = (Array.isArray(raw.segments) ? raw.segments : []).slice(0, 30).map((s: any) => {
      const points = Array.isArray(s.coaching_points) ? s.coaching_points.filter((x: unknown) => typeof x === 'string') : [];
      const notes = [String(s.notes ?? '').trim(), points.length ? `Coaching points: ${points.join(' · ')}` : ''].filter(Boolean).join('\n');
      return {
        drill_id: validDrill(s.drill_id),
        title: String(s.title ?? 'Segment').slice(0, 120),
        duration: Math.min(120, Math.max(1, Math.round(Number(s.duration) || 5))),
        notes: notes.slice(0, 2000),
      };
    });
    const priorityIds = (Array.isArray(raw.priority_ids) ? raw.priority_ids : []).filter(
      (id: unknown) => typeof id === 'number' && d.get('SELECT id FROM priorities WHERE id = ? AND team_id = ?', id, teamId),
    );
    if (!segments.length) return { reply, draft: null };
    return {
      reply,
      draft: {
        title: String(raw.title ?? 'AI practice plan').slice(0, 120),
        duration: Math.min(240, Math.max(10, Math.round(Number(raw.duration) || segments.reduce((a: number, s: { duration: number }) => a + s.duration, 0)))),
        objectives: String(raw.objectives ?? '').slice(0, 4000),
        segments,
        priority_ids: priorityIds,
      },
    };
  } catch {
    return { reply: text.trim(), draft: null };
  }
}

export function aiStatusRoutes() {
  const r = Router();
  r.get('/status', (_req, res) => {
    const p = aiProvider();
    res.json({ enabled: !!p, provider: p?.name ?? null, model: p?.model ?? null });
  });
  return r;
}

export function aiRoutes(db: DB) {
  const r = Router({ mergeParams: true });

  r.get('/context', (req: Request, res) => {
    res.type('text/plain').send(teamContext(db, Number(req.params.teamId)));
  });

  r.post('/chat', async (req: Request, res) => {
    const provider = aiProvider();
    if (!provider) throw new HttpError(503, 'The AI Coach is not configured. Set GEMINI_API_KEY (or ANTHROPIC_API_KEY) on the server to enable it.');
    const teamId = Number(req.params.teamId);
    const raw = req.body.messages;
    if (!Array.isArray(raw) || !raw.length || raw.length > 40) throw bad('Provide between 1 and 40 messages');
    const messages: ChatMessage[] = raw.map((m: any) => {
      if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) throw bad('Invalid message');
      return { role: m.role, content: m.content.slice(0, 12000) };
    });
    if (messages[messages.length - 1].role !== 'user') throw bad('The last message must be from the coach');

    const system = [SYSTEM_PROMPT];
    if (req.body.use_team_data !== false) {
      system.push(`Current BenchIQ team data (authorised by the coach for this conversation):\n\n${teamContext(db, teamId)}`);
    } else {
      system.push('The coach has not shared team data for this conversation. Give general advice and ask for details where needed.');
    }

    const result = await provider.chat(system, messages);
    if (result.blocked && !result.text) {
      return res.json({ reply: 'Sorry — I can’t help with that request. Try rephrasing it as a coaching question.', draft: null });
    }
    const { reply, draft } = extractPracticeDraft(db, teamId, result.text);
    res.json({ reply, draft, truncated: result.truncated, model: result.model });
  });

  return r;
}

