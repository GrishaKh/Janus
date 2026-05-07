"use client"

import { useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, Search, ArrowLeft } from "lucide-react"
import { formatDateTime } from "@/features/attendance/constants"
import type { AuthMethod, DeviceMode } from "@/features/attendance/types"

interface LookupLog {
  id: string
  device_id: string
  auth_method: AuthMethod
  entered_at: string
  session_mode: DeviceMode | null
}

interface LookupResponse {
  student: { full_name: string; student_code: string }
  logs: LookupLog[]
}

export default function LookupPage() {
  const [code, setCode] = useState("")
  const [data, setData] = useState<LookupResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (code.trim().length === 0) return
    setLoading(true)
    setError(null)
    setData(null)
    const response = await fetch(`/api/lookup?code=${encodeURIComponent(code.trim())}`)
    const payload = await response.json().catch(() => null)
    setLoading(false)
    if (!response.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload
          ? String((payload as { error: string }).error)
          : "Lookup failed"
      setError(
        message === "not_found"
          ? "No record found for that code."
          : message === "rate_limited"
            ? "Too many lookups. Try again in a few minutes."
            : message,
      )
      return
    }
    setData(payload as LookupResponse)
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-xl font-semibold text-white">Look up your record</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enter the student code printed on your card to see the last 20 entries Janus has on file.
          </p>

          <form onSubmit={submit} className="mt-5 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Student code</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  required
                  placeholder="ARM-0042"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || code.trim().length === 0}
              className="px-4 py-2 bg-armath-blue hover:bg-armath-blue/80 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Look up
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </div>

        {data && (
          <div className="mt-6 bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800">
              <p className="text-xs text-slate-500">Student</p>
              <p className="text-white font-semibold">{data.student.full_name}</p>
              <p className="text-xs text-slate-500 mt-1 font-mono">{data.student.student_code}</p>
            </div>
            <ul className="divide-y divide-slate-800">
              {data.logs.length === 0 && (
                <li className="px-6 py-8 text-center text-slate-500 text-sm">No entries on record yet.</li>
              )}
              {data.logs.map((log) => (
                <li key={log.id} className="px-6 py-3 flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{formatDateTime(log.entered_at)}</p>
                    <p className="text-xs text-slate-500">
                      {log.auth_method.toUpperCase()} · {log.device_id}
                      {log.session_mode && log.session_mode !== "attendance" ? ` · ${log.session_mode}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}
