import { Link } from 'react-router-dom'
import { SignupForm } from '../components/Auth/SignupForm'

export function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-blue-700">HealthSync</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Create a clinical account</p>
        <SignupForm />
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
