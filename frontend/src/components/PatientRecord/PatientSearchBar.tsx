import { useState, type FormEvent } from 'react'

interface PatientSearchBarProps {
  onSearch: (q: string, dob?: string) => void
  loading: boolean
}

export function PatientSearchBar({ onSearch, loading }: PatientSearchBarProps) {
  const [q, setQ] = useState('')
  const [dob, setDob] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (q.trim().length < 3) return
    onSearch(q.trim(), dob || undefined)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-medium text-slate-700">Name or MRN</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          minLength={3}
          placeholder="At least 3 characters"
          className="mt-1 w-64 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Date of birth</label>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading || q.trim().length < 3}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}
