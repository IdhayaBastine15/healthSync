export interface AuditEventOut {
  id: string
  event_type: string
  user_id: string | null
  user_role: string | null
  patient_id: string | null
  resource_type: string | null
  resource_id: string | null
  action: string
  ip_address: string | null
  outcome: string | null
  created_at: string
}
