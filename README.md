# Janus

RFID + fingerprint entry-control system for the Armath Arapi makerspace.
Standalone competition build of a feature that will later be folded back into
the main Armath website.

> Janus is the Roman god of doorways. The system gates physical access at the
> door (ESP32 readers) and records every authorized entry, every breach, and
> every device's health in a real-time admin dashboard.

## What's in here

- **ESP32-facing API** under `app/api/attendance/*`
  (`events`, `heartbeat`, `resync`, `config`) — bearer-authenticated per device.
- **Admin API** under `app/api/admin/attendance/*` — devices, enrollment,
  breaches, ledger, logs.
- **Admin dashboard** at `/admin` — live feed (Supabase Realtime), device
  manager, breach acknowledgement, P/L/A ledger with CSV export, enrollment.
- **Public lookup** at `/lookup` — anyone with a `student_code` can see their
  recent entries.
- **Pure logic** in `lib/api/attendance-event-core.ts` and
  `features/attendance/lib/device-token.ts`, fully unit-tested.

## Stack

Next.js 15 (App Router), React 19, Supabase (Postgres + Realtime), Tailwind,
bcrypt for device tokens, Zod for env validation.

## Setup

1. Create a Supabase project. In the SQL editor, paste & run
   [`lib/janus-schema.sql`](lib/janus-schema.sql) once, top-to-bottom.
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD` (≥8 chars), `ADMIN_SESSION_SECRET` (≥16 chars)
   - `DEVICE_TOKEN_SECRET` (≥32 chars — reserved for future device-side
     verification; not currently used by the standalone build)
3. Install + run:
   ```bash
   pnpm install
   pnpm dev
   ```
   Open http://localhost:3000 — the landing page links into `/admin` and
   `/lookup`.

## Tests

```bash
pnpm typecheck
pnpm test
```

The pure event parser/evaluator and the device-token bcrypt round-trip are
covered by `tests/api/attendance-event-core.test.ts` and
`tests/api/attendance-device-auth.test.ts`.

## ESP32 contract

Each device has a `device_id` (URL-safe, 3–64 chars) and a bearer token.
Issue both in the admin dashboard → Devices → New device. The bearer is shown
once; flash it onto the ESP32 NVS. Header format:

```
Authorization: Bearer <device_id>.<token>
```

### `POST /api/attendance/events`

```json
{
  "type": "auth",
  "auth_method": "rfid",
  "rfid_uid": "04A1B2C3D4E5",
  "occurred_at": "2026-05-04T08:31:42.123Z",
  "event_id": "esp-evt-9842"
}
```

`type` is either `"auth"` (RFID/fingerprint tap) or `"breach"` (forced entry,
no-auth, tamper). Replays with the same `event_id` return 200 and the existing
row's id — safe to retry from the device.

### `POST /api/attendance/heartbeat`

Empty body or `{ "battery_percent": 87 }`. Updates `last_seen_at`, returns the
current device mode and any active alarm-silence window.

### `GET /api/attendance/config`

Pulls the per-device mode plus the cache of enrolled `rfid_uid` /
`fingerprint_id` / `student_code` values. The ESP32 keeps this locally so it
can authorize taps without a round-trip on the hot path.

### `POST /api/attendance/resync`

`{ "events": [ ... ] }` — bulk replay of buffered events after a network
outage. Capped at 200 per request.

## Re-integration into the main Armath site

This repo is intentionally structured so re-integration is a near-trivial
copy back:

| Path | Action when merging back |
| --- | --- |
| `features/attendance/**` | Copy as-is (paths already match). |
| `app/api/attendance/**` | Copy as-is. |
| `app/api/admin/attendance/**` | Copy as-is. |
| `lib/api/attendance-event-core.ts` | Copy as-is. |
| `lib/janus-schema.sql` | Drop the `students` block; the main repo has its own richer `students` table with the same RFID/fingerprint columns. Run only the attendance block. |
| `lib/admin-auth.ts`, `admin-rate-limit.ts`, `window-rate-limit.ts`, `request-utils.ts`, `server-logger.ts`, `env.ts`, `utils.ts`, `supabase.ts` | Already present in the main repo — keep that copy. |
| `app/admin/page.tsx` + login/logout helpers, `app/page.tsx`, `app/lookup/page.tsx` | Standalone-only; do not copy. The main repo's admin dashboard already mounts `<AttendanceView />`. |

## Architecture sketch

```
┌─────────────┐   bearer    ┌──────────────────────┐
│   ESP32     │────────────▶│  /api/attendance/*   │
│  (RFID +    │             │  events / heartbeat  │
│  fingerprint)             │  resync / config     │
└─────────────┘             └──────────┬───────────┘
                                       │
                                       ▼
                            ┌──────────────────────┐
                            │   Supabase Postgres  │
                            │  (logs / breaches /  │
                            │   devices / ledger)  │
                            └──────────┬───────────┘
                                       │ Realtime
                                       ▼
┌──────────────┐   admin   ┌────────────────────────┐
│  /admin      │◀──────────│   /api/admin/...       │
│  dashboard   │  cookie   │   gated by              │
│              │   auth    │   adminAttendanceGate   │
└──────────────┘           └─────────────────────────┘

┌──────────────┐  no auth  ┌────────────────────────┐
│  /lookup     │──────────▶│   /api/lookup?code=X   │
└──────────────┘           └────────────────────────┘
```
