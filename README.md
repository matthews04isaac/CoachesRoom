# BenchIQ (CoachesRoom)

**Plan Smarter. Coach Better. Develop Every Player.**

BenchIQ is an all-in-one hockey coaching and player-development platform. Coaches manage teams, plan practices from a drill library, draw drills and systems on a rink, evaluate players, review games, and — most importantly — connect all of it: **game observations → development priorities → recommended drills → the next practice → measured improvement.**

This repository is the first release: a complete Phase 1 MVP plus most of the Phase 2 tools, with realistic demo data so you can explore immediately.

## Quick start

Requires **Node.js 22.13+** (uses the built-in `node:sqlite` module — no database server needed).

```bash
npm install
npm run dev          # API on :4000 + web app on http://localhost:5173
```

Open http://localhost:5173 and click **Explore the demo team**, or sign in with:

- **Email:** `coach@benchiq.app`
- **Password:** `hockey123`

The database (`data/benchiq.db`) is created and seeded automatically on first start. Demo dates are relative to the day you seed, so the schedule always has upcoming practices and recent games.

| Script | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) + Vite dev server with `/api` proxy |
| `npm run build` | Type-check everything and build the web app into `dist/` |
| `npm start` | Production mode: one Node process serves the API and `dist/` on `PORT` (default 4000) |
| `npm test` | API & domain-logic tests (Node test runner, in-memory DB) |
| `npm run typecheck` | TypeScript check for client, server and shared code |
| `npm run seed -- --reset` | Delete the database and re-create the demo data |

### Configuration (`.env.example`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API / production server port |
| `BENCHIQ_DB` | `data/benchiq.db` | SQLite file location |
| `GEMINI_API_KEY` | – | Enables the AI Coach with Google Gemini (free tier; create a key at aistudio.google.com). Without an AI key the AI page explains how to enable it; everything else works. |
| `GEMINI_MODEL` | `gemini-flash-latest` | Gemini model used by the AI Coach |
| `ANTHROPIC_API_KEY` | – | Alternative: run the AI Coach on Anthropic Claude (paid) |
| `BENCHIQ_AI_MODEL` | `claude-opus-5-5` | Claude model, when using Anthropic |
| `BENCHIQ_AI_PROVIDER` | – | `gemini` or `anthropic`, to choose when both keys are set (Gemini wins by default) |
| `BENCHIQ_DISABLE_DEMO` | – | Set to `1` to disable one-click demo login |
| `TRUST_PROXY` | – | Set to `1` behind a TLS-terminating proxy so session cookies are marked `Secure` |

Load them however you prefer (e.g. `export $(cat .env | xargs)`); BenchIQ reads `process.env` directly.

## Deploy to Render

The repo includes a [Render Blueprint](render.yaml) that runs everything (API + web app) as one **free** web service.

1. In the Render dashboard choose **New → Blueprint** and connect this GitHub repo (branch `main`).
2. Render reads `render.yaml` and proposes a free web service called `benchiq`. Click **Apply**.
3. Optional: when asked for `GEMINI_API_KEY`, paste a free Google AI Studio key to turn on the AI Coach (leave blank to skip; you can add it later under **Environment**).
4. Wait for the first deploy (about 2–3 minutes), then open the `https://<name>.onrender.com` link and click **Explore the demo team**.

Every push to `main` redeploys automatically.

**Free-plan limits:** free services sleep after about 15 minutes without visitors (the next visit takes ~30–60 seconds to wake up), and they have no persistent disk. The database is rebuilt with the demo data on every restart, redeploy or wake-up, so accounts and changes you make are **not kept**. To keep data, switch to the Starter plan and add a disk (instructions are in the comments at the top of `render.yaml`).

**Netlify:** Netlify only hosts static files, so it can't run the BenchIQ server on its own. Use the Render link above.

## What's in this release

