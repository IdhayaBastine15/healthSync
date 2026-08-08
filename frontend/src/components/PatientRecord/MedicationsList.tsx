import type { MedicationOut } from '../../types/patient'

export function MedicationsList({ medications }: { medications: MedicationOut[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">Medications</h2>
      {medications.length === 0 ? (
        <p className="text-sm text-slate-500">No medications recorded.</p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {medications.map((m) => (
            <li key={m.id} className="py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{m.drug_name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {m.status}
                </span>
              </div>
              <p className="text-slate-500">
                {[m.dose, m.frequency, m.route].filter(Boolean).join(' · ') || '—'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
