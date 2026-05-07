import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  createAdminSessionToken,
  getAdminSessionCookieName,
  getAdminSessionMaxAgeSeconds,
  getClientIp,
  isAdminAuthConfigured,
  isAdminAuthenticated,
  verifyAdminPassword,
} from "@/lib/admin-auth"
import { adminLoginRateLimiter } from "@/lib/admin-rate-limit"
import { createRequestLogMeta, logRequestEvent } from "@/lib/server-logger"

export async function POST(request: NextRequest): Promise<NextResponse> {
  const logMeta = createRequestLogMeta(request, "/api/admin/auth")

  try {
    if (!isAdminAuthConfigured()) {
      logRequestEvent("error", "admin.auth.unconfigured", "Admin auth attempted while not configured", logMeta, {
        status: 503,
      })
      return NextResponse.json({ error: "Admin authentication is not configured" }, { status: 503 })
    }

    const rateCheck = adminLoginRateLimiter.check(`login:${getClientIp(request)}`)
    if (!rateCheck.allowed) {
      logRequestEvent("warn", "admin.auth.rate_limited", "Admin login rate limit exceeded", logMeta, {
        status: 429,
      })
      return NextResponse.json(
        { error: "Too many login attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateCheck.retryAfterSeconds) } },
      )
    }

    const body = await request.json().catch(() => null)
    const password = typeof (body as { password?: unknown })?.password === "string" ? (body as { password: string }).password : ""
    if (!verifyAdminPassword(password)) {
      logRequestEvent("warn", "admin.auth.invalid_password", "Admin login failed due to invalid password", logMeta, {
        status: 401,
      })
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    const token = createAdminSessionToken()
    const cookieStore = await cookies()
    cookieStore.set(getAdminSessionCookieName(), token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: getAdminSessionMaxAgeSeconds(),
      path: "/",
    })

    logRequestEvent("info", "admin.auth.login_success", "Admin login succeeded", logMeta, { status: 200 })
    return NextResponse.json({ success: true })
  } catch (error) {
    logRequestEvent("error", "admin.auth.unexpected_error", "Unexpected admin auth error", logMeta, {
      status: 500,
      error,
    })
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const logMeta = createRequestLogMeta(request, "/api/admin/auth")
  const cookieStore = await cookies()
  cookieStore.delete(getAdminSessionCookieName())
  logRequestEvent("info", "admin.auth.logout", "Admin logout completed", logMeta, { status: 200 })
  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const logMeta = createRequestLogMeta(request, "/api/admin/auth")
  const authenticated = await isAdminAuthenticated()
  logRequestEvent("info", "admin.auth.check", "Admin auth status checked", logMeta, {
    status: 200,
    details: { authenticated },
  })
  return NextResponse.json({ authenticated })
}
