import { NextRequest, NextResponse } from "next/server"
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase"
import { WindowRateLimiter } from "@/lib/window-rate-limit"
import { getClientIp } from "@/lib/request-utils"

// Public lookup: anyone can ask "what does Janus have for student_code X?"
// Stricter rate limit than the admin endpoints since there's no auth.
const lookupRateLimiter = new WindowRateLimiter({
  limit: 30,
  windowMs: 5 * 60 * 1000,
})

const MAX_LOGS = 20

export async function GET(request: NextRequest): Promise<NextResponse> {
  const rate = lookupRateLimiter.check(`lookup:${getClientIp(request)}`)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    )
  }

  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "db_unavailable" }, { status: 503 })
  }

  const code = request.nextUrl.searchParams.get("code")?.trim()
  if (!code || code.length === 0 || code.length > 32) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 })
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, full_name, student_code, status")
    .eq("student_code", code)
    .eq("status", "active")
    .maybeSingle()

  if (studentError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
  if (!student) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const { data: logs, error: logsError } = await supabaseAdmin
    .from("attendance_logs")
    .select("id, device_id, auth_method, entered_at, session_mode")
    .eq("student_id", student.id)
    .order("entered_at", { ascending: false })
    .limit(MAX_LOGS)

  if (logsError) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }

  return NextResponse.json({
    student: { full_name: student.full_name, student_code: student.student_code },
    logs: logs ?? [],
  })
}
