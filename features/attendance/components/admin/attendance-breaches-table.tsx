"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from "lucide-react"
import { attendanceApiClient } from "@/features/attendance/lib/attendance-api-client"
import { REASON_BADGE, REASON_LABEL, formatDateTime } from "@/features/attendance/constants"
import type { AttendanceBreach } from "@/features/attendance/types"

type Filter = "all" | "unack"

export function AttendanceBreachesTable() {
  const [breaches, setBreaches] = useState<AttendanceBreach[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("unack")
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await attendanceApiClient.listBreaches({
      acknowledged: filter === "unack" ? false : undefined,
      limit: 200,
    })
    setLoading(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? "Failed to load breaches")
      return
    }
    setError(null)
    setBreaches(result.data.breaches)
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const acknowledge = async (id: string) => {
    setBusyIds((prev) => new Set(prev).add(id))
    const result = await attendanceApiClient.acknowledgeBreach(id, "admin")
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    if (!result.ok) {
      setError(result.error ?? "Failed to acknowledge")
      return
    }
    setBreaches((prev) =>
      filter === "unack" ? prev.filter((b) => b.id !== id) : prev.map((b) => (b.id === id ? result.data!.breach : b)),
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          Breaches
        </h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center bg-slate-800/50 border border-slate-700 rounded-xl p-1">
            {(["unack", "all"] as Filter[]).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  filter === key ? "bg-armath-blue text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {key === "unack" ? "Unacknowledged" : "All"}
              </button>
            ))}
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white transition"
            aria-label="Refresh breaches"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        {loading && breaches.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : breaches.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">No breaches match this filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Detected</th>
                <th className="px-5 py-3 text-left">Reason</th>
                <th className="px-5 py-3 text-left">Device</th>
                <th className="px-5 py-3 text-left">Attempted</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {breaches.map((breach) => (
                <tr key={breach.id}>
                  <td className="px-5 py-3 text-slate-200">{formatDateTime(breach.detected_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${REASON_BADGE[breach.reason]}`}>
                      {REASON_LABEL[breach.reason]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300 font-mono text-xs">{breach.device_id}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {breach.attempted_source ? `${breach.attempted_source}: ${breach.attempted_id ?? "—"}` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {breach.acknowledged ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        ACK by {breach.ack_by ?? "?"} · {formatDateTime(breach.ack_at)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-400">Pending</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {!breach.acknowledged && (
                      <button
                        onClick={() => void acknowledge(breach.id)}
                        disabled={busyIds.has(breach.id)}
                        className="px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition flex items-center gap-1 ml-auto disabled:opacity-60"
                      >
                        {busyIds.has(breach.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
