import { Link } from 'react-router-dom'
import type { PatientOut } from '../../types/patient'

interface PatientSearchResultsProps {
  patients: PatientOut[]
}

export function PatientSearchResults({ patients }: PatientSearchResultsProps) {
  if (patients.length === 0) {
    return <p className="mt-6 text-sm text-slate-500">No patients found.</p>
  }

  return (
    <table className="mt-6 w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-slate-500">
          <th className="py-2 pr-4">MRN</th>
          <th className="py-2 pr-4">Name</th>
          <th className="py-2 pr-4">DOB</th>
          <th className="py-2 pr-4">Gender</th>
          <th className="py-2 pr-4">Status</th>
        </tr>
      </thead>
      <tbody>
        {patients.map((p) => (
          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
            <td className="py-2 pr-4">
              <Link to={`/patients/${p.id}`} className="font-mono text-blue-600 hover:underline">
                {p.mrn}
              </Link>
            </td>
            <td className="py-2 pr-4">
              {p.given_name} {p.family_name}
            </td>
            <td className="py-2 pr-4">{p.date_of_birth}</td>
            <td className="py-2 pr-4">{p.gender ?? '—'}</td>
            <td className="py-2 pr-4">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {p.is_active ? 'Active' : 'Inactive'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
