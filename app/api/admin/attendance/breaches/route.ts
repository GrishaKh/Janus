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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "breaches:get")
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const limit = parseLimit(searchParams.get("limit"))
  const ackParam = searchParams.get("acknowledged")
  const deviceId = searchParams.get("device_id")

  let query = gate.supabase
    .from("attendance_breaches")
    .select("*", { count: "exact" })
    .order("detected_at", { ascending: false })
    .limit(limit)

  if (ackParam === "true") query = query.eq("acknowledged", true)
  else if (ackParam === "false") query = query.eq("acknowledged", false)
  if (deviceId) query = query.eq("device_id", deviceId)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
  return NextResponse.json({ breaches: data ?? [], total: count ?? 0 })
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "breaches:patch")
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 })
  }

  let body: { ack_by?: unknown }
  try {
    body = (await request.json()) as { ack_by?: unknown }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const ackBy = typeof body.ack_by === "string" && body.ack_by.trim().length > 0 ? body.ack_by.trim() : "admin"

  const { data, error } = await gate.supabase
    .from("attendance_breaches")
    .update({
      acknowledged: true,
      ack_by: ackBy,
      ack_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "ack_failed" }, { status: 500 })
  }
  return NextResponse.json({ breach: data })
}
