# Project context: Janus

You are continuing work on **Janus**, an RFID + fingerprint entry-control system
for the Armath Arapi makerspace. Janus runs the door: ESP32 readers post events,
the server records authorized entries and breaches, and an admin dashboard manages
devices, modes, and the attendance ledger in real time. The standalone build was
created so it can be submitted to a competition as its own product, then later
folded back into the main Armath website (a separate repo at
`~/Armath/Arapi/ArmathArapi-website/`).

## Where it lives

- Directory: `/home/grisha_kh/Armath/Arapi/Janus/`
- Not a git repo yet (run `git init` before your first commit).
- Sibling project at `~/Armath/Arapi/ArmathArapi-website/` is the eventual merge
  target — DO NOT touch it. Read-only reference if you need to compare.

## Stack (must stay aligned with the main website)

| Package | Version |
|---|---|
| Next.js | 16.2.4 (webpack mode — `next dev --webpack`, `next build --webpack`) |
| React / React DOM | 19.2.5 |
| TypeScript | 6.0.3 (with `ignoreDeprecations: "6.0"` in tsconfig) |
| Tailwind CSS | 4.2.4 (via `@tailwindcss/postcss`, `@import "tailwindcss"` in globals.css) |
| Zod | 4.4.3 (note: error path is `parsed.error.issues`, NOT `.errors`) |
| `@supabase/supabase-js` | 2.105.3 |
| `lucide-react` | 1.14.0 |
| ESLint | 9.39.4 with flat config (`eslint.config.mjs`) |
| `@types/node` | 25.6.0 |
| Package manager | pnpm v11 |

## Repo layout

```
Janus/
├── app/
│   ├── page.tsx                              landing
│   ├── layout.tsx, globals.css
│   ├── admin/
│   │   ├── page.tsx                          server-rendered, gated
│   │   ├── login-form.tsx, logout-button.tsx
│   ├── lookup/page.tsx                       public student-code lookup
│   └── api/
│       ├── attendance/{events,heartbeat,resync,config}/route.ts   ESP32 endpoints
│       ├── admin/auth/route.ts                                    login/logout
│       ├── admin/attendance/{devices,enroll,breaches,ledger,logs}/route.ts
│       └── lookup/route.ts                   public GET ?code=ARM-0042
├── features/attendance/                      (verbatim from main repo — see "Re-integration contract")
│   ├── types.ts, constants.ts
│   ├── lib/{admin-gate,attendance-api-client,device-auth,device-rate-limit,
│   │        device-token,student-lookup}.ts
│   ├── hooks/use-attendance-realtime.ts
│   └── components/admin/{attendance-view,attendance-live-feed,
│                         attendance-devices-panel,attendance-breaches-table,
│                         attendance-ledger-grid,attendance-enrollment-panel}.tsx
├── lib/
│   ├── api/attendance-event-core.ts          pure parser/evaluator (unit-tested)
│   ├── admin-auth.ts, admin-rate-limit.ts, window-rate-limit.ts
│   ├── request-utils.ts, server-logger.ts, env.ts, supabase.ts, utils.ts
│   └── janus-schema.sql                      run once in Supabase SQL editor
└── tests/api/
    ├── attendance-event-core.test.ts
    └── attendance-device-auth.test.ts
```

## What's already built and verified

- Full ESP32-facing API (auth via `Authorization: Bearer <device_id>.<token>`,
  bcrypt-hashed in DB) — `events`, `heartbeat`, `resync`, `config`.
- Full admin REST API for devices, enrollment, breaches, ledger, logs.
- Admin dashboard with live feed (Supabase Realtime), device manager, P/L/A
  ledger with CSV export, breach acknowledgement, enrollment panel.
- Public `/lookup` page (no auth — anyone with a `student_code` sees their last
  20 entries).
- Single-password admin login backed by `ADMIN_PASSWORD` + signed session cookie.
- DB schema + RLS policies + Realtime publication in `lib/janus-schema.sql`.
- Pure-logic unit tests for event parsing/evaluation and device-token bcrypt
  round-trip.
- `pnpm install`, `pnpm typecheck`, `pnpm build` all pass.

## Re-integration contract — IMPORTANT

The whole point of this repo is that re-integration into the main website is a
near-trivial copy back. To preserve this:

- Every file under `features/attendance/`, `app/api/attendance/`,
  `app/api/admin/attendance/`, and `lib/api/attendance-event-core.ts` is a
  **byte-for-byte copy** of the main repo's tree. **DO NOT change import paths,
  module structure, or public APIs in those files.** Bug fixes are fine, but
  flag them — they should also go into the main repo when merging.
