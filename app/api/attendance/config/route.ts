import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { authenticateDeviceRequest } from "@/features/attendance/lib/device-auth"
import { deviceConfigRateLimiter } from "@/features/attendance/lib/device-rate-limit"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateDeviceRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }
  const device = auth.device

  const rate = deviceConfigRateLimiter.check(`config:${device.device_id}`)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    )
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 })
  }

  const { data: students, error } = await supabaseAdmin
    .from("students")
    .select("id, rfid_uid, fingerprint_id, student_code")
    .eq("status", "active")

  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }

  const enrolledRfid: string[] = []
  const enrolledFingerprints: number[] = []
  const enrolledCodes: string[] = []
  for (const s of students ?? []) {
    if (s.rfid_uid) enrolledRfid.push(s.rfid_uid)
    if (typeof s.fingerprint_id === "number") enrolledFingerprints.push(s.fingerprint_id)
    if (s.student_code) enrolledCodes.push(s.student_code)
  }

  return NextResponse.json({
    device_id: device.device_id,
    display_name: device.display_name,
    mode: device.mode,
    silent_from: device.silent_from,
    silent_to: device.silent_to,
    two_factor: device.two_factor,
    alarm_silenced_until: device.alarm_silenced_until,
    admin_phones: device.admin_phones,
    enrolled: {
      rfid_uids: enrolledRfid,
      fingerprint_ids: enrolledFingerprints,
      student_codes: enrolledCodes,
      count: students?.length ?? 0,
    },
    server_time: new Date().toISOString(),
  })
}
