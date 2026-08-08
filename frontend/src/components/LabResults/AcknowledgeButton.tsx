import { useState } from 'react'
import { acknowledgeResult } from '../../services/labResults'
import { extractErrorMessage } from '../../services/api'
import type { LabResultOut } from '../../types/lab'

interface AcknowledgeButtonProps {
  result: LabResultOut
  onAcknowledged: (result: LabResultOut) => void
}

export function AcknowledgeButton({ result, onAcknowledged }: AcknowledgeButtonProps) {
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (result.acknowledged_at) {
    return <p className="text-sm text-slate-500">Already acknowledged.</p>
  }

  async function handleAcknowledge() {
    setSubmitting(true)
    setError(null)
    try {
      const updated = await acknowledgeResult(result.id, note || undefined)
      onAcknowledged(updated)
    } catch (err) {
      setError(extractErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        onClick={handleAcknowledge}
        disabled={submitting}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
      >
        {submitting ? 'Acknowledging…' : 'Acknowledge result'}
      </button>
    </div>
  )
}
