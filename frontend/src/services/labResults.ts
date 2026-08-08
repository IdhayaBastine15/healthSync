import { api } from './api'
import type { LabResultCreate, LabResultDetail, LabResultOut, Panel, ReferenceRange } from '../types/lab'

export async function fileResult(body: LabResultCreate): Promise<LabResultDetail> {
  const { data } = await api.post<LabResultDetail>('/results', body)
  return data
}

export async function getResult(id: string): Promise<LabResultDetail> {
  const { data } = await api.get<LabResultDetail>(`/results/${id}`)
  return data
}

export async function getPatientResults(patientId: string): Promise<LabResultOut[]> {
  const { data } = await api.get<LabResultOut[]>(`/results/patient/${patientId}`)
  return data
}

export async function getRecentResults(patientId: string): Promise<LabResultOut[]> {
  const { data } = await api.get<LabResultOut[]>(`/results/patient/${patientId}/recent`)
  return data
}

export async function acknowledgeResult(id: string, note?: string): Promise<LabResultOut> {
  const { data } = await api.put<LabResultOut>(`/results/${id}/acknowledge`, { note })
  return data
}

export async function getPanels(): Promise<Panel[]> {
  const { data } = await api.get<Panel[]>('/panels')
  return data
}

export async function getReferenceRange(testCode: string): Promise<ReferenceRange> {
  const { data } = await api.get<ReferenceRange>(`/reference-ranges/${testCode}`)
  return data
}
