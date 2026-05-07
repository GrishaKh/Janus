import { z } from "zod"

const adminEnvSchema = z.object({
  ADMIN_PASSWORD: z.string().min(8),
  ADMIN_SESSION_SECRET: z.string().min(16),
})

const deviceEnvSchema = z.object({
  DEVICE_TOKEN_SECRET: z.string().min(32),
})

function readAdminEnv() {
  return {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  }
}

function readDeviceEnv() {
  return {
    DEVICE_TOKEN_SECRET: process.env.DEVICE_TOKEN_SECRET,
  }
}

export function hasAdminEnv(): boolean {
  return adminEnvSchema.safeParse(readAdminEnv()).success
}

export function getAdminEnvOrThrow(): z.infer<typeof adminEnvSchema> {
  const parsed = adminEnvSchema.safeParse(readAdminEnv())
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")
    throw new Error(`Missing or invalid admin environment variables: ${fields}`)
  }
  return parsed.data
}

export function hasDeviceEnv(): boolean {
  return deviceEnvSchema.safeParse(readDeviceEnv()).success
}

export function getDeviceEnvOrThrow(): z.infer<typeof deviceEnvSchema> {
  const parsed = deviceEnvSchema.safeParse(readDeviceEnv())
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")
    throw new Error(`Missing or invalid device environment variables: ${fields}`)
  }
  return parsed.data
}
