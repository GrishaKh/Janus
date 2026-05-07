import { timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import type { Database } from "@/lib/supabase"
import {
  isValidDeviceId,
  issueDeviceToken,
  hashDeviceToken,
  verifyDeviceToken,
  parseDeviceBearer,
  type IssuedDeviceToken,
} from "@/features/attendance/lib/device-token"

export {
  isValidDeviceId,
  issueDeviceToken,
  hashDeviceToken,
  verifyDeviceToken,
  parseDeviceBearer,
  type IssuedDeviceToken,
}

export type AttendanceDevice = Database["public"]["Tables"]["attendance_devices"]["Row"]

export interface DeviceAuthSuccess {
  ok: true
  device: AttendanceDevice
}

export interface DeviceAuthFailure {
  ok: false
  reason: "missing_header" | "malformed_header" | "unknown_device" | "invalid_token" | "db_unavailable"
  status: number
}

export type DeviceAuthResult = DeviceAuthSuccess | DeviceAuthFailure

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8")
  const bBuf = Buffer.from(b, "utf8")
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(new Uint8Array(aBuf), new Uint8Array(bBuf))
}

export async function authenticateDeviceRequest(request: NextRequest | Request): Promise<DeviceAuthResult> {
  const header = request.headers.get("authorization")
  const parsed = parseDeviceBearer(header)
  if (!header) return { ok: false, reason: "missing_header", status: 401 }
  if (!parsed) return { ok: false, reason: "malformed_header", status: 401 }

  if (!supabaseAdmin) return { ok: false, reason: "db_unavailable", status: 503 }

  const { data, error } = await supabaseAdmin
    .from("attendance_devices")
    .select("*")
    .eq("device_id", parsed.deviceId)
    .maybeSingle()

  if (error || !data) return { ok: false, reason: "unknown_device", status: 401 }

  const device = data as AttendanceDevice
  const valid = await verifyDeviceToken(parsed.rawToken, device.token_hash)
  if (!valid) return { ok: false, reason: "invalid_token", status: 401 }

  if (!constantTimeEqual(parsed.deviceId, device.device_id)) {
    return { ok: false, reason: "invalid_token", status: 401 }
  }

  return { ok: true, device }
}
