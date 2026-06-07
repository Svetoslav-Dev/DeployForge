import { api } from '@/lib/api'
import { ApplicationForm } from '@/components/ui/ApplicationForm'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function EditApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let app
  try {
    app = await api.applications.get(id)
  } catch {
    notFound()
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold text-zinc-100">Edit {app.name}</h1>
      <ApplicationForm initialData={app} />
    </div>
  )
}
