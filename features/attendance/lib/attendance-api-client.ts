import type {
  AttendanceBreach,
  AttendanceDeviceWithoutSecret,
  AttendanceLedgerRow,
  AttendanceLogWithStudent,
  CreateDeviceRequest,
  CreateDeviceResponse,
  EnrollStudentRequest,
  RotateDeviceTokenResponse,
  UpdateDeviceRequest,
} from "@/features/attendance/types"

interface ApiResult<T> {
  ok: boolean
  status: number
  data: T | null
  error: string | null
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback
  const record = payload as Record<string, unknown>
  const fromError = typeof record.error === "string" ? record.error : null
  const fromMessage = typeof record.message === "string" ? record.message : null
  return fromError || fromMessage || fallback
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const response = await fetch(input, init)
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: getErrorMessage(payload, "Request failed"),
      }
    }
    return { ok: true, status: response.status, data: payload as T, error: null }
  } catch {
    return { ok: false, status: 0, data: null, error: "Network request failed" }
  }
}

async function requestText(input: string, init?: RequestInit): Promise<ApiResult<string>> {
  try {
    const response = await fetch(input, init)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      return {
        ok: false,
        status: response.status,
        data: null,
        error: getErrorMessage(payload, "Request failed"),
      }
    }
    return { ok: true, status: response.status, data: await response.text(), error: null }
  } catch {
    return { ok: false, status: 0, data: null, error: "Network request failed" }
  }
}

interface LogQuery {
  from?: string
  to?: string
  studentId?: string
  deviceId?: string
  limit?: number
}

interface BreachQuery {
  acknowledged?: boolean
  deviceId?: string
  limit?: number
}

interface LedgerQuery {
  groupCode?: string
  studentId?: string
  from?: string
  to?: string
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ""
}

export const attendanceApiClient = {
  // --- devices ---
  listDevices: () =>
    requestJson<{ devices: AttendanceDeviceWithoutSecret[] }>("/api/admin/attendance/devices"),
  createDevice: (body: CreateDeviceRequest) =>
    requestJson<CreateDeviceResponse>("/api/admin/attendance/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateDevice: (deviceId: string, body: UpdateDeviceRequest) =>
    requestJson<{ device: AttendanceDeviceWithoutSecret }>(
      `/api/admin/attendance/devices?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
  rotateDeviceToken: (deviceId: string) =>
    requestJson<RotateDeviceTokenResponse>(
      `/api/admin/attendance/devices?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate_token: true }),
      },
    ),
  deleteDevice: (deviceId: string) =>
    requestJson<{ success: boolean }>(
      `/api/admin/attendance/devices?device_id=${encodeURIComponent(deviceId)}`,
      { method: "DELETE" },
    ),

  // --- logs ---
  listLogs: (query: LogQuery = {}) =>
    requestJson<{ logs: AttendanceLogWithStudent[]; total: number }>(
      `/api/admin/attendance/logs${toQueryString({
        from: query.from,
        to: query.to,
        student_id: query.studentId,
        device_id: query.deviceId,
        limit: query.limit,
      })}`,
    ),

  // --- breaches ---
  listBreaches: (query: BreachQuery = {}) =>
    requestJson<{ breaches: AttendanceBreach[]; total: number }>(
      `/api/admin/attendance/breaches${toQueryString({
        acknowledged:
          query.acknowledged === undefined ? undefined : query.acknowledged ? "true" : "false",
        device_id: query.deviceId,
        limit: query.limit,
      })}`,
    ),
  acknowledgeBreach: (id: string, ackBy: string) =>
    requestJson<{ breach: AttendanceBreach }>(
      `/api/admin/attendance/breaches?id=${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ack_by: ackBy }),
      },
    ),

  // --- ledger ---
  fetchLedger: (query: LedgerQuery = {}) =>
    requestJson<{ rows: AttendanceLedgerRow[] }>(
      `/api/admin/attendance/ledger${toQueryString({
        group_code: query.groupCode,
        student_id: query.studentId,
        from: query.from,
        to: query.to,
      })}`,
    ),
  exportLedgerCsv: (query: LedgerQuery = {}) =>
    requestText(
      `/api/admin/attendance/ledger${toQueryString({
        group_code: query.groupCode,
        student_id: query.studentId,
        from: query.from,
        to: query.to,
        format: "csv",
      })}`,
    ),

  // --- enrollment ---
  listEnrollableStudents: (search?: string) =>
    requestJson<{
      students: {
        id: string
        full_name: string
        username: string
        status: string
        rfid_uid: string | null
        fingerprint_id: number | null
        student_code: string | null
      }[]
    }>(
      `/api/admin/attendance/enroll${
        search && search.length > 0 ? `?search=${encodeURIComponent(search)}` : ""
      }`,
    ),
  enrollStudent: (body: EnrollStudentRequest) =>
    requestJson<{ student: { id: string; full_name: string; rfid_uid: string | null; fingerprint_id: number | null; student_code: string | null } }>(
      "/api/admin/attendance/enroll",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
}
