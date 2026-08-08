import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { hasPermission, type Permission } from '../../utils/rbac'

interface ProtectedRouteProps {
  children: ReactNode
  requiredPermission?: Permission
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const roles = useAuthStore((s) => s.roles)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredPermission && !hasPermission(roles, requiredPermission)) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-md bg-amber-50 p-6 text-center">
        <p className="text-amber-800">
          Your role doesn't have the <code className="font-mono">{requiredPermission}</code> permission
          needed to view this page.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
