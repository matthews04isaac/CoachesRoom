# BenchIQ — architecture & implementation decisions

This document records the decisions made while building the first release, so future work can build on them deliberately.

## Goals that shaped the design

1. **A working product, not a mockup.** Every visible control does something; anything not built is labelled as such.
2. **Connected coaching development is the core.** Observations, priorities, drills, practices, evaluations and goals share one vocabulary and real foreign keys.
3. **Zero-friction to run.** `npm install && npm run dev`, no database server, demo data included.
4. **Scale up later without rewriting.** Clear API boundaries, a relational schema, and team-scoped authorisation from day one.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Web app | React 19 + TypeScript + Vite, React Router, TanStack Query | Fast dev loop, typed end-to-end, simple cache invalidation |
| Styling | Tailwind CSS 3 with CSS-variable design tokens | Light/dark themes from one set of tokens; consistent premium look |
| Charts | Recharts | Radar, line and bar charts with tooltips; palette validated for colour-vision deficiency |
| Drag & drop | dnd-kit | Accessible (keyboard + pointer) sortable lists |
| Icons | lucide-react | Consistent stroke icon set |
| API | Express 5 on Node 22, run with `tsx` | Minimal, well known; async errors handled natively |
| Database | SQLite via built-in `node:sqlite` | No native build step or server; easy to swap to Postgres later (plain SQL, no ORM lock-in) |
| AI | Google Gen AI SDK (`@google/genai`, default model `gemini-flash-latest`, free tier) or Anthropic SDK (`@anthropic-ai/sdk`, `claude-opus-5-5`) | Chosen by which key is set; server-side only, keys never reach the browser |

Shared domain constants live in `shared/domain.ts` and are imported by both client and server, so a focus area or diagram type cannot drift between them.

## Data model

```
users ─< sessions
users ─< staff >─ teams                    (staff.permission: admin | edit | view; user_id NULL = pending invite)
teams ─< players ─< evaluations             (ratings JSON keyed by teams.eval_categories)
                 ─< player_goals ──> priorities
                 ─< player_notes
teams ─< games ─< observations ─< observation_players >─ players
                      │ priority_id
                      ▼
teams ─< priorities ─< practice_priorities >─ practices ─< practice_segments >─ drills
teams ─< events                             (tournaments, meetings, other)
drills / systems / resources                (team_id NULL = BenchIQ library, otherwise team-owned)
teams ─< playbook_entries >─ systems
teams ─< diagrams                           (tactical board)
```

Key decisions:

- **Focus areas** (`breakout`, `forecheck`, `d-zone`, `neutral-zone`, `special-teams`, `individual`) tag observations, priorities and drills. Drills also carry `skills` matching evaluation category keys. These two tags power every recommendation.
- **Library vs team content** share tables (`team_id IS NULL` = global). Library rows are read-only; "Duplicate & customise" copies them into the team.
- **The calendar is derived**, not stored twice: it unions dated practices, games and `events`. Practices and games therefore can never be out of sync with the calendar.
- **Scheduled games** are `games` rows with a NULL score; recording the result is an edit, not a new record.
- **Dates** are stored as local `YYYY-MM-DD` / `YYYY-MM-DDTHH:mm` strings. A 5:30 pm practice is 5:30 pm at the rink regardless of the viewer's time zone. (Multi-timezone organisations will need explicit time zones per team — noted for later.)
- **JSON columns** are used for naturally document-shaped data (ratings, coaching points, diagrams, system steps) and validated on write.
- **Video links:** observations created from AI video analysis store `video_ref` = `source@seconds` (e.g. `youtube@754`), and games store the analyzed `video_url`.

## The connected coaching loop

Implemented in `server/insights.ts`, deterministic and explainable:

1. **Observe** — coaches log observations per game (issue or positive, focus area, severity, period/time, players).
2. **Detect** — `recurringIssues()` flags a focus area with issues in ≥2 of the last 5 completed games. The dashboard surfaces those without a priority and offers one-click "Make it a priority", which links the existing unassigned issues.
3. **Prioritise** — priorities can be team-wide or player-specific, created from observations (single or multi-select), from recurring issues, or directly.
4. **Recommend** — `recommendDrills()` scores drills: +4 when the priority's focus area is the drill's primary focus, +3 when secondary, +2 per matching weak skill, +1 when suited to the team's age division. Reasons are shown to the coach.
5. **Plan** — "Add to practice" appends chosen drills to the next upcoming practice (or a new draft) and links the priority, so the practice shows which priorities it addresses.
6. **Measure** — `focusTrend()` counts issues and positives per game for the focus area (and player, for individual priorities). `trendSignal()` compares net issues/game before vs since the priority was created (falling back to first-half vs second-half when there are fewer than two games since), labelling *improving / no change / getting worse / not enough data*.

Player evaluations feed the same loop: the lowest-rated skills drive player drill recommendations, and goals can be linked to priorities.

## AI Coach

