import type { AllergyOut } from '../../types/patient'

const severityColor: Record<string, string> = {
  mild: 'bg-yellow-100 text-yellow-700',
  moderate: 'bg-orange-100 text-orange-700',
  severe: 'bg-red-100 text-red-700',
  'life-threatening': 'bg-red-200 text-red-800',
}

export function AllergiesList({ allergies }: { allergies: AllergyOut[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Allergies</h2>
      {allergies.length === 0 ? (
        <p className="text-sm text-slate-500">No known allergies.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {allergies.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <div>
                <span className="font-medium">{a.substance}</span>
                {a.reaction && <span className="text-slate-500"> — {a.reaction}</span>}
              </div>
              {a.severity && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${severityColor[a.severity] ?? ''}`}>
                  {a.severity}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
