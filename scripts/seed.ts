/**
 * scripts/seed.ts — populate Supabase with demo data for a Janus dashboard demo.
 *
 * Run:
 *   pnpm seed         # upsert (safe, idempotent)
 *   pnpm seed:reset   # wipe all `demo-*` / `seed-*` rows first, then reseed
 *
 * Requires Node 22.6+ (for --experimental-strip-types) and a populated
 * .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Standalone-only file — has no counterpart in the main Armath repo and
 * lives outside features/attendance/ on purpose.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import bcrypt from "bcryptjs"

const BCRYPT_ROUNDS = 12

// ============================================================
// Demo data — every row uses a `demo-*` ID or `seed-*` event_id
// so `pnpm seed:reset` can find and wipe just these rows.
// ============================================================

interface SeedStudent {
  username: string
  full_name: string
  student_code: string
  rfid_uid: string
  fingerprint_id: number
}

const STUDENTS: SeedStudent[] = [
  { username: "demo-aram",   full_name: "Aram Petrosyan",     student_code: "ARM-0001", rfid_uid: "04A3B2C1D0", fingerprint_id: 1 },
  { username: "demo-anush",  full_name: "Anush Sahakyan",     student_code: "ARM-0002", rfid_uid: "04B3C4D5E1", fingerprint_id: 2 },
  { username: "demo-davit",  full_name: "Davit Hovhannisyan", student_code: "ARM-0003", rfid_uid: "04C4D5E6F2", fingerprint_id: 3 },
  { username: "demo-mariam", full_name: "Mariam Grigoryan",   student_code: "ARM-0004", rfid_uid: "04D5E6F7A3", fingerprint_id: 4 },
  { username: "demo-tigran", full_name: "Tigran Khachatryan", student_code: "ARM-0005", rfid_uid: "04E6F7A8B4", fingerprint_id: 5 },
  { username: "demo-lilit",  full_name: "Lilit Avetisyan",    student_code: "ARM-0006", rfid_uid: "04F7A8B9C5", fingerprint_id: 6 },
]

interface SeedDevice {
  device_id: string
  display_name: string
  mode: "attendance" | "silent" | "exam" | "maintenance"
  // Deterministic raw token. Bearer = `${device_id}.${raw_token}`.
  raw_token: string
}

const DEVICES: SeedDevice[] = [
  {
    device_id: "demo-front-door",
    display_name: "Front Door (Demo)",
    mode: "attendance",
    raw_token: "demo-token-front-door-7f3a9b1c4e8d2a6b",
  },
  {
    device_id: "demo-workshop",
    display_name: "Workshop (Demo)",
    mode: "silent",
    raw_token: "demo-token-workshop-b8c1e4f7a2d5b9c3",
  },
]

interface SeedSession {
  id: string
  subject: string
  group_code: string
  // Hours from "now" at seed time. Negative = past, positive = future.
  offset_hours: number
  duration_min: number
  grace_min: number
}

const SESSIONS: SeedSession[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    subject: "Robotics",
    group_code: "ROBOTICS-A",
    offset_hours: -24,
    duration_min: 90,
    grace_min: 10,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    subject: "Coding",
    group_code: "CODING-B",
    offset_hours: -0.5,
    duration_min: 90,
    grace_min: 10,
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    subject: "Robotics",
    group_code: "ROBOTICS-A",
    offset_hours: 24,
    duration_min: 90,
    grace_min: 10,
  },
]

const ENROLLMENTS: Array<{ username: string; group_code: string }> = [
  { username: "demo-aram",   group_code: "ROBOTICS-A" },
  { username: "demo-anush",  group_code: "ROBOTICS-A" },
  { username: "demo-davit",  group_code: "ROBOTICS-A" },
  { username: "demo-tigran", group_code: "ROBOTICS-A" },
  { username: "demo-davit",  group_code: "CODING-B" },
  { username: "demo-mariam", group_code: "CODING-B" },
  { username: "demo-lilit",  group_code: "CODING-B" },
]

interface SeedLog {
  event_id: string
  username: string
  device_id: string
  auth_method: "rfid" | "fingerprint" | "2fa"
  // Anchor: either a session's scheduled_at, or "now". offset_min applied on top.
  base: { type: "session"; sessionIdx: number } | { type: "now" }
  offset_min: number
}

const LOGS: SeedLog[] = [
  // Yesterday robotics — 4 enrolled, 3 attended, 1 absent (Tigran)
  { event_id: "seed-log-1",  username: "demo-aram",   device_id: "demo-front-door", auth_method: "rfid",        base: { type: "session", sessionIdx: 0 }, offset_min: -3 },
  { event_id: "seed-log-2",  username: "demo-anush",  device_id: "demo-front-door", auth_method: "fingerprint", base: { type: "session", sessionIdx: 0 }, offset_min: 1 },
  { event_id: "seed-log-3",  username: "demo-davit",  device_id: "demo-front-door", auth_method: "rfid",        base: { type: "session", sessionIdx: 0 }, offset_min: 15 },

  // Today coding — 3 enrolled, all 3 attended, 1 late (Davit)
  { event_id: "seed-log-4",  username: "demo-mariam", device_id: "demo-front-door", auth_method: "rfid",        base: { type: "session", sessionIdx: 1 }, offset_min: -5 },
  { event_id: "seed-log-5",  username: "demo-lilit",  device_id: "demo-front-door", auth_method: "fingerprint", base: { type: "session", sessionIdx: 1 }, offset_min: 8 },
  { event_id: "seed-log-6",  username: "demo-davit",  device_id: "demo-front-door", auth_method: "rfid",        base: { type: "session", sessionIdx: 1 }, offset_min: 20 },

  // Workshop walk-ins (silent mode, not tied to a class) — populate live feed
  { event_id: "seed-log-7",  username: "demo-aram",   device_id: "demo-workshop",   auth_method: "rfid",        base: { type: "now" }, offset_min: -120 },
  { event_id: "seed-log-8",  username: "demo-tigran", device_id: "demo-workshop",   auth_method: "fingerprint", base: { type: "now" }, offset_min: -90  },
  { event_id: "seed-log-9",  username: "demo-lilit",  device_id: "demo-workshop",   auth_method: "rfid",        base: { type: "now" }, offset_min: -45  },

  // Extra front-door entries earlier today
  { event_id: "seed-log-10", username: "demo-anush",  device_id: "demo-front-door", auth_method: "rfid",        base: { type: "now" }, offset_min: -180 },
  { event_id: "seed-log-11", username: "demo-mariam", device_id: "demo-front-door", auth_method: "fingerprint", base: { type: "now" }, offset_min: -10  },
  { event_id: "seed-log-12", username: "demo-davit",  device_id: "demo-front-door", auth_method: "rfid",        base: { type: "now" }, offset_min: -5   },
]

interface SeedBreach {
  event_id: string
  device_id: string
  reason: "no_auth" | "rejected_auth" | "tamper"
  attempted_source: "rfid" | "fingerprint" | null
  attempted_id: string | null
  mode: "attendance" | "silent" | "exam" | "maintenance"
  offset_min: number
}

const BREACHES: SeedBreach[] = [
  { event_id: "seed-breach-1", device_id: "demo-front-door", reason: "no_auth",       attempted_source: "rfid",        attempted_id: "0411111A2B", mode: "attendance", offset_min: -120 },
  { event_id: "seed-breach-2", device_id: "demo-front-door", reason: "rejected_auth", attempted_source: "rfid",        attempted_id: "0422222B3C", mode: "attendance", offset_min: -60  },
  { event_id: "seed-breach-3", device_id: "demo-front-door", reason: "no_auth",       attempted_source: "fingerprint", attempted_id: "999",        mode: "attendance", offset_min: -30  },
  { event_id: "seed-breach-4", device_id: "demo-workshop",   reason: "tamper",        attempted_source: null,          attempted_id: null,         mode: "silent",     offset_min: -10  },
  { event_id: "seed-breach-5", device_id: "demo-workshop",   reason: "rejected_auth", attempted_source: "rfid",        attempted_id: "0455555C4D", mode: "silent",     offset_min: -5   },
]

// ============================================================
// Logic
// ============================================================

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env: ${name}`)
    console.error("Make sure .env.local is set up. `pnpm seed` loads it via --env-file.")
    process.exit(1)
  }
  return v
}

function getClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function reset(client: SupabaseClient): Promise<void> {
  console.log("Resetting demo rows…")
  const sessionIds = SESSIONS.map((s) => s.id)
  // FK ordering: clear logs/breaches first (precise filter), then sessions,
  // then devices, then students. Enrollments cascade from students.
  const ops = [
    client.from("attendance_logs").delete().like("event_id", "seed-%"),
    client.from("attendance_breaches").delete().like("event_id", "seed-%"),
    client.from("attendance_sessions").delete().in("id", sessionIds),
    client.from("attendance_devices").delete().like("device_id", "demo-%"),
    client.from("students").delete().like("username", "demo-%"),
  ]
  for (const op of ops) {
    const { error } = await op
    if (error) throw error
  }
}

async function upsertStudents(client: SupabaseClient): Promise<Map<string, string>> {
  const rows = STUDENTS.map((s) => ({
    username: s.username,
    full_name: s.full_name,
    student_code: s.student_code,
    rfid_uid: s.rfid_uid,
    fingerprint_id: s.fingerprint_id,
    status: "active",
  }))
  const { data, error } = await client
    .from("students")
    .upsert(rows, { onConflict: "username" })
    .select("id, username")
  if (error) throw error
  if (!data) throw new Error("No rows returned from students upsert")
  console.log(`  students:    ${data.length}`)
  return new Map(data.map((r) => [r.username, r.id]))
}

async function upsertDevices(client: SupabaseClient): Promise<void> {
  const rows = await Promise.all(
    DEVICES.map(async (d) => ({
      device_id: d.device_id,
      display_name: d.display_name,
      mode: d.mode,
      token_hash: await bcrypt.hash(d.raw_token, BCRYPT_ROUNDS),
    })),
  )
  const { error } = await client
    .from("attendance_devices")
    .upsert(rows, { onConflict: "device_id" })
  if (error) throw error
  console.log(`  devices:     ${rows.length}`)
}

async function upsertSessions(client: SupabaseClient): Promise<Date[]> {
  const now = Date.now()
  const sessionTimes = SESSIONS.map((s) => new Date(now + s.offset_hours * 3600_000))
  const rows = SESSIONS.map((s, i) => ({
    id: s.id,
    subject: s.subject,
    group_code: s.group_code,
    scheduled_at: sessionTimes[i].toISOString(),
    duration_min: s.duration_min,
    grace_min: s.grace_min,
  }))
  const { error } = await client
    .from("attendance_sessions")
    .upsert(rows, { onConflict: "id" })
  if (error) throw error
  console.log(`  sessions:    ${rows.length}`)
  return sessionTimes
}

async function upsertEnrollments(
  client: SupabaseClient,
  studentIds: Map<string, string>,
): Promise<void> {
  const rows = ENROLLMENTS.map((e) => {
    const id = studentIds.get(e.username)
    if (!id) throw new Error(`Missing student id for ${e.username}`)
    return { student_id: id, group_code: e.group_code }
  })
  const { error } = await client
    .from("attendance_enrollments")
    .upsert(rows, { onConflict: "student_id,group_code" })
  if (error) throw error
  console.log(`  enrollments: ${rows.length}`)
}

async function upsertLogs(
  client: SupabaseClient,
  studentIds: Map<string, string>,
  sessionTimes: Date[],
): Promise<void> {
  const now = Date.now()
  const rows = LOGS.map((log) => {
    const studentId = studentIds.get(log.username)
    if (!studentId) throw new Error(`Missing student id for ${log.username}`)
    const baseMs = log.base.type === "session" ? sessionTimes[log.base.sessionIdx].getTime() : now
    const enteredAt = new Date(baseMs + log.offset_min * 60_000).toISOString()
    return {
      device_id: log.device_id,
      student_id: studentId,
      auth_method: log.auth_method,
      entered_at: enteredAt,
      event_id: log.event_id,
    }
  })
  const { error } = await client
    .from("attendance_logs")
    .upsert(rows, { onConflict: "event_id" })
  if (error) throw error
  console.log(`  logs:        ${rows.length}`)
}

async function upsertBreaches(client: SupabaseClient): Promise<void> {
  const now = Date.now()
  const rows = BREACHES.map((b) => ({
    device_id: b.device_id,
    reason: b.reason,
    attempted_source: b.attempted_source,
    attempted_id: b.attempted_id,
    mode: b.mode,
    detected_at: new Date(now + b.offset_min * 60_000).toISOString(),
    event_id: b.event_id,
  }))
  const { error } = await client
    .from("attendance_breaches")
    .upsert(rows, { onConflict: "event_id" })
  if (error) throw error
  console.log(`  breaches:    ${rows.length}`)
}

function printBearers(): void {
  console.log("\nDevice bearer tokens (deterministic — same on every run):")
  for (const d of DEVICES) {
    console.log(`  ${d.device_id.padEnd(16)} ${d.device_id}.${d.raw_token}`)
  }
  console.log("\nUse these in the mock-device script or for manual API testing.")
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const shouldReset = args.includes("--reset")
  const client = getClient()
  console.log(shouldReset ? "Mode: reset + seed" : "Mode: upsert")
  if (shouldReset) await reset(client)
  console.log("Seeding…")
  const studentIds = await upsertStudents(client)
  await upsertDevices(client)
  const sessionTimes = await upsertSessions(client)
  await upsertEnrollments(client, studentIds)
  await upsertLogs(client, studentIds, sessionTimes)
  await upsertBreaches(client)
  printBearers()
  console.log("\nDone.")
}

main().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
