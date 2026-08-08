import { useEffect } from 'react'
import type { Socket } from 'socket.io-client'
import { onSocketReady, joinPatientRoom } from '../services/socket'
import { useNotificationStore } from '../store/notificationStore'

interface StreamEnvelope {
  event_id: string
  event_type: string
  schema_version: string
  timestamp: string
  correlation_id: string | null
  patient_id?: string
  result_id?: string
  is_critical?: boolean
  severity?: string
  updated_by?: string
}

// Global critical-alert listener - mounted once in App.tsx so it survives
// navigation regardless of which page is active. Uses onSocketReady rather
// than a one-shot getSocket() check since this can mount before
// connectSocket() has run (e.g. on reload, before useAuth()'s effect fires).
// Tracks every socket instance it has attached to (a reconnect mid-mount -
// token refresh, re-login - hands back a new instance) so cleanup can
// detach from all of them, not just the most recent.
export function useCriticalAlerts() {
  const addCriticalAlert = useNotificationStore((s) => s.addCriticalAlert)

  useEffect(() => {
    const handler = (envelope: StreamEnvelope) => {
      addCriticalAlert({
        id: envelope.event_id,
        patientId: envelope.patient_id ?? '',
        resultId: envelope.result_id ?? '',
        timestamp: envelope.timestamp,
      })
    }

    const attachedSockets: Socket[] = []
    const unsubscribeReady = onSocketReady((socket) => {
      socket.on('lab.result.critical', handler)
      attachedSockets.push(socket)
    })

    return () => {
      unsubscribeReady()
      attachedSockets.forEach((socket) => socket.off('lab.result.critical', handler))
    }
  }, [addCriticalAlert])
}

// Per-patient toast listener - used on PatientDetailPage after joining that
// patient's room.
export function usePatientRoomEvents(patientId: string | undefined) {
  const addToast = useNotificationStore((s) => s.addToast)

  useEffect(() => {
    if (!patientId) return

    const onResultFiled = (envelope: StreamEnvelope) => {
      addToast({ id: envelope.event_id, message: `New lab result filed (${envelope.result_id ?? ''})` })
    }
    const onPatientUpdated = (envelope: StreamEnvelope) => {
      addToast({ id: envelope.event_id, message: 'This patient record was updated' })
    }

    const attachedSockets: Socket[] = []
    const unsubscribeReady = onSocketReady((socket) => {
      joinPatientRoom(patientId)
      socket.on('lab.result.filed', onResultFiled)
      socket.on('patient.record.updated', onPatientUpdated)
      attachedSockets.push(socket)
    })

    return () => {
      unsubscribeReady()
      attachedSockets.forEach((socket) => {
        socket.off('lab.result.filed', onResultFiled)
        socket.off('patient.record.updated', onPatientUpdated)
      })
    }
  }, [patientId, addToast])
}
