import type { AdmissionOut } from '../../types/patient'

export function AdmissionsList({ admissions }: { admissions: AdmissionOut[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Admissions</h2>
      {admissions.length === 0 ? (
        <p className="text-sm text-slate-500">No admission history.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {admissions.map((a) => (
            <li key={a.id} className="py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{a.ward}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    a.discharged_at ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {a.discharged_at ? 'Discharged' : 'Current'}
                </span>
              </div>
              <p className="text-slate-500">
                {new Date(a.admitted_at).toLocaleString()}
                {a.discharged_at ? ` → ${new Date(a.discharged_at).toLocaleString()}` : ''}
              </p>
              {a.reason && <p className="text-slate-500">{a.reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
