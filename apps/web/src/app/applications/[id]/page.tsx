import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
import { ApplicationActions } from '@/components/ui/ApplicationActions'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let app, deployments
  try {
    ;[app, deployments] = await Promise.all([
      api.applications.get(id),
      api.deployments.list(id),
    ])
  } catch {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-zinc-100">{app.name}</h1>
            <StatusBadge status={app.status} />
          </div>
          {app.description && <p className="text-sm text-zinc-400">{app.description}</p>}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/applications/${id}/edit`}
            className="px-3 py-1.5 text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded transition-colors"
          >
            Edit
          </Link>
          <ApplicationActions id={id} status={app.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Configuration</h2>
          <div className="space-y-2">
            <Row label="Docker Image" value={app.dockerImage} mono />
            <Row label="Container Name" value={app.containerName} mono />
            <Row label="Internal Port" value={String(app.internalPort)} />
            <Row label="External Port" value={String(app.externalPort)} />
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Environment</h2>
          {Object.keys(app.environment ?? {}).length === 0 ? (
            <p className="text-zinc-600 text-xs">No environment variables.</p>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {Object.entries(app.environment ?? {}).map(([k]) => (
                <div key={k} className="text-zinc-400">{k}=<span className="text-zinc-600">***</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-400">Deployment History</h2>
          <Link href={`/applications/${id}/deployments`} className="text-xs text-zinc-500 hover:text-zinc-300">
            View all
          </Link>
        </div>
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
              {deployments.slice(0, 10).map((d: import('@deployforge/shared').Deployment) => {
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
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className={`text-zinc-300 truncate text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
