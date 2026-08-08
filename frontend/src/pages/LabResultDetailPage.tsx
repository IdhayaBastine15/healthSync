import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import { getResult } from '../services/labResults'
import { extractErrorMessage } from '../services/api'
import { LabResultDetail } from '../components/LabResults/LabResultDetail'
import { AcknowledgeButton } from '../components/LabResults/AcknowledgeButton'
import { useAuthStore } from '../store/authStore'
import { hasPermission } from '../utils/rbac'
import type { LabResultDetail as LabResultDetailType } from '../types/lab'

export function LabResultDetailPage() {
  const { id } = useParams<{ id: string }>()
  const roles = useAuthStore((s) => s.roles)
  const [result, setResult] = useState<LabResultDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    getResult(id)
      .then((data) => {
        if (!cancelled) setResult(data)
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
  }, [id])

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>
  if (error) return <p className="m-6 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
  if (!result) return null

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-bold text-slate-800">Lab Result</h1>
      <LabResultDetail result={result} />
      {hasPermission(roles, 'RESULT_ACKNOWLEDGE') && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-800">Acknowledge</h2>
          <AcknowledgeButton
            result={result}
            onAcknowledged={(updated) => setResult({ ...result, ...updated })}
          />
        </div>
      )}
    </div>
  )
}
