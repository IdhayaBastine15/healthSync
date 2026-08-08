import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PatientSearchBar } from '../components/PatientRecord/PatientSearchBar'
import { PatientSearchResults } from '../components/PatientRecord/PatientSearchResults'
import { searchPatients, createPatient } from '../services/patients'
import { extractErrorMessage } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { hasPermission } from '../utils/rbac'
import type { PatientOut } from '../types/patient'

export function PatientSearchPage() {
  const navigate = useNavigate()
  const roles = useAuthStore((s) => s.roles)
  const [results, setResults] = useState<PatientOut[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  async function handleSearch(q: string, dob?: string) {
    setLoading(true)
    setError(null)
    try {
      setResults(await searchPatients(q, dob))
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Patients</h1>
        {hasPermission(roles, 'PATIENT_WRITE') && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {showCreate ? 'Cancel' : 'New patient'}
          </button>
        )}
      </div>

      {showCreate && (
        <CreatePatientForm
          onCreated={(patient) => {
            setShowCreate(false)
            navigate(`/patients/${patient.id}`)
          }}
        />
      )}

      <div className="mt-6">
        <PatientSearchBar onSearch={handleSearch} loading={loading} />
      </div>

      {error && <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <PatientSearchResults patients={results} />
    </div>
  )
}

function CreatePatientForm({ onCreated }: { onCreated: (patient: PatientOut) => void }) {
  const [givenName, setGivenName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const patient = await createPatient({
        given_name: givenName,
        family_name: familyName,
        date_of_birth: dob,
        gender: gender || undefined,
      })
      onCreated(patient)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border border-slate-200 bg-white p-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Given name</label>
          <input
            required
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Family name</label>
          <input
            required
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Date of birth</label>
          <input
            required
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Gender</label>
          <input
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Creating…' : 'Create patient'}
      </button>
    </form>
  )
}
