import { NextRequest, NextResponse } from "next/server"
import { isAdminAuthConfigured, isAdminAuthenticated, getClientIp } from "@/lib/admin-auth"
import { adminApiRateLimiter } from "@/lib/admin-rate-limit"
import { isSupabaseConfigured, supabaseAdmin } from "@/lib/supabase"

/**
 * Common entry gate for /api/admin/attendance/* routes. Returns either a
 * shortcut NextResponse the caller should return immediately, or a context
 * with the validated supabase admin client.
 */
export async function adminAttendanceGate(
  request: NextRequest,
  scope: string,
): Promise<{ ok: true; supabase: NonNullable<typeof supabaseAdmin> } | { ok: false; response: NextResponse }> {
  if (!isAdminAuthConfigured()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin authentication is not configured" }, { status: 503 }),
    }
  }

  const rate = adminApiRateLimiter.check(`attendance:${scope}:${getClientIp(request)}`)
  if (!rate.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      ),
    }
  }

  if (!(await isAdminAuthenticated())) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Database not configured" }, { status: 503 }),
    }
  }

  return { ok: true, supabase: supabaseAdmin }
}
