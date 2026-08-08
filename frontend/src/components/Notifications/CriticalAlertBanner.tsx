import { Link } from 'react-router-dom'
import { useCriticalAlerts } from '../../hooks/useWebSocket'
import { useNotificationStore } from '../../store/notificationStore'

// Mounted once in App.tsx, outside the route outlet, so it persists across
// navigation and fires regardless of which page is currently open.
export function CriticalAlertBanner() {
  useCriticalAlerts()
  const criticalAlerts = useNotificationStore((s) => s.criticalAlerts)
  const dismissCriticalAlert = useNotificationStore((s) => s.dismissCriticalAlert)

  if (criticalAlerts.length === 0) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 space-y-1 p-2">
      {criticalAlerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between rounded-md bg-red-600 px-4 py-3 text-white shadow-lg"
        >
          <span className="font-semibold">
            🚨 Critical lab result{alert.patientId ? ` for patient ${alert.patientId}` : ''}
          </span>
          <div className="flex items-center gap-3">
            {alert.resultId && (
              <Link
                to={`/results/${alert.resultId}`}
                className="rounded bg-white/20 px-3 py-1 text-sm font-medium hover:bg-white/30"
              >
                View result
              </Link>
            )}
            <button
              onClick={() => dismissCriticalAlert(alert.id)}
              className="text-white/80 hover:text-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
