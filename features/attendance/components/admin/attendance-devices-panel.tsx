"use client"

import { useCallback, useEffect, useState } from "react"
import { Battery, Copy, KeyRound, Loader2, Plus, RefreshCw, Trash2, Wifi } from "lucide-react"
import { attendanceApiClient } from "@/features/attendance/lib/attendance-api-client"
import { MODE_BADGE, MODE_LABEL, formatDateTime } from "@/features/attendance/constants"
import type { AttendanceDeviceWithoutSecret, DeviceMode } from "@/features/attendance/types"

const ALL_MODES: DeviceMode[] = ["attendance", "silent", "exam", "maintenance"]

function CopyableSecret({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard might be blocked; user can still select the text */
    }
  }
  return (
    <div className="flex items-stretch gap-2 mt-2">
      <code className="flex-1 px-3 py-2 text-xs text-emerald-300 bg-slate-900/80 border border-slate-700 rounded-lg break-all font-mono">
        {value}
      </code>
      <button
        onClick={onCopy}
        className="px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition flex items-center gap-1"
      >
        <Copy className="w-3.5 h-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only">{label}</span>
    </div>
  )
}

function NewDeviceForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [deviceId, setDeviceId] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [issuedBearer, setIssuedBearer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = await attendanceApiClient.createDevice({
      device_id: deviceId.trim(),
      display_name: displayName.trim(),
    })
    setSubmitting(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? "Failed to create device")
      return
    }
    setIssuedBearer(result.data.bearer)
    setDeviceId("")
    setDisplayName("")
    onCreated()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-armath-blue hover:bg-armath-blue/80 text-white rounded-lg transition"
      >
        <Plus className="w-4 h-4" />
        New device
      </button>
    )
  }

  return (
    <div className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
      <h3 className="text-white font-semibold mb-3">Register a new device</h3>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Device ID (URL-safe, 3–64 chars)</label>
          <input
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
            placeholder="lab-arapi-door-1"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Display name</label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
            placeholder="Main entrance ESP32"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {issuedBearer && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3">
            <p className="text-emerald-300 text-sm font-semibold">Bearer token (shown once — flash it onto the ESP32 NVS now):</p>
            <CopyableSecret value={issuedBearer} label="Device bearer token" />
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-armath-blue hover:bg-armath-blue/80 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create device
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setIssuedBearer(null)
              setError(null)
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </form>
    </div>
  )
}

interface DeviceRowProps {
  device: AttendanceDeviceWithoutSecret
  onChanged: () => void
}

function DeviceRow({ device, onChanged }: DeviceRowProps) {
  const [rotated, setRotated] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setMode = async (mode: DeviceMode) => {
    setBusy(true)
    setError(null)
    const result = await attendanceApiClient.updateDevice(device.device_id, { mode })
    setBusy(false)
    if (!result.ok) setError(result.error ?? "Failed to update mode")
    else onChanged()
  }

  const rotateToken = async () => {
    if (!confirm(`Rotate token for ${device.device_id}? The current ESP32 will be locked out until reflashed.`)) return
    setBusy(true)
    const result = await attendanceApiClient.rotateDeviceToken(device.device_id)
    setBusy(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? "Failed to rotate token")
      return
    }
    setRotated(result.data.bearer)
    onChanged()
  }

  const remove = async () => {
    if (!confirm(`Permanently delete ${device.device_id}? This also drops its log and breach history.`)) return
    setBusy(true)
    const result = await attendanceApiClient.deleteDevice(device.device_id)
    setBusy(false)
    if (!result.ok) setError(result.error ?? "Failed to delete")
    else onChanged()
  }

  const silenceFor = async (minutes: number) => {
    const until = new Date(Date.now() + minutes * 60_000).toISOString()
    setBusy(true)
    const result = await attendanceApiClient.updateDevice(device.device_id, { alarm_silenced_until: until })
    setBusy(false)
    if (!result.ok) setError(result.error ?? "Failed to silence")
    else onChanged()
  }

  return (
    <article className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">{device.display_name}</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${MODE_BADGE[device.mode]}`}>
              {MODE_LABEL[device.mode]}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">{device.device_id}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Wifi className="w-3.5 h-3.5" />
            {device.last_seen_at ? formatDateTime(device.last_seen_at) : "Never"}
          </span>
          {device.last_battery_percent != null && (
            <span className="flex items-center gap-1">
              <Battery className="w-3.5 h-3.5" />
              {device.last_battery_percent}%
            </span>
          )}
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {ALL_MODES.map((mode) => (
          <button
            key={mode}
            disabled={busy || device.mode === mode}
            onClick={() => void setMode(mode)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              device.mode === mode
                ? "bg-armath-blue text-white cursor-default"
                : "bg-slate-700 hover:bg-slate-600 text-slate-200"
            } disabled:opacity-60`}
          >
            {MODE_LABEL[mode]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={busy}
          onClick={() => void silenceFor(5)}
          className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition"
        >
          Silence alarm 5 min
        </button>
        <button
          disabled={busy}
          onClick={() => void silenceFor(30)}
          className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg transition"
        >
          Silence 30 min
        </button>
        <button
          disabled={busy}
          onClick={() => void rotateToken()}
          className="ml-auto px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition flex items-center gap-1"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Rotate token
        </button>
        <button
          disabled={busy}
          onClick={() => void remove()}
          className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition flex items-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {rotated && (
        <div className="mt-3 bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3">
          <p className="text-emerald-300 text-sm font-semibold">New bearer token (shown once):</p>
          <CopyableSecret value={rotated} label="New bearer token" />
        </div>
      )}
    </article>
  )
}

export function AttendanceDevicesPanel() {
  const [devices, setDevices] = useState<AttendanceDeviceWithoutSecret[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await attendanceApiClient.listDevices()
    setLoading(false)
    if (!result.ok || !result.data) {
      setError(result.error ?? "Failed to load devices")
      return
    }
    setError(null)
    setDevices(result.data.devices)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Devices</h2>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white transition"
            aria-label="Refresh devices"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <NewDeviceForm onCreated={() => void load()} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && devices.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <p className="text-slate-500 py-8 text-center">No devices registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {devices.map((d) => (
            <DeviceRow key={d.device_id} device={d} onChanged={() => void load()} />
          ))}
        </div>
      )}
    </div>
  )
}
