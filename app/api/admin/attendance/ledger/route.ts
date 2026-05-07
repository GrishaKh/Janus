import { NextRequest, NextResponse } from "next/server"
import { adminAttendanceGate } from "@/features/attendance/lib/admin-gate"
import type { AttendanceLedgerRow } from "@/features/attendance/types"

const CSV_HEADERS = [
  "session_id",
  "scheduled_at",
  "subject",
  "group_code",
  "student_id",
  "full_name",
  "username",
  "student_code",
  "status",
  "entered_at",
  "auth_method",
] as const

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function rowsToCsv(rows: AttendanceLedgerRow[]): string {
  const lines = [CSV_HEADERS.join(",")]
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((h) => escapeCsv((row as unknown as Record<string, unknown>)[h])).join(","))
  }
  return lines.join("\n")
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "ledger:get")
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const groupCode = searchParams.get("group_code")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const format = searchParams.get("format") // "csv" | null
  const studentId = searchParams.get("student_id")

  let query = gate.supabase
    .from("attendance_ledger")
    .select("*")
    .order("scheduled_at", { ascending: false })
    .limit(2000)

  if (groupCode) query = query.eq("group_code", groupCode)
  if (studentId) query = query.eq("student_id", studentId)
  if (from && Number.isFinite(Date.parse(from))) query = query.gte("scheduled_at", from)
  if (to && Number.isFinite(Date.parse(to))) query = query.lte("scheduled_at", to)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
  const rows = (data ?? []) as AttendanceLedgerRow[]

  if (format === "csv") {
    const csv = rowsToCsv(rows)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-ledger-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  return NextResponse.json({ rows })
}
