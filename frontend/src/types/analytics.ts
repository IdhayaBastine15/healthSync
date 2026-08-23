export interface LabTurnaroundOut {
  id: string
  result_id: string
  patient_id: string
  filed_at: string
  acknowledged_at: string | null
  is_critical: boolean
  time_to_acknowledge_seconds: number | null
}

export interface DashboardOut {
  results_filed_total: number
  results_pending_acknowledgement: number
  critical_alerts_total: number
  avg_time_to_acknowledge_seconds: number | null
  avg_critical_time_to_acknowledge_seconds: number | null
  record_updates_last_24h: number
}

export interface LabTurnaroundReportOut {
  date_range: { start: string; end: string }
  total_results: number
  avg_time_to_acknowledge_seconds: number | null
  results: LabTurnaroundOut[]
}

export interface CriticalAlertsReportOut {
  date_range: { start: string; end: string }
  total_critical_alerts: number
  acknowledged_count: number
  avg_time_to_acknowledge_seconds: number | null
  alerts: LabTurnaroundOut[]
}

export interface PatientVolumeDay {
  day: string
  record_updates: number
}

export interface StreamLag {
  stream: string
  length: number
  pending: number
}

export interface SystemHealthOut {
  consumer_group: string
  streams: StreamLag[]
}
