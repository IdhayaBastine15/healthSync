import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { ProtectedRoute } from './components/Auth/ProtectedRoute'
import { RoleAwareNav } from './components/Dashboard/RoleAwareNav'
import { CriticalAlertBanner } from './components/Notifications/CriticalAlertBanner'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { DashboardPage } from './pages/DashboardPage'
import { PatientSearchPage } from './pages/PatientSearchPage'
import { PatientDetailPage } from './pages/PatientDetailPage'
import { LabResultDetailPage } from './pages/LabResultDetailPage'
import { FileLabResultPage } from './pages/FileLabResultPage'
import { AuditLogPage } from './pages/AuditLogPage'

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <RoleAwareNav />
      {children}
    </div>
  )
}

export default function App() {
  // Ensures the refresh timer + WebSocket connection are (re)established on
  // app load whenever a persisted session exists, regardless of which page
  // renders first - not just when RoleAwareNav happens to mount.
  useAuth()

  return (
    <>
      <CriticalAlertBanner />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <DashboardPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients"
          element={
            <ProtectedRoute requiredPermission="PATIENT_READ">
              <AuthenticatedLayout>
                <PatientSearchPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id"
          element={
            <ProtectedRoute requiredPermission="PATIENT_READ">
              <AuthenticatedLayout>
                <PatientDetailPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/results/file"
          element={
            <ProtectedRoute requiredPermission="RESULT_FILE">
              <AuthenticatedLayout>
                <FileLabResultPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/results/:id"
          element={
            <ProtectedRoute requiredPermission="RESULT_READ">
              <AuthenticatedLayout>
                <LabResultDetailPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute requiredPermission="AUDIT_READ">
              <AuthenticatedLayout>
                <AuditLogPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  )
}
