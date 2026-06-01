import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DeploymentsPage() {
  let deployments
  try {
    deployments = await api.deployments.list()
  } catch {
    return <div className="text-zinc-400 text-sm">Could not load deployments.</div>
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold text-zinc-100">Deployments</h1>

      {deployments.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <p className="text-zinc-500 text-sm">No deployments yet. Deploy an application to get started.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 font-medium">App</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Trigger</th>
              <th className="pb-2 font-medium">Started</th>
              <th className="pb-2 font-medium">Duration</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {deployments.map((d) => {
              const duration = d.finishedAt
                ? Math.round((new Date(d.finishedAt).getTime() - new Date(d.startedAt).getTime()) / 1000)
                : null
              return (
                <tr key={d.id}>
                  <td className="py-2 text-zinc-300">
                    {d.application ? (
                      <Link href={`/applications/${d.applicationId}`} className="hover:text-white">
                        {d.application.name}
                      </Link>
                    ) : d.applicationId}
                  </td>
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
