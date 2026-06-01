import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AppDeploymentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let app, deployments
  try {
    ;[app, deployments] = await Promise.all([api.applications.get(id), api.deployments.list(id)])
  } catch {
    notFound()
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href={`/applications/${id}`} className="hover:text-zinc-300">{app.name}</Link>
        <span>/</span>
        <span className="text-zinc-300">Deployments</span>
      </div>
      <h1 className="text-xl font-semibold text-zinc-100">All Deployments</h1>

      {deployments.length === 0 ? (
        <p className="text-sm text-zinc-600">No deployments yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Trigger</th>
              <th className="pb-2 font-medium">Started</th>
              <th className="pb-2 font-medium">Duration</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {deployments.map((d: import('@deployforge/shared').Deployment) => {
              const duration = d.finishedAt
                ? Math.round((new Date(d.finishedAt).getTime() - new Date(d.startedAt).getTime()) / 1000)
                : null
              return (
                <tr key={d.id}>
                  <td className="py-2"><StatusBadge status={d.status} /></td>
                  <td className="py-2 text-zinc-500">{d.triggerType}</td>
                  <td className="py-2 text-zinc-500">{new Date(d.startedAt).toLocaleString()}</td>
                  <td className="py-2 text-zinc-500">{duration != null ? `${duration}s` : '—'}</td>
                  <td className="py-2">
                    <Link href={`/deployments/${d.id}`} className="text-zinc-500 hover:text-zinc-300 text-xs">
                      Logs →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