- Standalone-only files (the ones the main repo doesn't need): `app/page.tsx`
  (landing), `app/admin/page.tsx` + login-form/logout-button, `app/lookup/`,
  `app/api/lookup/`, the slim `lib/supabase.ts` Database type, the
  `students` block in `lib/janus-schema.sql`. These can change freely.
- If you add a new file inside `features/attendance/` or
  `app/api/attendance/`, treat the `@/...` import path as the contract — it
  must work unmodified when dropped into the main repo.

A re-integration table lives in `README.md` under "Re-integration into the
main Armath site" — keep it accurate as you add things.

## Setup

```bash
# pnpm lives at ~/.local/share/pnpm/bin/ — source ~/.bashrc if "command not found"
source ~/.bashrc
cd ~/Armath/Arapi/Janus

pnpm install
pnpm typecheck
pnpm build
pnpm dev          # http://localhost:3000
```

Environment (`.env.local`, copy from `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=...                # ≥8 chars
ADMIN_SESSION_SECRET=...          # ≥16 chars
DEVICE_TOKEN_SECRET=...           # ≥32 chars (reserved; not currently consumed)
```

To set up the database: paste `lib/janus-schema.sql` into the Supabase SQL
editor and run it once, top-to-bottom.

## Quirks and gotchas

- **Tests need Node 22.6+** — `pnpm test` uses `node --experimental-strip-types`
  to run TS directly. The host is currently on Node 20.11; tests typecheck but
  won't execute until you upgrade. Don't try to "fix" the test runner; just note
  it if a test should be added.
- **`pnpm` PATH** — pnpm is installed via `pnpm setup` at
  `~/.local/share/pnpm/bin/pnpm`. The Bash tool's default shell doesn't load
  `~/.bashrc`; if `pnpm` returns "command not found", run `source ~/.bashrc`
  once. Don't search the filesystem for it.
- **Build script approvals** — `sharp` and `unrs-resolver` need to run install
  scripts. They're approved in both `package.json` (`pnpm.onlyBuiltDependencies`)
  and `pnpm-workspace.yaml` (`allowBuilds`). Either alone is enough; the
  duplication is fine.
- **Supabase `from(table)` on a union table name** — typed inserts don't narrow
  through a union. The pattern used in `app/api/attendance/resync/route.ts` is
  to branch the call (`from("attendance_logs")` vs `from("attendance_breaches")`)
  so each call sees the right Insert type. If you write similar code, do the
  same.
- **Realtime publication** — the schema explicitly adds `attendance_logs` and
  `attendance_breaches` to `supabase_realtime`. The admin live feed depends on
  this. New tables don't auto-publish.
- **No student session** — the standalone build deliberately has no per-student
  auth; the public `/lookup` page is the simplest way to expose attendance to a
  student. If anyone asks for a "secure my-attendance page", that's a re-design,
  not a small change. Discuss before building.
- **Single admin password** — there's no multi-admin or email recovery flow.
  Anyone with `ADMIN_PASSWORD` is fully authorized. Adequate for the competition
  demo; flag if a real deployment needs more.

## Style & conventions

- Match the existing code style in `features/attendance/` (which mirrors the
  main repo): tabs/spaces as found, no comments unless explaining a hidden
  invariant, terse component code.
- Tailwind 4 syntax in CSS (`@import "tailwindcss"`, `@config`).
- Lucide icons, Tailwind for styling, no UI primitive library beyond plain HTML.
- Keep things simple. The user explicitly asked for "as simple as possible" —
  don't add abstractions or features the user hasn't asked for.

## How to interact with the user

- The user is non-native English; messages can be terse. Ask if a request is
  ambiguous; offer 2–3 options for design choices instead of guessing.
- For exploratory questions ("what could we do about X?"), respond with a
  recommendation + tradeoff in 2–3 sentences and wait — don't implement.
- Confirm before destructive actions, force-pushes, or anything that affects
  the main website repo.

## Likely next work (open — confirm with user before starting)

Things that would naturally come next, in rough priority order:

1. `git init`, first commit, push to a fresh GitHub repo.
2. Seed-data script (a few sample students + one device + a handful of synthetic
   logs) so the dashboard doesn't show empty states during a demo.
3. ESP32 firmware sketch / mock-device script that POSTs realistic events to
   `/api/attendance/events` for live demos.
4. Architecture diagram in `README.md` or `docs/` for the competition pitch.
5. Deployment (Vercel + Supabase) walkthrough in the README.
6. Optional: rate-limit the `/lookup` endpoint per `student_code` (currently
   per-IP only).

Pick from the list with the user, or wait for their next instruction.
