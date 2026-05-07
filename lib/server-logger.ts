import type { NextRequest } from "next/server"

type LogLevel = "info" | "warn" | "error"

interface LogPayload {
  level: LogLevel
  event: string
  message: string
  requestId?: string
  route?: string
  method?: string
  ip?: string
  status?: number
  details?: Record<string, unknown>
  error?: {
    name: string
    message: string
  }
}

export interface RequestLogMeta {
  requestId: string
  route: string
  method: string
  ip: string
}

function randomRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createRequestLogMeta(request: NextRequest, route: string): RequestLogMeta {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const firstForwardedIp = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null
  const ip =
    firstForwardedIp ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"

  return {
    requestId: request.headers.get("x-request-id") || randomRequestId(),
    route,
    method: request.method,
    ip,
  }
}

function writeLog(payload: LogPayload) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...payload })
  if (payload.level === "error") {
    console.error(line)
    return
  }
  if (payload.level === "warn") {
    console.warn(line)
    return
  }
  console.info(line)
}

function normalizeError(error: unknown): LogPayload["error"] | undefined {
  if (!(error instanceof Error)) return undefined
  return { name: error.name, message: error.message }
}

export function logRequestEvent(
  level: LogLevel,
  event: string,
  message: string,
  meta: RequestLogMeta,
  options?: {
    status?: number
    details?: Record<string, unknown>
    error?: unknown
  },
) {
  writeLog({
    level,
    event,
    message,
    requestId: meta.requestId,
    route: meta.route,
    method: meta.method,
    ip: meta.ip,
    status: options?.status,
    details: options?.details,
    error: normalizeError(options?.error),
  })
}
