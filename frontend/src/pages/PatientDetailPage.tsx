import { useParams } from 'react-router-dom'
import { usePatient } from '../hooks/usePatient'
import { useRecentResults } from '../hooks/useLabResults'
import { usePatientRoomEvents } from '../hooks/useWebSocket'
import { PatientDemographics } from '../components/PatientRecord/PatientDemographics'
import { MedicationsList } from '../components/PatientRecord/MedicationsList'
import { AllergiesList } from '../components/PatientRecord/AllergiesList'
import { AdmissionsList } from '../components/PatientRecord/AdmissionsList'
import { LabResultsList } from '../components/LabResults/LabResultsList'
import { NotificationToasts } from '../components/Notifications/NotificationToast'
import { useState } from 'react'
import type { PatientOut } from '../types/patient'

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { patient, medications, allergies, admissions, loading, error } = usePatient(id)
  const { results } = useRecentResults(id)
  const [localPatient, setLocalPatient] = useState<PatientOut | null>(null)
  usePatientRoomEvents(id)

  const displayPatient = localPatient ?? patient

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>
  if (error) return <p className="m-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  if (!displayPatient) return null

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-slate-800">
        {displayPatient.given_name} {displayPatient.family_name}
      </h1>
      <PatientDemographics patient={displayPatient} onUpdated={setLocalPatient} />
      <MedicationsList medications={medications} />
      <AllergiesList allergies={allergies} />
      <AdmissionsList admissions={admissions} />
      <LabResultsList results={results} />
      <NotificationToasts />
    </div>
  )
}
