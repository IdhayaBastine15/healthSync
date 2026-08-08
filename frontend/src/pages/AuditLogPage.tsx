import { useEffect, useState, type FormEvent } from 'react'
import { getAuditEvents, getPatientAuditTrail, getUserAuditTrail, getGdprReport } from '../services/audit'
import { extractErrorMessage } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { hasPermission } from '../utils/rbac'
import type { AuditEventOut } from '../types/audit'

const PAGE_SIZE = 50

export function AuditLogPage() {
  const roles = useAuthStore((s) => s.roles)
  const [events, setEvents] = useState<AuditEventOut[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterId, setFilterId] = useState('')
  const [filterType, setFilterType] = useState<'patient' | 'user'>('patient')

  function loadGlobal(newOffset: number) {
    setLoading(true)
    setError(null)
    getAuditEvents(PAGE_SIZE, newOffset)
      .then((data) => {
        setEvents(data)
        setOffset(newOffset)
      })
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadGlobal(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFilter(e: FormEvent) {
    e.preventDefault()
    if (!filterId.trim()) {
      loadGlobal(0)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data =
        filterType === 'patient' ? await getPatientAuditTrail(filterId.trim()) : await getUserAuditTrail(filterId.trim())
      setEvents(data)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Audit Log</h1>
        {hasPermission(roles, 'GDPR_REPORT') && <GdprReportButton />}
      </div>

      <form onSubmit={handleFilter} className="flex items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500">Filter by</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'patient' | 'user')}
            className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="patient">Patient ID</option>
            <option value="user">User ID</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500">ID (leave blank for global log)</label>
          <input
            value={filterId}
            onChange={(e) => setFilterId(e.target.value)}
            placeholder="UUID"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Filter
        </button>
      </form>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-500">No audit events.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Action</th>
                <th className="py-2 pr-4">User</th>
                <th className="py-2 pr-4">Patient</th>
                <th className="py-2 pr-4">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-slate-100">
                  <td className="py-2 pr-4 text-slate-500">{new Date(ev.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{ev.event_type}</td>
                  <td className="py-2 pr-4">{ev.action}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{ev.user_id ?? '—'}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{ev.patient_id ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span
                      className={ev.outcome === 'SUCCESS' ? 'text-green-700' : 'text-red-700'}
                    >
                      {ev.outcome ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!filterId && (
        <div className="flex justify-between text-sm">
          <button
            disabled={offset === 0 || loading}
            onClick={() => loadGlobal(Math.max(0, offset - PAGE_SIZE))}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            ← Newer
          </button>
          <button
            disabled={events.length < PAGE_SIZE || loading}
            onClick={() => loadGlobal(offset + PAGE_SIZE)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  )
}

function GdprReportButton() {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [report, setReport] = useState<AuditEventOut[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setReport(await getGdprReport(start, end))
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        GDPR Report
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500">Start</label>
              <input
                required
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">End</label>
              <input
                required
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '…' : 'Run'}
            </button>
          </form>
          {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {report && (
            <p className="mt-2 text-sm text-slate-600">{report.length} events in range.</p>
          )}
        </div>
      )}
    </div>
  )
}
