import Link from "next/link"
import { Activity, Cpu, Fingerprint, KeyRound, ScanLine, ShieldAlert, ClipboardCheck } from "lucide-react"

const FEATURES = [
  {
    icon: ScanLine,
    title: "RFID + fingerprint entries",
    body: "ESP32 doors POST authorized taps to /api/attendance/events. Logged with device, method, and student.",
  },
  {
    icon: ShieldAlert,
    title: "Breach detection",
    body: "Forced entry, unknown cards, and tamper events become acknowledgeable breach records.",
  },
  {
    icon: Cpu,
    title: "Per-device modes",
    body: "Attendance, silent, exam, maintenance — set from the admin dashboard, echoed on heartbeat.",
  },
  {
    icon: Activity,
    title: "Live admin feed",
    body: "Supabase Realtime pushes new entries and breaches to the dashboard with no polling.",
  },
  {
    icon: KeyRound,
    title: "Bcrypt device tokens",
    body: "Every ESP32 gets a unique bearer token, stored hashed; rotation flow shown-once for safe re-flashing.",
  },
  {
    icon: ClipboardCheck,
    title: "P / L / A ledger",
    body: "Sessions × enrollments × logs derives present/late/absent automatically. CSV export.",
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <p className="text-sm font-medium text-armath-blue uppercase tracking-widest">Armath · Arapi</p>
        <h1 className="mt-3 text-5xl sm:text-6xl font-bold text-white">Janus</h1>
        <p className="mt-4 text-xl text-slate-300">RFID & fingerprint entry control for the Arapi makerspace.</p>
        <p className="mt-6 max-w-2xl mx-auto text-slate-400 text-sm leading-relaxed">
          Janus is the named Roman god of doorways. This standalone build runs the door — ESP32 readers post events,
          the server records authorized entries and breaches, and the admin dashboard manages devices, modes, and the
          attendance ledger in real time.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/admin"
            className="px-5 py-2.5 bg-armath-blue hover:bg-armath-blue/80 text-white rounded-lg transition font-medium"
          >
            Admin dashboard
          </Link>
          <Link
            href="/lookup"
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition font-medium border border-slate-700"
          >
            Look up your record
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-sm"
            >
              <feature.icon className="w-6 h-6 text-armath-blue" />
              <h2 className="mt-3 text-white font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-slate-400 leading-relaxed">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-semibold text-white text-center">ESP32 endpoints</h2>
        <p className="mt-2 text-center text-slate-400 text-sm">All bearer-authenticated as <code className="font-mono text-armath-blue">{"<device_id>.<token>"}</code>.</p>
        <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-mono">
          <li className="px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-emerald-400">POST</span> /api/attendance/events
            <p className="font-sans text-xs text-slate-500 mt-1">RFID/fingerprint tap or breach</p>
          </li>
          <li className="px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-emerald-400">POST</span> /api/attendance/heartbeat
            <p className="font-sans text-xs text-slate-500 mt-1">Liveness + battery, returns mode directives</p>
          </li>
          <li className="px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-armath-blue">GET</span>&nbsp; /api/attendance/config
            <p className="font-sans text-xs text-slate-500 mt-1">Pull mode + enrolled identifier cache</p>
          </li>
          <li className="px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl">
            <span className="text-emerald-400">POST</span> /api/attendance/resync
            <p className="font-sans text-xs text-slate-500 mt-1">Bulk replay after network outage</p>
          </li>
        </ul>
      </section>

      <footer className="text-center text-xs text-slate-500 pb-8">
        <Fingerprint className="inline w-3 h-3 mr-1 text-armath-blue" />
        Janus · Armath Arapi
      </footer>
    </main>
  )
}
