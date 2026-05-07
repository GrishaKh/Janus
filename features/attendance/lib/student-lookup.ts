import { supabaseAdmin } from "@/lib/supabase"
import type { AuthEventInput } from "@/lib/api/attendance-event-core"

export interface StudentLookupResult {
  id: string
}

/**
 * Resolve a student row from whichever identifier the device sent on an auth
 * event. Returns null if no match (the event-core treats null as a stale
 * device cache → rejected_auth breach).
 */
export async function resolveStudentForAuthEvent(
  event: AuthEventInput,
): Promise<StudentLookupResult | null> {
  if (!supabaseAdmin) return null

  if (event.rfid_uid) {
    const { data } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("rfid_uid", event.rfid_uid)
      .eq("status", "active")
      .maybeSingle()
    if (data) return { id: data.id }
  }

  if (event.fingerprint_id != null) {
    const { data } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("fingerprint_id", event.fingerprint_id)
      .eq("status", "active")
      .maybeSingle()
    if (data) return { id: data.id }
  }

  if (event.student_code) {
    const { data } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("student_code", event.student_code)
      .eq("status", "active")
      .maybeSingle()
    if (data) return { id: data.id }
  }

  return null
}
