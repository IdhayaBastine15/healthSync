import { useEffect, useState } from 'react'
import * as patients from '../services/patients'
import type { AdmissionOut, AllergyOut, MedicationOut, PatientOut } from '../types/patient'
import { extractErrorMessage } from '../services/api'

export function usePatient(patientId: string | undefined) {
  const [patient, setPatient] = useState<PatientOut | null>(null)
  const [medications, setMedications] = useState<MedicationOut[]>([])
  const [allergies, setAllergies] = useState<AllergyOut[]>([])
  const [admissions, setAdmissions] = useState<AdmissionOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) return
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      patients.getPatient(patientId),
      patients.getMedications(patientId),
      patients.getAllergies(patientId),
      patients.getAdmissions(patientId),
    ])
      .then(([p, meds, allergyList, admissionList]) => {
        if (cancelled) return
        setPatient(p)
        setMedications(meds)
        setAllergies(allergyList)
        setAdmissions(admissionList)
      })
      .catch((err) => {
        if (!cancelled) setError(extractErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [patientId])

  return { patient, medications, allergies, admissions, loading, error }
}
