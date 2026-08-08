import { useEffect, useState } from 'react'
import * as labResults from '../services/labResults'
import type { LabResultOut } from '../types/lab'
import { extractErrorMessage } from '../services/api'

export function useRecentResults(patientId: string | undefined) {
  const [results, setResults] = useState<LabResultOut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!patientId) return
    let cancelled = false
    setLoading(true)
    labResults
      .getRecentResults(patientId)
      .then((data) => {
        if (!cancelled) setResults(data)
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

  return { results, loading, error }
}
