import { FileLabResultForm } from '../components/LabResults/FileLabResultForm'

export function FileLabResultPage() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">File Lab Result</h1>
      <FileLabResultForm />
    </div>
  )
}
