import { ApplicationForm } from '@/components/ui/ApplicationForm'

export default function NewApplicationPage() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-zinc-100">New Application</h1>
      <ApplicationForm />
    </div>
  )
}
