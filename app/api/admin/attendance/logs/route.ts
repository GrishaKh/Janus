import { NextRequest, NextResponse } from "next/server"
import { adminAttendanceGate } from "@/features/attendance/lib/admin-gate"

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT
  return Math.min(n, MAX_LIMIT)
}

function isIso(value: string | null): value is string {
  if (!value) return false
  return Number.isFinite(Date.parse(value))
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "logs:get")
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const studentId = searchParams.get("student_id")
  const deviceId = searchParams.get("device_id")
  const limit = parseLimit(searchParams.get("limit"))

  let query = gate.supabase
    .from("attendance_logs")
    .select("*, student:students(id, full_name, username, student_code)", { count: "exact" })
    .order("entered_at", { ascending: false })
    .limit(limit)

  if (isIso(from)) query = query.gte("entered_at", from)
  if (isIso(to)) query = query.lte("entered_at", to)
  if (studentId) query = query.eq("student_id", studentId)
  if (deviceId) query = query.eq("device_id", deviceId)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
  return NextResponse.json({ logs: data ?? [], total: count ?? 0 })
}
