"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { AttendanceBreach, AttendanceLog } from "@/features/attendance/types"

export type RealtimeStatus = "idle" | "connecting" | "subscribed" | "error" | "disabled"

export interface AttendanceRealtimeFeed {
  status: RealtimeStatus
  recentLogs: AttendanceLog[]
  recentBreaches: AttendanceBreach[]
}

interface Options {
  /** Cap rolling buffer size; older items drop off the back. */
  bufferSize?: number
  /** Initial seed (so the feed isn't empty before any push arrives). */
  initialLogs?: AttendanceLog[]
  initialBreaches?: AttendanceBreach[]
}

/**
 * Subscribes to postgres_changes on attendance_logs and attendance_breaches.
 * Both tables are added to the supabase_realtime publication in the schema.
 * If the anon Supabase client isn't configured, returns "disabled" cleanly.
 */
export function useAttendanceRealtime(options: Options = {}): AttendanceRealtimeFeed {
  const bufferSize = options.bufferSize ?? 50
  const [status, setStatus] = useState<RealtimeStatus>("idle")
  const [recentLogs, setRecentLogs] = useState<AttendanceLog[]>(options.initialLogs ?? [])
  const [recentBreaches, setRecentBreaches] = useState<AttendanceBreach[]>(options.initialBreaches ?? [])

  const logsRef = useRef(recentLogs)
  const breachesRef = useRef(recentBreaches)
  logsRef.current = recentLogs
  breachesRef.current = recentBreaches

  useEffect(() => {
    if (!supabase) {
      setStatus("disabled")
      return
    }

    setStatus("connecting")
    const channel = supabase
      .channel("attendance-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance_logs" },
        (payload) => {
          const row = payload.new as AttendanceLog
          const next = [row, ...logsRef.current].slice(0, bufferSize)
          setRecentLogs(next)
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance_breaches" },
        (payload) => {
          const row = payload.new as AttendanceBreach
          const next = [row, ...breachesRef.current].slice(0, bufferSize)
          setRecentBreaches(next)
        },
      )
      .subscribe((event) => {
        if (event === "SUBSCRIBED") setStatus("subscribed")
        else if (event === "CHANNEL_ERROR" || event === "TIMED_OUT" || event === "CLOSED") setStatus("error")
      })

    return () => {
      void supabase!.removeChannel(channel)
    }
  }, [bufferSize])

  return { status, recentLogs, recentBreaches }
}
