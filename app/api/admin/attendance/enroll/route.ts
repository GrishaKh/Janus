import { NextRequest, NextResponse } from "next/server"
import { adminAttendanceGate } from "@/features/attendance/lib/admin-gate"
import type { EnrollStudentRequest } from "@/features/attendance/types"

function isValidFingerprintId(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1000
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "enroll:get")
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim()

  let query = gate.supabase
    .from("students")
    .select("id, full_name, username, status, rfid_uid, fingerprint_id, student_code")
    .eq("status", "active")
    .order("full_name", { ascending: true })
    .limit(200)

  if (search && search.length > 0) {
    query = query.ilike("full_name", `%${search}%`)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
  return NextResponse.json({ students: data ?? [] })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "enroll:post")
  if (!gate.ok) return gate.response

  let body: EnrollStudentRequest
  try {
    body = (await request.json()) as EnrollStudentRequest
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (typeof body.student_id !== "string" || body.student_id.length === 0) {
    return NextResponse.json({ error: "student_id_required" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (body.rfid_uid !== undefined) {
    if (body.rfid_uid !== null && (typeof body.rfid_uid !== "string" || body.rfid_uid.length === 0)) {
      return NextResponse.json({ error: "invalid_rfid_uid" }, { status: 400 })
    }
    update.rfid_uid = body.rfid_uid
  }
  if (body.fingerprint_id !== undefined) {
    if (body.fingerprint_id !== null && !isValidFingerprintId(body.fingerprint_id)) {
      return NextResponse.json({ error: "invalid_fingerprint_id" }, { status: 400 })
    }
    update.fingerprint_id = body.fingerprint_id
  }
  if (body.student_code !== undefined) {
    if (body.student_code !== null && (typeof body.student_code !== "string" || body.student_code.length === 0)) {
      return NextResponse.json({ error: "invalid_student_code" }, { status: 400 })
    }
    update.student_code = body.student_code
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_updatable_fields" }, { status: 400 })
  }

  const { data, error } = await gate.supabase
    .from("students")
    .update(update)
    .eq("id", body.student_id)
    .select("id, full_name, username, rfid_uid, fingerprint_id, student_code")
    .single()
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "identifier_taken" }, { status: 409 })
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }
  return NextResponse.json({ student: data })
}
