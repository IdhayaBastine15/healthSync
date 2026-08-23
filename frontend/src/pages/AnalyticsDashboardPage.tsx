import { useEffect, useState } from 'react'
import {
  getCriticalAlerts,
  getDashboard,
  getLabTurnaround,
  getPatientVolume,
  getSystemHealth,
} from '../services/analytics'
import { extractErrorMessage } from '../services/api'
import type {
  CriticalAlertsReportOut,
  DashboardOut,
  LabTurnaroundReportOut,
  PatientVolumeDay,
  SystemHealthOut,
} from '../types/analytics'

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

function isoDateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function todayPlusOne(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'critical' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === 'critical' ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

export function AnalyticsDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardOut | null>(null)
  const [volume, setVolume] = useState<PatientVolumeDay[]>([])
  const [turnaround, setTurnaround] = useState<LabTurnaroundReportOut | null>(null)
  const [critical, setCritical] = useState<CriticalAlertsReportOut | null>(null)
  const [health, setHealth] = useState<SystemHealthOut | null>(null)
  const [start, setStart] = useState(isoDateDaysAgo(30))
  const [end, setEnd] = useState(todayPlusOne())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function loadAll() {
    setLoading(true)
    setError(null)
    Promise.all([
      getDashboard(),
      getPatientVolume(14),
      getLabTurnaround(start, end),
      getCriticalAlerts(start, end),
      getSystemHealth(),
    ])
      .then(([d, v, t, c, h]) => {
        setDashboard(d)
        setVolume(v)
        setTurnaround(t)
        setCritical(c)
        setHealth(h)
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const maxVolume = Math.max(1, ...volume.map((v) => v.record_updates))

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Analytics</h1>
        <button
          onClick={loadAll}
          disabled={loading}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {dashboard && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Lab results filed" value={dashboard.results_filed_total} />
          <StatCard label="Pending acknowledgement" value={dashboard.results_pending_acknowledgement} />
          <StatCard label="Critical alerts" value={dashboard.critical_alerts_total} tone="critical" />
          <StatCard label="Avg time to acknowledge" value={formatSeconds(dashboard.avg_time_to_acknowledge_seconds)} />
          <StatCard
            label="Avg critical ack time"
            value={formatSeconds(dashboard.avg_critical_time_to_acknowledge_seconds)}
            tone="critical"
          />
          <StatCard label="Record updates (24h)" value={dashboard.record_updates_last_24h} />
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-800">Patient record activity, last 14 days</h2>
        {volume.length === 0 ? (
          <p className="text-sm text-slate-500">No record updates in this window.</p>
        ) : (
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {[...volume].reverse().map((v) => (
              <div key={v.day} className="flex flex-1 flex-col items-center gap-1" title={`${v.day}: ${v.record_updates}`}>
                <div
                  className="w-full rounded-t bg-blue-500"
                  style={{ height: `${(v.record_updates / maxVolume) * 90}px` }}
                />
                <span className="rotate-45 text-[10px] text-slate-400">{v.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold text-slate-800">Lab turnaround &amp; critical alerts</h2>
          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500">Start</label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">End</label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Results in range" value={turnaround?.total_results ?? '—'} />
          <StatCard label="Avg TAT (range)" value={formatSeconds(turnaround?.avg_time_to_acknowledge_seconds ?? null)} />
          <StatCard label="Critical alerts (range)" value={critical?.total_critical_alerts ?? '—'} tone="critical" />
          <StatCard label="Critical acknowledged" value={critical?.acknowledged_count ?? '—'} />
        </div>

        {critical && critical.alerts.length > 0 && (
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Filed</th>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Acknowledged</th>
                <th className="py-2 pr-4">Time to ack</th>
              </tr>
            </thead>
            <tbody>
              {critical.alerts.slice(0, 20).map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-500">{new Date(a.filed_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{a.patient_id}</td>
                  <td className="py-2 pr-4">
                    {a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleString() : <span className="text-amber-600">pending</span>}
                  </td>
                  <td className="py-2 pr-4">{formatSeconds(a.time_to_acknowledge_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-slate-800">System health</h2>
        <p className="mb-4 text-xs text-slate-400">
          Consumer lag for <span className="font-mono">{health?.consumer_group ?? 'analytics-consumers'}</span> — the
          Redis Streams equivalent of Kafka consumer lag (see analytics-service/README.md).
        </p>
        {health && (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Stream</th>
                <th className="py-2 pr-4">Length</th>
                <th className="py-2 pr-4">Pending</th>
              </tr>
            </thead>
            <tbody>
              {health.streams.map((s) => (
                <tr key={s.stream} className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-mono text-xs">{s.stream}</td>
                  <td className="py-2 pr-4">{s.length}</td>
                  <td className="py-2 pr-4">
                    <span className={s.pending > 0 ? 'font-semibold text-amber-600' : 'text-slate-600'}>{s.pending}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
