import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { hasPermission } from '../utils/rbac'

export function DashboardPage() {
  const roles = useAuthStore((s) => s.roles)
  const criticalAlerts = useNotificationStore((s) => s.criticalAlerts)

  const cards = [
    { to: '/patients', label: 'Patient Search', permission: 'PATIENT_READ' as const, desc: 'Find and view patient records' },
    { to: '/results/file', label: 'File Lab Result', permission: 'RESULT_FILE' as const, desc: 'Submit a new lab result' },
    { to: '/audit', label: 'Audit Log', permission: 'AUDIT_READ' as const, desc: 'Review system activity' },
    { to: '/analytics', label: 'Analytics', permission: 'ANALYTICS_READ' as const, desc: 'Lab turnaround, critical alerts, system health' },
  ]

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Dashboard</h1>
      <p className="mb-6 text-slate-500">Signed in as {roles.join(', ')}</p>

      {criticalAlerts.length > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 font-semibold text-red-800">
            {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} this session
          </h2>
          <ul className="space-y-1 text-sm text-red-700">
            {criticalAlerts.slice(0, 5).map((a) => (
              <li key={a.id}>
                <Link to={`/results/${a.resultId}`} className="hover:underline">
                  Result {a.resultId} — {new Date(a.timestamp).toLocaleTimeString()}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards
          .filter((c) => hasPermission(roles, c.permission))
          .map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="rounded-lg border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm"
            >
              <h3 className="font-semibold text-slate-800">{c.label}</h3>
              <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
            </Link>
          ))}
      </div>
    </div>
  )
}
