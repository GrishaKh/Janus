"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, Filter as FilterIcon, Loader2, RefreshCw } from "lucide-react"
import { attendanceApiClient } from "@/features/attendance/lib/attendance-api-client"
import { STATUS_BADGE, formatDateTime } from "@/features/attendance/constants"
import type { AttendanceLedgerRow } from "@/features/attendance/types"

interface FilterState {
  groupCode: string
  from: string
  to: string
}

export function AttendanceLedgerGrid() {
  const [rows, setRows] = useState<AttendanceLedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [filter, setFilter] = useState<FilterState>({ groupCode: "", from: "", to: "" })

  const load = useCallback(async () => {
    setLoading(true)
    const result = await attendanceApiClient.fetchLedger({
      groupCode: filter.groupCode || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
    })
    setLoading(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? "Failed to load ledger")
      return
    }
    setError(null)
    setRows(result.data.rows)
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const exportCsv = async () => {
    setExporting(true)
    const result = await attendanceApiClient.exportLedgerCsv({
      groupCode: filter.groupCode || undefined,
      from: filter.from || undefined,
      to: filter.to || undefined,
    })
    setExporting(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? "Export failed")
      return
    }
    const blob = new Blob([result.data], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `attendance-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Ledger</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Group</label>
            <input
              value={filter.groupCode}
              onChange={(event) => setFilter((prev) => ({ ...prev, groupCode: event.target.value }))}
              placeholder="all"
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">From</label>
            <input
              type="date"
              value={filter.from}
              onChange={(event) => setFilter((prev) => ({ ...prev, from: event.target.value }))}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">To</label>
            <input
              type="date"
              value={filter.to}
              onChange={(event) => setFilter((prev) => ({ ...prev, to: event.target.value }))}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
            />
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition flex items-center gap-1 disabled:opacity-60"
          >
            <FilterIcon className="w-4 h-4" />
            Apply
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white transition"
            aria-label="Refresh ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => void exportCsv()}
            disabled={exporting || rows.length === 0}
            className="px-3 py-2 bg-armath-blue hover:bg-armath-blue/80 text-white rounded-lg transition flex items-center gap-1 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">No ledger rows for the current filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Session</th>
                <th className="px-5 py-3 text-left">Subject</th>
                <th className="px-5 py-3 text-left">Group</th>
                <th className="px-5 py-3 text-left">Student</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Entered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {rows.map((row, index) => (
                <tr key={`${row.session_id}:${row.student_id}:${index}`}>
                  <td className="px-5 py-3 text-slate-300">{formatDateTime(row.scheduled_at)}</td>
                  <td className="px-5 py-3 text-white">{row.subject}</td>
                  <td className="px-5 py-3 text-slate-300">{row.group_code}</td>
                  <td className="px-5 py-3 text-slate-200">{row.full_name}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[row.status]}`}>
                      {row.status[0].toUpperCase() + row.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400">{formatDateTime(row.entered_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
