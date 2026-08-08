import { create } from 'zustand'

export interface CriticalAlert {
  id: string // event_id
  patientId: string
  resultId: string
  timestamp: string
}

export interface Toast {
  id: string
  message: string
}

interface NotificationState {
  criticalAlerts: CriticalAlert[]
  toasts: Toast[]
  addCriticalAlert: (alert: CriticalAlert) => void
  dismissCriticalAlert: (id: string) => void
  addToast: (toast: Toast) => void
  dismissToast: (id: string) => void
}

// In-memory only, by design - notification-service does not persist history
// (see services/notification-service/README.md). A client that wasn't
// connected when an event fired simply never sees it.
export const useNotificationStore = create<NotificationState>((set) => ({
  criticalAlerts: [],
  toasts: [],

  addCriticalAlert: (alert) =>
    set((state) => ({ criticalAlerts: [alert, ...state.criticalAlerts].slice(0, 20) })),

  dismissCriticalAlert: (id) =>
    set((state) => ({ criticalAlerts: state.criticalAlerts.filter((a) => a.id !== id) })),

  addToast: (toast) => set((state) => ({ toasts: [...state.toasts, toast] })),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
