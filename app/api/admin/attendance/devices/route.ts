import { NextRequest, NextResponse } from "next/server"
import { adminAttendanceGate } from "@/features/attendance/lib/admin-gate"
import { issueDeviceToken, isValidDeviceId } from "@/features/attendance/lib/device-auth"
import type {
  CreateDeviceRequest,
  CreateDeviceResponse,
  RotateDeviceTokenResponse,
  UpdateDeviceRequest,
} from "@/features/attendance/types"

const VALID_MODES = ["attendance", "silent", "exam", "maintenance"] as const

function stripSecret<T extends { token_hash?: unknown }>(row: T): Omit<T, "token_hash"> {
  const { token_hash: _omit, ...rest } = row
  return rest
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "devices:get")
  if (!gate.ok) return gate.response

  const { data, error } = await gate.supabase
    .from("attendance_devices")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 })
  }
  return NextResponse.json({ devices: (data ?? []).map(stripSecret) })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "devices:post")
  if (!gate.ok) return gate.response

  let body: CreateDeviceRequest
  try {
    body = (await request.json()) as CreateDeviceRequest
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (typeof body.device_id !== "string" || !isValidDeviceId(body.device_id)) {
    return NextResponse.json({ error: "invalid_device_id" }, { status: 400 })
  }
  if (typeof body.display_name !== "string" || body.display_name.trim().length === 0) {
    return NextResponse.json({ error: "display_name_required" }, { status: 400 })
  }
  if (body.mode && !VALID_MODES.includes(body.mode)) {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 })
  }

  const issued = await issueDeviceToken(body.device_id)

  const insert = {
    device_id: issued.deviceId,
    display_name: body.display_name.trim(),
    token_hash: issued.tokenHash,
    mode: body.mode ?? "attendance",
    silent_from: body.silent_from ?? null,
    silent_to: body.silent_to ?? null,
    two_factor: body.two_factor ?? false,
    admin_phones: body.admin_phones ?? [],
  }

  const { data, error } = await gate.supabase
    .from("attendance_devices")
    .insert(insert)
    .select("*")
    .single()
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "device_id_taken" }, { status: 409 })
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 })
  }

  const response: CreateDeviceResponse = {
    device: stripSecret(data),
    bearer: issued.bearer,
  }
  return NextResponse.json(response, { status: 201 })
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "devices:patch")
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get("device_id")
  if (!deviceId || !isValidDeviceId(deviceId)) {
    return NextResponse.json({ error: "invalid_device_id" }, { status: 400 })
  }

  let body: UpdateDeviceRequest & { rotate_token?: boolean }
  try {
    body = (await request.json()) as UpdateDeviceRequest & { rotate_token?: boolean }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  if (body.mode && !VALID_MODES.includes(body.mode)) {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 })
  }

  // Special-case: rotate the bearer token. We re-issue, store new hash, and
  // return the new raw token exactly once (caller flashes it onto the ESP32).
  if (body.rotate_token) {
    const issued = await issueDeviceToken(deviceId)
    const { error } = await gate.supabase
      .from("attendance_devices")
      .update({ token_hash: issued.tokenHash })
      .eq("device_id", deviceId)
    if (error) {
      return NextResponse.json({ error: "rotate_failed" }, { status: 500 })
    }
    const response: RotateDeviceTokenResponse = {
      device_id: deviceId,
      bearer: issued.bearer,
    }
    return NextResponse.json(response)
  }

  const update: Record<string, unknown> = {}
  if (body.display_name !== undefined) update.display_name = body.display_name.trim()
  if (body.mode !== undefined) update.mode = body.mode
  if (body.silent_from !== undefined) update.silent_from = body.silent_from
  if (body.silent_to !== undefined) update.silent_to = body.silent_to
  if (body.two_factor !== undefined) update.two_factor = body.two_factor
  if (body.admin_phones !== undefined) update.admin_phones = body.admin_phones
  if (body.alarm_silenced_until !== undefined) update.alarm_silenced_until = body.alarm_silenced_until

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_updatable_fields" }, { status: 400 })
  }

  const { data, error } = await gate.supabase
    .from("attendance_devices")
    .update(update)
    .eq("device_id", deviceId)
    .select("*")
    .single()
  if (error || !data) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }
  return NextResponse.json({ device: stripSecret(data) })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const gate = await adminAttendanceGate(request, "devices:delete")
  if (!gate.ok) return gate.response

  const { searchParams } = new URL(request.url)
  const deviceId = searchParams.get("device_id")
  if (!deviceId || !isValidDeviceId(deviceId)) {
    return NextResponse.json({ error: "invalid_device_id" }, { status: 400 })
  }

  const { error } = await gate.supabase.from("attendance_devices").delete().eq("device_id", deviceId)
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
