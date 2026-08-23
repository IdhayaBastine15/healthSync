import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useAuth } from '../../hooks/useAuth'
import { hasPermission } from '../../utils/rbac'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
  }`

export function RoleAwareNav() {
  const roles = useAuthStore((s) => s.roles)
  const { logout } = useAuth()

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="mr-4 text-lg font-bold text-blue-700">HealthSync</span>
        <NavLink to="/dashboard" className={linkClass}>
          Dashboard
        </NavLink>
        {hasPermission(roles, 'PATIENT_READ') && (
          <NavLink to="/patients" className={linkClass}>
            Patients
          </NavLink>
        )}
        {hasPermission(roles, 'RESULT_FILE') && (
          <NavLink to="/results/file" className={linkClass}>
            File Result
          </NavLink>
        )}
        {hasPermission(roles, 'AUDIT_READ') && (
          <NavLink to="/audit" className={linkClass}>
            Audit Log
          </NavLink>
        )}
        {hasPermission(roles, 'ANALYTICS_READ') && (
          <NavLink to="/analytics" className={linkClass}>
            Analytics
          </NavLink>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span>{roles.join(', ')}</span>
        <button onClick={() => logout()} className="text-red-600 hover:underline">
          Sign out
        </button>
      </div>
    </nav>
  )
}