- `POST /api/teams/:id/ai/chat` sends the conversation to the configured model (Gemini or Claude, see `server/ai-providers.ts`) with a hockey-coaching system prompt. When the coach leaves **"Share team data"** on (the default, visible toggle), a compact factual snapshot is appended: roster with latest ratings and deltas, active priorities with trend, recurring issues, the last five games with observations, and the drill library with IDs. `GET /api/teams/:id/ai/context` shows exactly what is shared (the AI page offers a preview even when AI is disabled).
- Practice plans are requested as a fenced `benchiq-practice` JSON block. The server parses and **sanitises** it (unknown drill IDs → custom segments, unknown priority IDs dropped, durations clamped) and returns it separately from the prose.
- The client renders the plan as an **editable draft**. Nothing is persisted until the coach clicks *Approve & save as draft practice*, which creates a `draft` practice with `source = 'ai'` for further editing in the planner.
- On Claude, requests use `medium` effort and server-side refusal fallbacks (`fallbacks: "default"`). On Gemini, safety blocks and the free tier's rate limits (HTTP 429) are surfaced as friendly messages. Without `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` the endpoint returns 503 and the UI explains how to enable it.
- No automated video analysis exists, and the assistant is instructed not to invent statistics or observations.

## AI game-video analysis

`server/video.ts` + `server/routes/video.ts`, Gemini only (Claude can't watch video).

1. On a game, the coach pastes a **Google Drive** link (sharing: *Anyone with the link*), a **YouTube** link, or **uploads** a file, plus their jersey colour.
2. A background job (one per team at a time, to protect the free quota) records its stage on a `video_analyses` row; the page polls it. Jobs interrupted by a restart are marked failed on boot.
   - Drive: the server streams the file from `drive.usercontent.google.com` to a temp file (HTML responses mean the file isn't shared publicly), then uploads it to the Gemini Files API in chunks, waits for processing, and deletes both copies afterwards.
   - YouTube: the URL is passed straight to Gemini — nothing is downloaded.
   - Upload: streamed to a temp file, then as Drive.
3. Gemini (`gemini-flash-latest`, low media resolution to save tokens) gets the roster's jersey numbers and active priorities and returns JSON constrained by a schema: summary, footage note, and up to 40 moments (timestamp, focus area, issue/positive, severity, description, jersey numbers, confidence). The server validates and sorts them.
4. Moments are stored as **pending suggestions**. Keeping one (optionally edited) creates a real observation — jersey numbers mapped to roster players, `video_ref` = `source@seconds`, optional priority link — so it flows into priorities, recommendations and trends. Dismissed ones are kept for reference.

Limits: Gemini accepts up to 2 GB per file (the app checks before downloading and suggests splitting by period or exporting at 720p); the free tier's per-minute/day quotas surface as friendly messages; accuracy on subtle tactical reads and jersey numbers is imperfect, which is why nothing is saved without coach approval.

## Security

- Passwords: scrypt with per-user salt, constant-time comparison. Minimum 8 characters.
- Sessions: random 256-bit tokens in an `HttpOnly`, `SameSite=Lax` cookie (30 days), `Secure` when the request is HTTPS (`TRUST_PROXY=1` behind a proxy).
- Authorisation: every team route goes through `requireTeam` (membership check → 404 for non-members). Writes need `edit`; staff management and team settings need `admin`. A team can't lose its last admin.
- All SQL uses bound parameters. User content is rendered as React text (the Markdown renderer never injects HTML). Video embeds are limited to YouTube (nocookie) / Vimeo URLs.
- Not yet: rate limiting on auth endpoints, CSRF tokens beyond SameSite=Lax, email verification, password reset. Add these before a public deployment.

## Printing / PDF

Practice plans and player reports have dedicated print routes (`/practices/:id/print`, `/players/:id/report`) with a print stylesheet that forces a light palette and avoids page breaks inside drills. Coaches use the browser's *Save as PDF*. This keeps output identical to the screen without a server-side PDF engine; a headless-browser export endpoint could be added later if one-click file downloads are needed.

## Testing

`npm test` runs API-level tests against an in-memory database: authentication, team isolation, viewer permissions and invite acceptance, the full observation → priority → recommendation → practice → template flow, evaluation validation, trend logic, AI draft sanitisation and diagram validation. The UI was exercised end-to-end in a headless browser during development (sign-up, team creation, roster, evaluation, game logging, priority creation, adding drills to a practice, drag-and-drop reorder, tactical-board drawing, calendar events, mobile layout).

## Roadmap

**Phase 2 (remaining):** animated tactical sequences (step interpolation between system diagrams), richer progress analytics (per-skill trends, team comparisons), calendar recurrence and iCal export, server-side PDF export, email invitations.

**Phase 3:** server-side splitting/compression of full-game videos over 2 GB, a clip library with playback for uploaded files (needs paid storage), drawing annotations on frames, organisation-level management (clubs/associations with multiple teams and shared libraries), and a sport abstraction over the hockey-specific vocabulary in `shared/domain.ts`.

**Scaling notes:** move from SQLite to Postgres when multi-instance hosting is needed (queries are plain SQL), add a migration tool (the current schema uses `CREATE TABLE IF NOT EXISTS`), and code-split the web bundle by route.
