import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { fileResult, getPanels } from '../../services/labResults'
import { extractErrorMessage } from '../../services/api'
import type { ObservationIn, Panel } from '../../types/lab'

const TEST_DISPLAY_NAMES: Record<string, string> = {
  sodium: 'Sodium',
  potassium: 'Potassium',
  creatinine: 'Creatinine',
  glucose: 'Glucose',
  haemoglobin: 'Haemoglobin',
  troponin: 'Troponin',
}

export function FileLabResultForm() {
  const navigate = useNavigate()
  const [panels, setPanels] = useState<Panel[]>([])
  const [patientId, setPatientId] = useState('')
  const [panelCode, setPanelCode] = useState('')
  const [sourceSystem, setSourceSystem] = useState('manual-entry')
  const [values, setValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getPanels()
      .then(setPanels)
      .catch(() => setPanels([]))
  }, [])

  const selectedPanel = panels.find((p) => p.code === panelCode)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selectedPanel) return
    setError(null)
    setSubmitting(true)

    const now = new Date().toISOString()
    const observations: ObservationIn[] = selectedPanel.tests
      .filter((test) => values[test])
      .map((test) => ({
        loinc_code: test,
        display_name: TEST_DISPLAY_NAMES[test] ?? test,
        value_quantity: Number(values[test]),
      }))

    try {
      const result = await fileResult({
        patient_id: patientId,
        report_code: selectedPanel.code,
        report_display: selectedPanel.display,
        status: 'final',
        source_system: sourceSystem,
        effective_at: now,
        issued_at: now,
        observations,
      })
      navigate(`/results/${result.id}`)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div>
        <label className="block text-sm font-medium text-slate-700">Patient ID</label>
        <input
          required
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          placeholder="Patient UUID"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Panel</label>
        <select
          required
          value={panelCode}
          onChange={(e) => setPanelCode(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select a panel…</option>
          {panels.map((p) => (
            <option key={p.code} value={p.code}>
              {p.display}
            </option>
          ))}
        </select>
      </div>

      {selectedPanel && (
        <div className="space-y-2">
          {selectedPanel.tests.map((test) => (
            <div key={test}>
              <label className="block text-sm font-medium text-slate-700">
                {TEST_DISPLAY_NAMES[test] ?? test}
              </label>
              <input
                type="number"
                step="any"
                value={values[test] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [test]: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">Source system</label>
        <input
          value={sourceSystem}
          onChange={(e) => setSourceSystem(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !panelCode}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? 'Filing…' : 'File result'}
      </button>
    </form>
  )
}
