export interface PatientOut {
  id: string
  mrn: string
  given_name: string
  family_name: string
  date_of_birth: string
  gender: string | null
  is_active: boolean
}

export interface MedicationOut {
  id: string
  drug_name: string
  dose: string | null
  frequency: string | null
  route: string | null
  status: string
  start_date: string
  end_date: string | null
  stop_reason: string | null
}

export interface AllergyOut {
  id: string
  substance: string
  reaction: string | null
  severity: string | null
}

export interface AdmissionOut {
  id: string
  ward: string
  admitted_at: string
  discharged_at: string | null
  reason: string | null
}

export interface PatientCreate {
  given_name: string
  family_name: string
  date_of_birth: string
  gender?: string
  ppsn?: string
  address_country?: string
  address_postal_code?: string
}

export interface PatientUpdate {
  given_name?: string
  family_name?: string
  gender?: string
  is_active?: boolean
}
