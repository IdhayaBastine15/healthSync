import { api } from './api'
import type {
  AdmissionOut,
  AllergyOut,
  MedicationOut,
  PatientCreate,
  PatientOut,
  PatientUpdate,
} from '../types/patient'

export async function searchPatients(q: string, dob?: string): Promise<PatientOut[]> {
  const { data } = await api.get<PatientOut[]>('/patients/search', { params: { q, dob } })
  return data
}

export async function getPatient(id: string): Promise<PatientOut> {
  const { data } = await api.get<PatientOut>(`/patients/${id}`)
  return data
}

export async function getMedications(id: string): Promise<MedicationOut[]> {
  const { data } = await api.get<MedicationOut[]>(`/patients/${id}/medications`)
  return data
}

export async function getAllergies(id: string): Promise<AllergyOut[]> {
  const { data } = await api.get<AllergyOut[]>(`/patients/${id}/allergies`)
  return data
}

export async function getAdmissions(id: string): Promise<AdmissionOut[]> {
  const { data } = await api.get<AdmissionOut[]>(`/patients/${id}/admissions`)
  return data
}

export async function createPatient(body: PatientCreate): Promise<PatientOut> {
  const { data } = await api.post<PatientOut>('/patients', body)
  return data
}

export async function updatePatient(id: string, body: PatientUpdate): Promise<PatientOut> {
  const { data } = await api.put<PatientOut>(`/patients/${id}`, body)
  return data
}
