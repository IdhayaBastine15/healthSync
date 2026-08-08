import { api } from './api'
import type { AuditEventOut } from '../types/audit'

export async function getAuditEvents(limit = 50, offset = 0): Promise<AuditEventOut[]> {
  const { data } = await api.get<AuditEventOut[]>('/audit/events', { params: { limit, offset } })
  return data
}

export async function getPatientAuditTrail(patientId: string): Promise<AuditEventOut[]> {
  const { data } = await api.get<AuditEventOut[]>(`/audit/patient/${patientId}`)
  return data
}

export async function getUserAuditTrail(userId: string): Promise<AuditEventOut[]> {
  const { data } = await api.get<AuditEventOut[]>(`/audit/user/${userId}`)
  return data
}

export async function getGdprReport(start: string, end: string): Promise<AuditEventOut[]> {
  const { data } = await api.get<AuditEventOut[]>(`/audit/report/${start}_${end}`)
  return data
}
