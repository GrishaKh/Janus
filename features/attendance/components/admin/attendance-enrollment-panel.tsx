"use client"

import { useCallback, useEffect, useState } from "react"
import { Fingerprint, Loader2, RefreshCw, Save, ScanLine, Search, UserCheck } from "lucide-react"
import { attendanceApiClient } from "@/features/attendance/lib/attendance-api-client"

interface EnrollableStudent {
  id: string
  full_name: string
  username: string
  status: string
  rfid_uid: string | null
  fingerprint_id: number | null
  student_code: string | null
}

interface RowEditState {
  rfid_uid: string
  fingerprint_id: string
  student_code: string
  busy: boolean
  error: string | null
  ok: boolean
}

function emptyEdit(): RowEditState {
  return { rfid_uid: "", fingerprint_id: "", student_code: "", busy: false, error: null, ok: false }
}

export function AttendanceEnrollmentPanel() {
  const [students, setStudents] = useState<EnrollableStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [edits, setEdits] = useState<Record<string, RowEditState>>({})

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    const result = await attendanceApiClient.listEnrollableStudents(q)
    setLoading(false)
    if (!result.ok || !result.data) return
    setStudents(result.data.students)
    const initial: Record<string, RowEditState> = {}
    for (const s of result.data.students) {
      initial[s.id] = {
        rfid_uid: s.rfid_uid ?? "",
        fingerprint_id: s.fingerprint_id?.toString() ?? "",
        student_code: s.student_code ?? "",
        busy: false,
        error: null,
        ok: false,
      }
    }
    setEdits(initial)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateEdit = (id: string, patch: Partial<RowEditState>) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  const save = async (student: EnrollableStudent) => {
    const edit = edits[student.id]
    if (!edit) return
    updateEdit(student.id, { busy: true, error: null, ok: false })

    const fingerprintId = edit.fingerprint_id.trim() === ""
      ? null
      : Number.parseInt(edit.fingerprint_id, 10)
    if (fingerprintId !== null && (!Number.isFinite(fingerprintId) || fingerprintId < 1 || fingerprintId > 1000)) {
      updateEdit(student.id, { busy: false, error: "Fingerprint ID must be 1–1000" })
      return
    }

    const result = await attendanceApiClient.enrollStudent({
      student_id: student.id,
      rfid_uid: edit.rfid_uid.trim() === "" ? null : edit.rfid_uid.trim(),
      fingerprint_id: fingerprintId,
      student_code: edit.student_code.trim() === "" ? null : edit.student_code.trim(),
    })

    if (!result.ok || !result.data) {
      updateEdit(student.id, { busy: false, error: result.error ?? "Save failed" })
      return
    }
    updateEdit(student.id, { busy: false, ok: true })
    setStudents((prev) =>
      prev.map((s) =>
        s.id === student.id
          ? {
              ...s,
              rfid_uid: result.data!.student.rfid_uid,
              fingerprint_id: result.data!.student.fingerprint_id,
              student_code: result.data!.student.student_code,
            }
          : s,
      ),
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-armath-blue" />
            Enrollment
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Assign each active student an RFID UID, fingerprint slot (1–1000), and/or student code.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void load(search)
          }}
          className="flex items-end gap-2"
        >
          <div>
            <label className="block text-xs text-slate-400 mb-1">Search by name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm w-64"
                placeholder="Find a student"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => void load(search)}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white transition"
            aria-label="Refresh students"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </form>
      </div>

      <div className="bg-slate-800/40 border border-slate-700 rounded-2xl overflow-hidden">
        {loading && students.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : students.length === 0 ? (
          <p className="text-slate-500 py-8 text-center">No active students.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-5 py-3 text-left">Student</th>
                <th className="px-5 py-3 text-left">
                  <span className="inline-flex items-center gap-1">
                    <ScanLine className="w-3.5 h-3.5" />
                    RFID UID
                  </span>
                </th>
                <th className="px-5 py-3 text-left">
                  <span className="inline-flex items-center gap-1">
                    <Fingerprint className="w-3.5 h-3.5" />
                    FP slot
                  </span>
                </th>
                <th className="px-5 py-3 text-left">Student code</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {students.map((student) => {
                const edit = edits[student.id] ?? emptyEdit()
                return (
                  <tr key={student.id}>
                    <td className="px-5 py-3">
                      <div className="text-white">{student.full_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{student.username}</div>
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={edit.rfid_uid}
                        onChange={(event) => updateEdit(student.id, { rfid_uid: event.target.value, ok: false })}
                        placeholder="04A1B2C3D4E5"
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm font-mono w-44"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={edit.fingerprint_id}
                        onChange={(event) => updateEdit(student.id, { fingerprint_id: event.target.value, ok: false })}
                        placeholder="1–1000"
                        inputMode="numeric"
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm w-24"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={edit.student_code}
                        onChange={(event) => updateEdit(student.id, { student_code: event.target.value, ok: false })}
                        placeholder="ARM-0042"
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-sm w-32"
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {edit.error && <span className="text-xs text-red-400">{edit.error}</span>}
                        {edit.ok && <span className="text-xs text-emerald-400">Saved</span>}
                        <button
                          onClick={() => void save(student)}
                          disabled={edit.busy}
                          className="px-3 py-1.5 text-xs bg-armath-blue hover:bg-armath-blue/80 text-white rounded-lg transition flex items-center gap-1 disabled:opacity-60"
                        >
                          {edit.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Save
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
