import { useEffect } from 'react'
import { useNotificationStore } from '../../store/notificationStore'

// Used on pages that join a specific patient room (e.g. PatientDetailPage)
// for lower-priority events - lab.result.filed, patient.record.updated.
export function NotificationToasts() {
  const toasts = useNotificationStore((s) => s.toasts)
  const dismissToast = useNotificationStore((s) => s.dismissToast)

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.id), 6000))
    return () => timers.forEach(clearTimeout)
  }, [toasts, dismissToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center justify-between gap-3 rounded-md bg-slate-800 px-4 py-2 text-sm text-white shadow-lg"
        >
          <span>{toast.message}</span>
          <button onClick={() => dismissToast(toast.id)} className="text-white/70 hover:text-white">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
