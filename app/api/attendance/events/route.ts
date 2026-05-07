import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { authenticateDeviceRequest } from "@/features/attendance/lib/device-auth"
import { evaluateAttendanceEvent, parseAttendanceEvent } from "@/lib/api/attendance-event-core"
import { resolveStudentForAuthEvent } from "@/features/attendance/lib/student-lookup"
import { deviceEventRateLimiter } from "@/features/attendance/lib/device-rate-limit"
import { createRequestLogMeta, logRequestEvent } from "@/lib/server-logger"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const logMeta = createRequestLogMeta(request, "/api/attendance/events")

  const auth = await authenticateDeviceRequest(request)
  if (!auth.ok) {
    logRequestEvent("warn", "attendance.events.unauthorized", `device auth failed: ${auth.reason}`, logMeta, {
      status: auth.status,
    })
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }

  const device = auth.device

  const rate = deviceEventRateLimiter.check(`events:${device.device_id}`)
  if (!rate.allowed) {
    logRequestEvent("warn", "attendance.events.rate_limited", "device events rate-limited", logMeta, {
      status: 429,
      details: { device_id: device.device_id },
    })
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    )
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = parseAttendanceEvent(raw)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const event = parsed.event
  const student = event.type === "auth" ? await resolveStudentForAuthEvent(event) : null

  const decision = evaluateAttendanceEvent({
    event,
    device: { device_id: device.device_id, mode: device.mode },
    student,
  })

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 })
  }

  if (decision.kind === "maintenance_dropped") {
    logRequestEvent("info", "attendance.events.maintenance_dropped", decision.note, logMeta, {
      status: 200,
      details: { device_id: device.device_id },
    })
    return NextResponse.json({ status: "maintenance_dropped" }, { status: 200 })
  }

  if (decision.kind === "log") {
    const { error, data } = await supabaseAdmin
      .from("attendance_logs")
      .insert(decision.insert)
      .select("id")
      .single()
    if (error) {
      // Idempotency: duplicate event_id returns the existing row's id.
      if (error.code === "23505" && decision.insert.event_id) {
        const { data: existing } = await supabaseAdmin
          .from("attendance_logs")
          .select("id")
          .eq("event_id", decision.insert.event_id)
          .maybeSingle()
        if (existing) {
          return NextResponse.json({ status: "duplicate", kind: "log", id: existing.id }, { status: 200 })
        }
      }
      logRequestEvent("error", "attendance.events.insert_failed", "log insert failed", logMeta, {
        status: 500,
        details: { code: error.code },
      })
      return NextResponse.json({ error: "insert_failed" }, { status: 500 })
    }
    logRequestEvent("info", "attendance.events.logged", "attendance log inserted", logMeta, {
      status: 201,
      details: { device_id: device.device_id, log_id: data?.id },
    })
    return NextResponse.json({ status: "logged", kind: "log", id: data?.id }, { status: 201 })
  }

  // breach + rejected_unknown_identifier both insert into attendance_breaches
  const { error, data } = await supabaseAdmin
    .from("attendance_breaches")
    .insert(decision.insert)
    .select("id")
    .single()
  if (error) {
    if (error.code === "23505" && decision.insert.event_id) {
      const { data: existing } = await supabaseAdmin
        .from("attendance_breaches")
        .select("id")
        .eq("event_id", decision.insert.event_id)
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ status: "duplicate", kind: "breach", id: existing.id }, { status: 200 })
      }
    }
    logRequestEvent("error", "attendance.events.breach_insert_failed", "breach insert failed", logMeta, {
      status: 500,
      details: { code: error.code },
    })
    return NextResponse.json({ error: "insert_failed" }, { status: 500 })
  }

  const kind = decision.kind === "rejected_unknown_identifier" ? "rejected" : "breach"
  logRequestEvent("warn", "attendance.events.breach", `breach recorded: ${decision.insert.reason}`, logMeta, {
    status: decision.status,
    details: { device_id: device.device_id, breach_id: data?.id, reason: decision.insert.reason },
  })
  return NextResponse.json({ status: kind, kind: "breach", id: data?.id }, { status: decision.status })
}
