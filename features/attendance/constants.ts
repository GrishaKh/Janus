import type { BreachReason, DeviceMode, LedgerStatus } from "@/features/attendance/types"

export const MODE_LABEL: Record<DeviceMode, string> = {
  attendance: "Attendance",
  silent: "Silent",
  exam: "Exam",
  maintenance: "Maintenance",
}

export const MODE_BADGE: Record<DeviceMode, string> = {
  attendance: "bg-armath-blue/20 text-armath-blue",
  silent: "bg-slate-600/40 text-slate-300",
  exam: "bg-amber-500/20 text-amber-400",
  maintenance: "bg-fuchsia-500/20 text-fuchsia-400",
}

export const REASON_LABEL: Record<BreachReason, string> = {
  no_auth: "No auth",
  rejected_auth: "Rejected auth",
  tamper: "Tamper",
}

export const REASON_BADGE: Record<BreachReason, string> = {
  no_auth: "bg-red-500/20 text-red-400",
  rejected_auth: "bg-orange-500/20 text-orange-400",
  tamper: "bg-fuchsia-500/20 text-fuchsia-400",
}

export const STATUS_BADGE: Record<LedgerStatus, string> = {
  present: "bg-emerald-500/20 text-emerald-400",
  late: "bg-amber-500/20 text-amber-400",
  absent: "bg-red-500/20 text-red-400",
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}
