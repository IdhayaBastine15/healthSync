import { LoginForm } from '../components/Auth/LoginForm'

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-blue-700">HealthSync</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Sign in to your clinical account</p>
        <LoginForm />
      </div>
    </div>
  )
}
