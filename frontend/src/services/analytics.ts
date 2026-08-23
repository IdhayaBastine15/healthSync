import { api } from './api'
import type {
  CriticalAlertsReportOut,
  DashboardOut,
  LabTurnaroundReportOut,
  PatientVolumeDay,
  SystemHealthOut,
} from '../types/analytics'

export async function getDashboard(): Promise<DashboardOut> {
  const { data } = await api.get<DashboardOut>('/analytics/dashboard')
  return data
}

export async function getLabTurnaround(start: string, end: string): Promise<LabTurnaroundReportOut> {
  const { data } = await api.get<LabTurnaroundReportOut>(`/analytics/lab-turnaround/${start}_${end}`)
  return data
}

export async function getCriticalAlerts(start: string, end: string): Promise<CriticalAlertsReportOut> {
  const { data } = await api.get<CriticalAlertsReportOut>(`/analytics/critical-alerts/${start}_${end}`)
  return data
}

export async function getPatientVolume(days = 30): Promise<PatientVolumeDay[]> {
  const { data } = await api.get<PatientVolumeDay[]>('/analytics/patient-volume', { params: { days } })
  return data
}

export async function getSystemHealth(): Promise<SystemHealthOut> {
  const { data } = await api.get<SystemHealthOut>('/analytics/system-health')
  return data
}
