"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"

export function AdminLogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    setBusy(true)
    await fetch("/api/admin/auth", { method: "DELETE" })
    setBusy(false)
    router.refresh()
  }

  return (
    <button
      onClick={() => void logout()}
      disabled={busy}
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition text-sm disabled:opacity-60"
    >
      <LogOut className="w-4 h-4" />
      Log out
    </button>
  )
}
