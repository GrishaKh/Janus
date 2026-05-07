"use client"

import { useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Loader2, Wifi, WifiOff } from "lucide-react"
import { useAttendanceRealtime, type RealtimeStatus } from "@/features/attendance/hooks/use-attendance-realtime"
import { attendanceApiClient } from "@/features/attendance/lib/attendance-api-client"
import {
  formatDateTime,
  REASON_BADGE,
  REASON_LABEL,
} from "@/features/attendance/constants"
import type { AttendanceBreach, AttendanceLog } from "@/features/attendance/types"

function StatusPill({ status }: { status: RealtimeStatus }) {
  if (status === "subscribed") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-400">
        <Wifi className="w-3 h-3" />
        Live
      </span>
    )
  }
  if (status === "connecting") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-600/40 text-slate-300">
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting
      </span>
    )
  }
  if (status === "disabled") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-700 text-slate-400">
        <WifiOff className="w-3 h-3" />
        Realtime disabled
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400">
      <WifiOff className="w-3 h-3" />
      Disconnected
    </span>
  )
}

export function AttendanceLiveFeed() {
  const [seedLogs, setSeedLogs] = useState<AttendanceLog[]>([])
  const [seedBreaches, setSeedBreaches] = useState<AttendanceBreach[]>([])
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      attendanceApiClient.listLogs({ limit: 25 }),
      attendanceApiClient.listBreaches({ limit: 25 }),
    ]).then(([logsRes, breachesRes]) => {
      if (cancelled) return
      if (logsRes.ok && logsRes.data) setSeedLogs(logsRes.data.logs)
      if (breachesRes.ok && breachesRes.data) setSeedBreaches(breachesRes.data.breaches)
      setSeeded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const { status, recentLogs, recentBreaches } = useAttendanceRealtime({
    initialLogs: seedLogs,
    initialBreaches: seedBreaches,
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-armath-blue" />
            <h2 className="text-white font-semibold">Authorized entries</h2>
          </div>
          <StatusPill status={status} />
        </header>
        <ul className="divide-y divide-slate-700/50 max-h-[480px] overflow-y-auto">
          {!seeded && (
            <li className="px-5 py-8 text-center text-slate-500">
              <Loader2 className="w-5 h-5 mx-auto animate-spin" />
            </li>
          )}
          {seeded && recentLogs.length === 0 && (
            <li className="px-5 py-8 text-center text-slate-500">No entries yet today.</li>
          )}
          {recentLogs.map((log) => (
            <li key={log.id} className="px-5 py-3 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {log.student_id ? `Student ${log.student_id.slice(0, 8)}…` : "Unknown student"}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateTime(log.entered_at)} · {log.auth_method.toUpperCase()} · {log.device_id}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-white font-semibold">Breaches</h2>
          </div>
          <StatusPill status={status} />
        </header>
        <ul className="divide-y divide-slate-700/50 max-h-[480px] overflow-y-auto">
          {!seeded && (
            <li className="px-5 py-8 text-center text-slate-500">
              <Loader2 className="w-5 h-5 mx-auto animate-spin" />
            </li>
          )}
          {seeded && recentBreaches.length === 0 && (
            <li className="px-5 py-8 text-center text-slate-500">No breaches recorded.</li>
          )}
          {recentBreaches.map((breach) => (
            <li key={breach.id} className="px-5 py-3 flex items-center gap-3">
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${REASON_BADGE[breach.reason]}`}>
                {REASON_LABEL[breach.reason]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {breach.attempted_id ? `Attempted: ${breach.attempted_id}` : "No identifier"}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateTime(breach.detected_at)} · {breach.device_id}
                  {breach.acknowledged ? " · Acknowledged" : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
