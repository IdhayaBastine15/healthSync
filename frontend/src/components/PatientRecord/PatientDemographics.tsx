import { useState } from 'react'
import type { PatientOut, PatientUpdate } from '../../types/patient'
import { updatePatient } from '../../services/patients'
import { useAuthStore } from '../../store/authStore'
import { hasPermission } from '../../utils/rbac'
import { extractErrorMessage } from '../../services/api'

interface PatientDemographicsProps {
  patient: PatientOut
  onUpdated: (patient: PatientOut) => void
}

export function PatientDemographics({ patient, onUpdated }: PatientDemographicsProps) {
  const roles = useAuthStore((s) => s.roles)
  const canWrite = hasPermission(roles, 'PATIENT_WRITE')
  const [editing, setEditing] = useState(false)
  const [givenName, setGivenName] = useState(patient.given_name)
  const [familyName, setFamilyName] = useState(patient.family_name)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body: PatientUpdate = { given_name: givenName, family_name: familyName }
      const updated = await updatePatient(patient.id, body)
      onUpdated(updated)
      setEditing(false)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Demographics</h2>
        {canWrite && !editing && (
          <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:underline">
            Edit
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500">Given name</label>
              <input
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">Family name</label>
              <input
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">MRN</dt>
            <dd className="font-mono">{patient.mrn}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Name</dt>
            <dd>
              {patient.given_name} {patient.family_name}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Date of birth</dt>
            <dd>{patient.date_of_birth}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Gender</dt>
            <dd>{patient.gender ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd>{patient.is_active ? 'Active' : 'Inactive'}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}
