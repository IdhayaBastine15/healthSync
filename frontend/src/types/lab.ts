export interface ObservationOut {
  id: string
  loinc_code: string
  display_name: string
  value_quantity: number | null
  value_string: string | null
  unit: string | null
  reference_low: number | null
  reference_high: number | null
  interpretation: string | null
}

export interface LabResultOut {
  id: string
  patient_id: string
  report_code: string
  report_display: string | null
  status: string
  is_critical: boolean
  acknowledged_by: string | null
  acknowledged_at: string | null
  source_system: string
  effective_at: string
  issued_at: string
}

export interface LabResultDetail extends LabResultOut {
  observations: ObservationOut[]
}

export interface ObservationIn {
  loinc_code: string
  display_name: string
  value_quantity?: number
  value_string?: string
  unit?: string
  reference_low?: number
  reference_high?: number
}

export interface LabResultCreate {
  patient_id: string
  report_code: string
  report_display?: string
  status: string
  source_system: string
  effective_at: string
  issued_at: string
  observations: ObservationIn[]
}

export interface Panel {
  code: string
  display: string
  tests: string[]
}

export interface ReferenceRange {
  test_code: string
  low: number | null
  high: number | null
  unit: string
}
