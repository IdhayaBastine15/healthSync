import { Link } from 'react-router-dom'
import type { LabResultOut } from '../../types/lab'

export function LabResultsList({ results }: { results: LabResultOut[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Recent Lab Results</h2>
      {results.length === 0 ? (
        <p className="text-sm text-slate-500">No lab results.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-4">Panel</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Issued</th>
              <th className="py-2 pr-4">Acknowledged</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 pr-4">
                  <Link to={`/results/${r.id}`} className="text-blue-600 hover:underline">
                    {r.report_display ?? r.report_code}
                  </Link>
                  {r.is_critical && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      CRITICAL
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{r.status}</td>
                <td className="py-2 pr-4">{new Date(r.issued_at).toLocaleString()}</td>
                <td className="py-2 pr-4">{r.acknowledged_at ? '✓' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
