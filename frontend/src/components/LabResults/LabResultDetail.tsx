import type { LabResultDetail as LabResultDetailType } from '../../types/lab'

const interpretationColor: Record<string, string> = {
  low: 'text-blue-600',
  high: 'text-red-600',
  critical: 'text-red-700 font-bold',
  normal: 'text-slate-700',
}

export function LabResultDetail({ result }: { result: LabResultDetailType }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {result.report_display ?? result.report_code}
          </h2>
          <p className="text-sm text-slate-500">
            Issued {new Date(result.issued_at).toLocaleString()} · {result.source_system}
          </p>
        </div>
        {result.is_critical && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
            CRITICAL
          </span>
        )}
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="py-2 pr-4">Test</th>
            <th className="py-2 pr-4">Value</th>
            <th className="py-2 pr-4">Reference range</th>
            <th className="py-2 pr-4">Interpretation</th>
          </tr>
        </thead>
        <tbody>
          {result.observations.map((o) => (
            <tr key={o.id} className="border-b border-slate-100">
              <td className="py-2 pr-4">{o.display_name}</td>
              <td className="py-2 pr-4">
                {o.value_quantity ?? o.value_string ?? '—'} {o.unit ?? ''}
              </td>
              <td className="py-2 pr-4 text-slate-500">
                {o.reference_low ?? '—'} – {o.reference_high ?? '—'}
              </td>
              <td className={`py-2 pr-4 ${o.interpretation ? interpretationColor[o.interpretation] ?? '' : ''}`}>
                {o.interpretation ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {result.acknowledged_at && (
        <p className="mt-4 text-sm text-slate-500">
          Acknowledged {new Date(result.acknowledged_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}
