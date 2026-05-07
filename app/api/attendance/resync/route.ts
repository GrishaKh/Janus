import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { authenticateDeviceRequest } from "@/features/attendance/lib/device-auth"
import { evaluateAttendanceEvent, parseAttendanceEvent } from "@/lib/api/attendance-event-core"
import { resolveStudentForAuthEvent } from "@/features/attendance/lib/student-lookup"
import { deviceResyncRateLimiter } from "@/features/attendance/lib/device-rate-limit"
import { createRequestLogMeta, logRequestEvent } from "@/lib/server-logger"

const MAX_BATCH = 200

interface ResyncSummary {
  accepted_logs: number
  accepted_breaches: number
  duplicates: number
  invalid: number
  maintenance_dropped: number
  errors: number
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const logMeta = createRequestLogMeta(request, "/api/attendance/resync")

  const auth = await authenticateDeviceRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }
  const device = auth.device

  const rate = deviceResyncRateLimiter.check(`resync:${device.device_id}`)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    )
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as { events?: unknown }).events)) {
    return NextResponse.json({ error: "events_array_required" }, { status: 400 })
  }
  const events = (body as { events: unknown[] }).events
  if (events.length === 0) {
    return NextResponse.json({ summary: emptySummary() })
  }
  if (events.length > MAX_BATCH) {
    return NextResponse.json({ error: "batch_too_large", max: MAX_BATCH }, { status: 413 })
  }

  const summary = emptySummary()

  for (const raw of events) {
    const parsed = parseAttendanceEvent(raw)
    if (!parsed.ok) {
      summary.invalid++
      continue
    }
    const event = parsed.event
    const student = event.type === "auth" ? await resolveStudentForAuthEvent(event) : null
    const decision = evaluateAttendanceEvent({
      event,
      device: { device_id: device.device_id, mode: device.mode },
      student,
    })

    if (decision.kind === "maintenance_dropped") {
      summary.maintenance_dropped++
      continue
    }

    const { error, table } =
      decision.kind === "log"
        ? { error: (await supabaseAdmin.from("attendance_logs").insert(decision.insert)).error, table: "attendance_logs" as const }
        : { error: (await supabaseAdmin.from("attendance_breaches").insert(decision.insert)).error, table: "attendance_breaches" as const }
    if (error) {
      if (error.code === "23505") {
        summary.duplicates++
        continue
      }
      summary.errors++
      logRequestEvent("error", "attendance.resync.row_failed", `resync row insert failed`, logMeta, {
        status: 500,
        details: { code: error.code, table },
      })
      continue
    }

    if (decision.kind === "log") summary.accepted_logs++
    else summary.accepted_breaches++
  }

  logRequestEvent("info", "attendance.resync.batch_done", "resync batch processed", logMeta, {
    status: 200,
    details: { device_id: device.device_id, total: events.length, ...summary },
  })

  return NextResponse.json({ summary })
}

function emptySummary(): ResyncSummary {
  return {
    accepted_logs: 0,
    accepted_breaches: 0,
    duplicates: 0,
    invalid: 0,
    maintenance_dropped: 0,
    errors: 0,
  }
}
