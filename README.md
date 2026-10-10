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
| `ANTHROPIC_API_KEY` | – | Enables the AI Coach. Without it the AI page explains how to enable it; everything else works. |
| `BENCHIQ_AI_MODEL` | `claude-opus-5-5` | Model used by the AI Coach |
| `BENCHIQ_DISABLE_DEMO` | – | Set to `1` to disable one-click demo login |
| `TRUST_PROXY` | – | Set to `1` behind a TLS-terminating proxy so session cookies are marked `Secure` |

Load them however you prefer (e.g. `export $(cat .env | xargs)`); BenchIQ reads `process.env` directly.

## Deploy to Render

The repo includes a [Render Blueprint](render.yaml) that runs everything (API + web app) as one web service with a 1 GB persistent disk for the database.

1. In the Render dashboard choose **New → Blueprint** and connect this GitHub repo (branch `main`).
2. Render reads `render.yaml` and proposes a web service called `benchiq` on the **Starter** plan with a disk mounted at `/var/data`. Click **Apply**.
3. Optional: when asked for `ANTHROPIC_API_KEY`, paste a key to turn on the AI Coach (leave blank to skip; you can add it later under **Environment**).
4. Wait for the first deploy (about 2–3 minutes), then open the `https://<name>.onrender.com` link and click **Explore the demo team**.

The database is created and seeded on the first start and kept on the disk across deploys and restarts. Every push to `main` redeploys automatically.

**Free plan:** Render's free plan has no persistent disks. To try it for free, remove the `disk:` block and change `plan: starter` to `plan: free`. The app works, but all data resets to the demo data whenever the service restarts or sleeps.

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
| AI Coach (Claude): chat grounded in team data (opt-in per conversation), practice generation as an **editable draft that the coach must approve** before saving | ✅ with `ANTHROPIC_API_KEY` |
| Coaching library: 16 articles across the 8 required categories, search, tips, team-added resources with YouTube/Vimeo embeds | ✅ |
| Calendar: month grid + mobile agenda, practices & games pulled in automatically, tournaments/meetings/other events | ✅ |
| Light / dark / system theme, responsive layouts, JSON data export | ✅ |
| Animated tactical sequences | ⏳ Not yet — labelled in the app |
| Video uploads, clip tagging, annotations, automated video analysis | ⏳ Phase 3 — labelled in the app; data model reserves `observations.video_ref` |
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
                         tactics (systems, playbook, diagrams, library) · ai (Claude)
  seed.ts, seed-library.ts  Demo team + BenchIQ drill/system/article library
  api.test.ts            API tests
src/
  components/            UI kit, layout, rink diagram editor, charts, markdown renderer
  pages/                 One file per screen
  lib/                   API client, session/team/theme providers, formatting, types
docs/ARCHITECTURE.md     Design decisions, data model, roadmap
```

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the implementation decisions.
