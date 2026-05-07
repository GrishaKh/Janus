import type { Database } from "@/lib/supabase"

export type AttendanceDevice = Database["public"]["Tables"]["attendance_devices"]["Row"]
export type AttendanceLog = Database["public"]["Tables"]["attendance_logs"]["Row"]
export type AttendanceBreach = Database["public"]["Tables"]["attendance_breaches"]["Row"]
export type AttendanceSession = Database["public"]["Tables"]["attendance_sessions"]["Row"]
export type AttendanceEnrollment = Database["public"]["Tables"]["attendance_enrollments"]["Row"]

export type DeviceMode = AttendanceDevice["mode"]
export type AuthMethod = AttendanceLog["auth_method"]
export type BreachReason = AttendanceBreach["reason"]
export type LedgerStatus = "present" | "late" | "absent"

export interface AttendanceDeviceWithoutSecret extends Omit<AttendanceDevice, "token_hash"> {}

export interface AttendanceLogWithStudent extends AttendanceLog {
  student?: {
    id: string
    full_name: string
    username: string
    student_code: string | null
  } | null
}

export interface AttendanceLedgerRow {
  student_id: string
  full_name: string
  username: string
  student_code: string | null
  session_id: string
  subject: string
  group_code: string
  scheduled_at: string
  status: LedgerStatus
  entered_at: string | null
  auth_method: AuthMethod | null
}

export interface CreateDeviceRequest {
  device_id: string
  display_name: string
  mode?: DeviceMode
  silent_from?: string | null
  silent_to?: string | null
  two_factor?: boolean
  admin_phones?: string[]
}

export interface CreateDeviceResponse {
  device: AttendanceDeviceWithoutSecret
  /** Raw token, displayed once. Format: `<device_id>.<token>`. */
  bearer: string
}

export interface RotateDeviceTokenResponse {
  device_id: string
  bearer: string
}

export interface UpdateDeviceRequest {
  display_name?: string
  mode?: DeviceMode
  silent_from?: string | null
  silent_to?: string | null
  two_factor?: boolean
  admin_phones?: string[]
  alarm_silenced_until?: string | null
}

export interface EnrollStudentRequest {
  student_id: string
  rfid_uid?: string | null
  fingerprint_id?: number | null
  student_code?: string | null
}

export interface AcknowledgeBreachRequest {
  ack_by: string
}
