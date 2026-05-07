import { randomBytes } from "crypto"
import bcrypt from "bcryptjs"

const BCRYPT_ROUNDS = 12
const TOKEN_BYTES = 32
const DEVICE_ID_PATTERN = /^[a-z0-9][a-z0-9\-_]{2,63}$/i

export interface IssuedDeviceToken {
  deviceId: string
  rawToken: string
  tokenHash: string
  bearer: string
}

export function isValidDeviceId(candidate: string): boolean {
  return DEVICE_ID_PATTERN.test(candidate)
}

export async function issueDeviceToken(deviceId: string): Promise<IssuedDeviceToken> {
  if (!isValidDeviceId(deviceId)) {
    throw new Error("Invalid device_id: must be 3–64 chars, alphanumeric/dash/underscore")
  }
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url")
  const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS)
  return {
    deviceId,
    rawToken,
    tokenHash,
    bearer: `${deviceId}.${rawToken}`,
  }
}

export async function hashDeviceToken(rawToken: string): Promise<string> {
  return bcrypt.hash(rawToken, BCRYPT_ROUNDS)
}

export async function verifyDeviceToken(rawToken: string, hash: string): Promise<boolean> {
  return bcrypt.compare(rawToken, hash)
}

export function parseDeviceBearer(header: string | null): { deviceId: string; rawToken: string } | null {
  if (!header) return null
  const trimmed = header.trim()
  const match = /^Bearer\s+(.+)$/i.exec(trimmed)
  if (!match) return null
  const payload = match[1].trim()
  const dot = payload.indexOf(".")
  if (dot <= 0 || dot === payload.length - 1) return null
  const deviceId = payload.slice(0, dot)
  const rawToken = payload.slice(dot + 1)
  if (!isValidDeviceId(deviceId)) return null
  if (rawToken.length < 16) return null
  return { deviceId, rawToken }
}
