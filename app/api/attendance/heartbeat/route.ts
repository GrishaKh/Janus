import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { authenticateDeviceRequest } from "@/features/attendance/lib/device-auth"
import { deviceHeartbeatRateLimiter } from "@/features/attendance/lib/device-rate-limit"
import { createRequestLogMeta, logRequestEvent } from "@/lib/server-logger"

interface HeartbeatBody {
  battery_percent?: unknown
}

function parseBatteryPercent(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  if (typeof raw !== "number" || !Number.isFinite(raw)) return undefined
  const clamped = Math.round(Math.max(0, Math.min(100, raw)))
  return clamped
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const logMeta = createRequestLogMeta(request, "/api/attendance/heartbeat")

  const auth = await authenticateDeviceRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }
  const device = auth.device

  const rate = deviceHeartbeatRateLimiter.check(`heartbeat:${device.device_id}`)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    )
  }

  let body: HeartbeatBody = {}
  try {
    const raw = await request.json().catch(() => null)
    if (raw && typeof raw === "object") body = raw as HeartbeatBody
  } catch {
    // Empty body is fine — heartbeat with no battery data is allowed.
  }

  const battery = parseBatteryPercent(body.battery_percent)

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 })
  }

  const update: Record<string, unknown> = { last_seen_at: new Date().toISOString() }
  if (battery !== undefined) update.last_battery_percent = battery

  const { error } = await supabaseAdmin
    .from("attendance_devices")
    .update(update)
    .eq("device_id", device.device_id)

  if (error) {
    logRequestEvent("error", "attendance.heartbeat.update_failed", "heartbeat update failed", logMeta, {
      status: 500,
      details: { code: error.code },
    })
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }

  // Echo back the directives the device should honor right now so it can
  // self-correct between explicit /config polls.
  return NextResponse.json({
    status: "ok",
    mode: device.mode,
    alarm_silenced_until: device.alarm_silenced_until,
    silent_from: device.silent_from,
    silent_to: device.silent_to,
  })
}
