import { isAdminAuthConfigured, isAdminAuthenticated } from "@/lib/admin-auth"
import { AttendanceView } from "@/features/attendance/components/admin/attendance-view"
import { AdminLoginForm } from "@/app/admin/login-form"
import { AdminLogoutButton } from "@/app/admin/logout-button"
import { Cpu } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const configured = isAdminAuthConfigured()
  const authed = configured ? await isAdminAuthenticated() : false

  if (!configured) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Admin auth not configured</h1>
          <p className="mt-2 text-sm text-slate-400">
            Set <code className="font-mono text-armath-blue">ADMIN_PASSWORD</code> and{" "}
            <code className="font-mono text-armath-blue">ADMIN_SESSION_SECRET</code> in{" "}
            <code className="font-mono text-armath-blue">.env.local</code>, then restart the dev server.
          </p>
        </div>
      </main>
    )
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
          <h1 className="text-xl font-semibold text-white text-center">Janus admin</h1>
          <p className="mt-1 text-xs text-slate-500 text-center">Sign in to manage devices and attendance.</p>
          <div className="mt-6">
            <AdminLoginForm />
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen">
      <header className="bg-slate-900/60 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-armath-blue to-armath-red rounded-xl flex items-center justify-center">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Janus admin</h1>
                <p className="text-xs text-slate-500">Entry control · Armath Arapi</p>
              </div>
            </div>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AttendanceView />
      </div>
    </main>
  )
}