| Area | Status |
| --- | --- |
| Accounts (email + password), sessions, multiple teams, team switcher | ✅ |
| Team management: name, logo URL, colour, division, level, season; roster; coaching staff with **admin / editor / viewer** permissions (enforced server-side) | ✅ |
| Dashboard: record, goal differential, shot share, schedule, recent results & evaluations, team skill profile, development priorities with trend, recurring-issue alerts | ✅ |
| Practice planner: timed segments, drag-and-drop ordering, drill picker with search & categories, priority linking, recommended drills, equipment checklist, templates, duplication, printable plan (**Print / Save as PDF**) | ✅ |
| Drill library: 30 seeded drills (skating, shooting, passing, defensive, tactics, conditioning) with diagrams, coaching points, equipment, ages, focus areas; custom drills; duplicate & customise | ✅ |
| Rink diagram editor: players (F/D/G), opponents, coach, pucks, cones, nets, text; skate / puck-carry / pass / shot / backward routes; full-rink and zone views; undo; keyboard delete | ✅ |
| Tactical board with saved diagrams | ✅ |
| Systems library (8 systems: forechecks, breakouts, D-zone, neutral zone, PP, PK) with step-by-step diagrams; team playbook; custom & customised systems | ✅ |
| Player development: profiles, customisable 1–5 evaluation categories, history, radar & progress charts, strengths/weaknesses, goals linked to priorities, notes, tagged game observations, rule-based drill recommendations, printable evaluation report | ✅ |
| Game review: results, tactical observations (issue / positive) by breakout, forecheck, D-coverage, neutral zone, special teams, individual; player tagging; recurring-issue tracker; convert observations into priorities | ✅ |
| Development priorities: team or player-level, linked observations, trend (before vs since), recommended drills → add to next practice, linked practices and goals | ✅ |
| AI Coach (Google Gemini, or Anthropic Claude): chat grounded in team data (opt-in per conversation), practice generation as an **editable draft that the coach must approve** before saving | ✅ with `GEMINI_API_KEY` (free) or `ANTHROPIC_API_KEY` |
| Coaching library: 16 articles across the 8 required categories, search, tips, team-added resources with YouTube/Vimeo embeds | ✅ |
| Calendar: month grid + mobile agenda, practices & games pulled in automatically, tournaments/meetings/other events | ✅ |
| Light / dark / system theme, responsive layouts, JSON data export | ✅ |
| Animated tactical sequences | ⏳ Not yet — labelled in the app |
| **AI game-video analysis:** paste a Google Drive or YouTube link (or upload a file) on a game; Gemini returns timestamped moments sorted into the observation categories, with jersey numbers matched to the roster; the coach keeps, edits or dismisses each one and kept moments become observations | ✅ with `GEMINI_API_KEY` (videos up to 2 GB; one per period recommended) |
| Drawing annotations on video, clip library / playback for uploaded files | ⏳ Not yet |
| Email invitations/notifications, photo & file uploads, organisation-level management, other sports | ⏳ Not yet |

Nothing in the UI pretends to work: unfinished features are shown as clearly labelled "Not yet available" notes, never as dead buttons. The rule-based recommendations are labelled as rule-based, not AI.

## Project structure

```
shared/domain.ts         Shared vocabulary: positions, drill categories, focus areas, eval categories, diagram types
server/
  db.ts                  SQLite schema + query helpers
  auth.ts                Password hashing (scrypt), sessions, team permission middleware
  insights.ts            Connected-coaching logic: trends, recurring issues, drill recommendations
  routes/                auth · team (teams, staff, roster, evaluations, calendar, dashboard)
                         coaching (drills, practices, games, observations, priorities)
                         tactics (systems, playbook, diagrams, library) · ai (Gemini / Claude)
  ai-providers.ts        Google Gemini and Anthropic Claude clients behind one interface
  video.ts               Game-video analysis jobs (Drive download → Gemini Files API → suggested moments)
  seed.ts, seed-library.ts  Demo team + BenchIQ drill/system/article library
  api.test.ts            API tests
src/
  components/            UI kit, layout, rink diagram editor, charts, markdown renderer
  pages/                 One file per screen
  lib/                   API client, session/team/theme providers, formatting, types
docs/ARCHITECTURE.md     Design decisions, data model, roadmap
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the implementation decisions.
