import { useEffect } from 'react'
import { getSocket, joinPatientRoom } from '../services/socket'
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
// navigation regardless of which page is active.
export function useCriticalAlerts() {
  const addCriticalAlert = useNotificationStore((s) => s.addCriticalAlert)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handler = (envelope: StreamEnvelope) => {
      addCriticalAlert({
        id: envelope.event_id,
        patientId: envelope.patient_id ?? '',
        resultId: envelope.result_id ?? '',
        timestamp: envelope.timestamp,
      })
    }

    socket.on('lab.result.critical', handler)
    return () => {
      socket.off('lab.result.critical', handler)
    }
  }, [addCriticalAlert])
}

// Per-patient toast listener - used on PatientDetailPage after joining that
// patient's room.
export function usePatientRoomEvents(patientId: string | undefined) {
  const addToast = useNotificationStore((s) => s.addToast)

  useEffect(() => {
    if (!patientId) return
    const socket = getSocket()
    if (!socket) return

    joinPatientRoom(patientId)

    const onResultFiled = (envelope: StreamEnvelope) => {
      addToast({ id: envelope.event_id, message: `New lab result filed (${envelope.result_id ?? ''})` })
    }
    const onPatientUpdated = (envelope: StreamEnvelope) => {
      addToast({ id: envelope.event_id, message: 'This patient record was updated' })
    }

    socket.on('lab.result.filed', onResultFiled)
    socket.on('patient.record.updated', onPatientUpdated)
    return () => {
      socket.off('lab.result.filed', onResultFiled)
      socket.off('patient.record.updated', onPatientUpdated)
    }
  }, [patientId, addToast])
}
