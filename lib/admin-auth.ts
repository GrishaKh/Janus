import { cookies } from "next/headers"
import { createHmac, randomBytes, timingSafeEqual } from "crypto"
import { getAdminEnvOrThrow, hasAdminEnv } from "@/lib/env"

export { getClientIp } from "@/lib/request-utils"

const ADMIN_SESSION_COOKIE = "admin_session"
const SESSION_VERSION = "v1"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12 // 12 hours

interface SessionPayload {
  iat: number
  exp: number
  nonce: string
}

function sign(payloadBase64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url")
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8")
  const bBuf = Buffer.from(b, "utf8")
  if (aBuf.length !== bBuf.length) {
    return false
  }
  const aView = new Uint8Array(aBuf)
  const bView = new Uint8Array(bBuf)
  return timingSafeEqual(aView, bView)
}

export function verifyAdminPassword(inputPassword: string): boolean {
  const { ADMIN_PASSWORD } = getAdminEnvOrThrow()
  return safeCompare(inputPassword, ADMIN_PASSWORD)
}

export function createAdminSessionToken(): string {
  const { ADMIN_SESSION_SECRET } = getAdminEnvOrThrow()
  const nowSeconds = Math.floor(Date.now() / 1000)
  const payload: SessionPayload = {
    iat: nowSeconds,
    exp: nowSeconds + SESSION_MAX_AGE_SECONDS,
    nonce: randomBytes(16).toString("hex"),
  }

  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
  const signature = sign(payloadBase64, ADMIN_SESSION_SECRET)
  return `${SESSION_VERSION}.${payloadBase64}.${signature}`
}

export function verifyAdminSessionToken(token: string): boolean {
  if (!token) return false

  const { ADMIN_SESSION_SECRET } = getAdminEnvOrThrow()
  const [version, payloadBase64, signature] = token.split(".")

  if (!version || !payloadBase64 || !signature || version !== SESSION_VERSION) {
    return false
  }

  const expectedSignature = sign(payloadBase64, ADMIN_SESSION_SECRET)
  if (!safeCompare(signature, expectedSignature)) {
    return false
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8")) as SessionPayload
    if (!payload.exp || !payload.iat) return false

    const nowSeconds = Math.floor(Date.now() / 1000)
    if (payload.exp <= nowSeconds) return false
    if (payload.iat > nowSeconds + 60) return false
    return true
  } catch {
    return false
  }
}

export function isAdminAuthConfigured(): boolean {
  return hasAdminEnv()
}

export async function isAdminAuthenticated(): Promise<boolean> {
  if (!hasAdminEnv()) return false
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
    if (!token) return false
    return verifyAdminSessionToken(token)
  } catch {
    return false
  }
}

export function getAdminSessionCookieName(): string {
  return ADMIN_SESSION_COOKIE
}

export function getAdminSessionMaxAgeSeconds(): number {
  return SESSION_MAX_AGE_SECONDS
}
