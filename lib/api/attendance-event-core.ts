import type { Database } from "@/lib/supabase"

export type AuthMethod = "rfid" | "fingerprint" | "2fa"
export type BreachReason = "no_auth" | "rejected_auth" | "tamper"
export type DeviceMode = "attendance" | "silent" | "exam" | "maintenance"
export type AttemptedSource = "rfid" | "fingerprint"

export interface AuthEventInput {
  type: "auth"
  auth_method: AuthMethod
  rfid_uid?: string
  fingerprint_id?: number
  student_code?: string
  occurred_at: string
  event_id?: string
  raw_identifier?: string
}

export interface BreachEventInput {
  type: "breach"
  reason: BreachReason
  attempted_source?: AttemptedSource
  attempted_id?: string
  occurred_at: string
  event_id?: string
}

export type AttendanceEventInput = AuthEventInput | BreachEventInput

export interface DeviceContext {
  device_id: string
  mode: DeviceMode
}

export interface ResolvedStudent {
  id: string
}

export type AttendanceLogInsert = Database["public"]["Tables"]["attendance_logs"]["Insert"]
export type AttendanceBreachInsert = Database["public"]["Tables"]["attendance_breaches"]["Insert"]

export interface ParseSuccess {
  ok: true
  event: AttendanceEventInput
}

export interface ParseFailure {
  ok: false
  error: string
}

const AUTH_METHODS: ReadonlySet<AuthMethod> = new Set(["rfid", "fingerprint", "2fa"])
const BREACH_REASONS: ReadonlySet<BreachReason> = new Set(["no_auth", "rejected_auth", "tamper"])
const ATTEMPTED_SOURCES: ReadonlySet<AttemptedSource> = new Set(["rfid", "fingerprint"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false
  const ms = Date.parse(value)
  return Number.isFinite(ms)
}

function isFingerprintId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1000
}

export function parseAttendanceEvent(raw: unknown): ParseSuccess | ParseFailure {
  if (!isRecord(raw)) return { ok: false, error: "Body must be a JSON object" }

  const type = raw.type
  if (type !== "auth" && type !== "breach") {
    return { ok: false, error: "type must be 'auth' or 'breach'" }
  }

  if (!isIsoTimestamp(raw.occurred_at)) {
    return { ok: false, error: "occurred_at must be an ISO 8601 timestamp" }
  }

  if (raw.event_id !== undefined && (typeof raw.event_id !== "string" || raw.event_id.length > 64)) {
    return { ok: false, error: "event_id must be a string ≤ 64 chars" }
  }

  if (type === "auth") {
    if (typeof raw.auth_method !== "string" || !AUTH_METHODS.has(raw.auth_method as AuthMethod)) {
      return { ok: false, error: "auth_method must be 'rfid', 'fingerprint', or '2fa'" }
    }
    const hasRfid = typeof raw.rfid_uid === "string" && raw.rfid_uid.length > 0
    const hasFp = isFingerprintId(raw.fingerprint_id)
    const hasCode = typeof raw.student_code === "string" && raw.student_code.length > 0
    if (!hasRfid && !hasFp && !hasCode) {
      return { ok: false, error: "auth event needs one of rfid_uid / fingerprint_id / student_code" }
    }
    if (raw.raw_identifier !== undefined && typeof raw.raw_identifier !== "string") {
      return { ok: false, error: "raw_identifier must be a string when provided" }
    }
    return {
      ok: true,
      event: {
        type: "auth",
        auth_method: raw.auth_method as AuthMethod,
        rfid_uid: hasRfid ? (raw.rfid_uid as string) : undefined,
        fingerprint_id: hasFp ? (raw.fingerprint_id as number) : undefined,
        student_code: hasCode ? (raw.student_code as string) : undefined,
        occurred_at: raw.occurred_at as string,
        event_id: raw.event_id as string | undefined,
        raw_identifier: raw.raw_identifier as string | undefined,
      },
    }
  }

  if (typeof raw.reason !== "string" || !BREACH_REASONS.has(raw.reason as BreachReason)) {
    return { ok: false, error: "reason must be 'no_auth', 'rejected_auth', or 'tamper'" }
  }
  if (raw.attempted_source !== undefined) {
    if (typeof raw.attempted_source !== "string" || !ATTEMPTED_SOURCES.has(raw.attempted_source as AttemptedSource)) {
      return { ok: false, error: "attempted_source must be 'rfid' or 'fingerprint'" }
    }
  }
  if (raw.attempted_id !== undefined && typeof raw.attempted_id !== "string") {
    return { ok: false, error: "attempted_id must be a string when provided" }
  }
  return {
    ok: true,
    event: {
      type: "breach",
      reason: raw.reason as BreachReason,
      attempted_source: raw.attempted_source as AttemptedSource | undefined,
      attempted_id: raw.attempted_id as string | undefined,
      occurred_at: raw.occurred_at as string,
      event_id: raw.event_id as string | undefined,
    },
  }
}

export interface EvaluateInput {
  event: AttendanceEventInput
  device: DeviceContext
  /**
   * Caller looks up the student from the identifier in the event (rfid_uid /
   * fingerprint_id / student_code) and passes the result here. `null` means
   * the device claimed authorization for an identifier we can't resolve — the
   * core treats this as a rejected_auth breach.
   */
  student: ResolvedStudent | null
}

export type EvaluationResult =
  | {
      kind: "log"
      status: 201
      insert: AttendanceLogInsert
    }
  | {
      kind: "breach"
      status: 201
      insert: AttendanceBreachInsert
    }
  | {
      kind: "rejected_unknown_identifier"
      status: 200
      insert: AttendanceBreachInsert
      note: string
    }
  | {
      kind: "maintenance_dropped"
      status: 200
      note: string
    }

export function evaluateAttendanceEvent(input: EvaluateInput): EvaluationResult {
  const { event, device, student } = input

  if (device.mode === "maintenance") {
    return {
      kind: "maintenance_dropped",
      status: 200,
      note: "device is in maintenance mode; event ignored",
    }
  }

  if (event.type === "auth") {
    if (student === null) {
      return {
        kind: "rejected_unknown_identifier",
        status: 200,
        note: "auth event referenced an unknown identifier; recorded as rejected_auth",
        insert: {
          device_id: device.device_id,
          detected_at: event.occurred_at,
          reason: "rejected_auth",
          attempted_source: event.auth_method === "fingerprint" ? "fingerprint" : "rfid",
          attempted_id: event.rfid_uid ?? event.student_code ?? (event.fingerprint_id != null ? String(event.fingerprint_id) : null),
          mode: device.mode,
          event_id: event.event_id ?? null,
        },
      }
    }
    return {
      kind: "log",
      status: 201,
      insert: {
        device_id: device.device_id,
        student_id: student.id,
        auth_method: event.auth_method,
        entered_at: event.occurred_at,
        session_mode: device.mode,
        event_id: event.event_id ?? null,
        raw_identifier: event.raw_identifier ?? event.rfid_uid ?? event.student_code ?? null,
      },
    }
  }

  return {
    kind: "breach",
    status: 201,
    insert: {
      device_id: device.device_id,
      detected_at: event.occurred_at,
      reason: event.reason,
      attempted_source: event.attempted_source ?? null,
      attempted_id: event.attempted_id ?? null,
      mode: device.mode,
      event_id: event.event_id ?? null,
    },
  }
}
