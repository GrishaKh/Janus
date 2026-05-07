import { createClient, SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase credentials not configured. Database features disabled.")
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

function createSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseUrl) return null
  if (supabaseServiceKey) return createClient(supabaseUrl, supabaseServiceKey)
  return createSupabaseClient()
}

export const supabase = createSupabaseClient()
export const supabaseAdmin = createSupabaseAdminClient()
export const isSupabaseConfigured = () => !!supabase

// Slim Database schema — only the tables the Janus app touches. The students
// table is intentionally minimal here; in the main repo it has extra columns
// (password_hash, age, etc.) that Janus does not need.
export type Database = {
  public: {
    Tables: {
      students: {
        Row: {
          id: string
          username: string
          full_name: string
          status: string
          rfid_uid: string | null
          fingerprint_id: number | null
          student_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["students"]["Row"], "id" | "created_at" | "updated_at" | "rfid_uid" | "fingerprint_id" | "student_code" | "status"> & {
          status?: string
          rfid_uid?: string | null
          fingerprint_id?: number | null
          student_code?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>
      }
      attendance_devices: {
        Row: {
          device_id: string
          display_name: string
          token_hash: string
          last_seen_at: string | null
          last_battery_percent: number | null
          mode: "attendance" | "silent" | "exam" | "maintenance"
          silent_from: string | null
          silent_to: string | null
          two_factor: boolean
          alarm_silenced_until: string | null
          admin_phones: string[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["attendance_devices"]["Row"], "created_at" | "updated_at" | "mode" | "two_factor" | "admin_phones" | "last_seen_at" | "last_battery_percent" | "silent_from" | "silent_to" | "alarm_silenced_until"> & {
          mode?: "attendance" | "silent" | "exam" | "maintenance"
          two_factor?: boolean
          admin_phones?: string[]
          last_seen_at?: string | null
          last_battery_percent?: number | null
          silent_from?: string | null
          silent_to?: string | null
          alarm_silenced_until?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["attendance_devices"]["Insert"]>
      }
      attendance_sessions: {
        Row: {
          id: string
          subject: string
          group_code: string
          scheduled_at: string
          duration_min: number
          grace_min: number
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["attendance_sessions"]["Row"], "id" | "created_at" | "duration_min" | "grace_min"> & {
          duration_min?: number
          grace_min?: number
        }
        Update: Partial<Database["public"]["Tables"]["attendance_sessions"]["Insert"]>
      }
      attendance_enrollments: {
        Row: {
          student_id: string
          group_code: string
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["attendance_enrollments"]["Row"], "created_at">
        Update: Partial<Database["public"]["Tables"]["attendance_enrollments"]["Insert"]>
      }
      attendance_logs: {
        Row: {
          id: string
          student_id: string | null
          device_id: string
          auth_method: "rfid" | "fingerprint" | "2fa"
          entered_at: string
          session_id: string | null
          session_mode: "attendance" | "silent" | "exam" | "maintenance" | null
          event_id: string | null
          raw_identifier: string | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["attendance_logs"]["Row"], "id" | "created_at" | "student_id" | "session_id" | "session_mode" | "event_id" | "raw_identifier"> & {
          student_id?: string | null
          session_id?: string | null
          session_mode?: "attendance" | "silent" | "exam" | "maintenance" | null
          event_id?: string | null
          raw_identifier?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["attendance_logs"]["Insert"]>
      }
      attendance_breaches: {
        Row: {
          id: string
          device_id: string
          detected_at: string
          reason: "no_auth" | "rejected_auth" | "tamper"
          attempted_source: "rfid" | "fingerprint" | null
          attempted_id: string | null
          mode: "attendance" | "silent" | "exam" | "maintenance" | null
          event_id: string | null
          acknowledged: boolean
          ack_by: string | null
          ack_at: string | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["attendance_breaches"]["Row"], "id" | "created_at" | "acknowledged" | "ack_by" | "ack_at" | "attempted_source" | "attempted_id" | "mode" | "event_id"> & {
          acknowledged?: boolean
          ack_by?: string | null
          ack_at?: string | null
          attempted_source?: "rfid" | "fingerprint" | null
          attempted_id?: string | null
          mode?: "attendance" | "silent" | "exam" | "maintenance" | null
          event_id?: string | null
        }
        Update: Partial<Database["public"]["Tables"]["attendance_breaches"]["Insert"]>
      }
    }
  }
}
