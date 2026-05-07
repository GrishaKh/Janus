"use client"

import { useState } from "react"
import { Activity, ClipboardCheck, Cpu, ShieldAlert, UserCheck } from "lucide-react"
import { AttendanceLiveFeed } from "@/features/attendance/components/admin/attendance-live-feed"
import { AttendanceDevicesPanel } from "@/features/attendance/components/admin/attendance-devices-panel"
import { AttendanceBreachesTable } from "@/features/attendance/components/admin/attendance-breaches-table"
import { AttendanceLedgerGrid } from "@/features/attendance/components/admin/attendance-ledger-grid"
import { AttendanceEnrollmentPanel } from "@/features/attendance/components/admin/attendance-enrollment-panel"

type SubTab = "live" | "devices" | "ledger" | "breaches" | "enrollment"

const TABS: { key: SubTab; label: string; icon: typeof Activity }[] = [
  { key: "live", label: "Live", icon: Activity },
  { key: "devices", label: "Devices", icon: Cpu },
  { key: "ledger", label: "Ledger", icon: ClipboardCheck },
  { key: "breaches", label: "Breaches", icon: ShieldAlert },
  { key: "enrollment", label: "Enrollment", icon: UserCheck },
]

export function AttendanceView() {
  const [tab, setTab] = useState<SubTab>("live")

  return (
    <div className="space-y-6">
      <nav className="inline-flex items-center bg-slate-800/50 border border-slate-700 rounded-xl p-1 overflow-x-auto">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              tab === entry.key
                ? "bg-armath-blue text-white shadow-lg shadow-armath-blue/25"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <entry.icon className="w-4 h-4" />
            <span>{entry.label}</span>
          </button>
        ))}
      </nav>

      {tab === "live" && <AttendanceLiveFeed />}
      {tab === "devices" && <AttendanceDevicesPanel />}
      {tab === "ledger" && <AttendanceLedgerGrid />}
      {tab === "breaches" && <AttendanceBreachesTable />}
      {tab === "enrollment" && <AttendanceEnrollmentPanel />}
    </div>
  )
}
