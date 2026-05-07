"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LogIn } from "lucide-react"

export function AdminLoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const response = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    setSubmitting(false)
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string"
          ? (payload as { error: string }).error
          : "Sign-in failed"
      setError(message)
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="block text-xs text-slate-400 mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          required
          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting || password.length === 0}
        className="w-full px-4 py-2 bg-armath-blue hover:bg-armath-blue/80 text-white rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
        Sign in
      </button>
    </form>
  )
}
