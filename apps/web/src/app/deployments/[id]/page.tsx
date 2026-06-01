import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

const levelColors: Record<string, string> = {
  info: 'text-zinc-300',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  debug: 'text-zinc-600',
}

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let deployment, logs
  try {
    ;[deployment, logs] = await Promise.all([api.deployments.get(id), api.deployments.logs(id)])
  } catch {
    notFound()
  }

  const duration = deployment.finishedAt
    ? Math.round((new Date(deployment.finishedAt).getTime() - new Date(deployment.startedAt).getTime()) / 1000)
    : null

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/deployments" className="hover:text-zinc-300">Deployments</Link>
        <span>/</span>
        <span className="text-zinc-300 font-mono text-xs">{id.slice(0, 8)}…</span>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={deployment.status} />
            <span className="text-sm text-zinc-400">{deployment.triggerType} trigger</span>
          </div>
          {deployment.application && (
            <Link
              href={`/applications/${deployment.applicationId}`}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {deployment.application.name}
            </Link>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-zinc-500 text-xs">Started</p>
            <p className="text-zinc-300">{new Date(deployment.startedAt).toLocaleString()}</p>
          </div>
          {deployment.finishedAt && (
            <div>
              <p className="text-zinc-500 text-xs">Finished</p>
              <p className="text-zinc-300">{new Date(deployment.finishedAt).toLocaleString()}</p>
            </div>
          )}
          {duration != null && (
            <div>
              <p className="text-zinc-500 text-xs">Duration</p>
              <p className="text-zinc-300">{duration}s</p>
            </div>
          )}
        </div>
        {deployment.summary && <p className="text-sm text-zinc-400">{deployment.summary}</p>}
        {deployment.errorMessage && (
          <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded p-2">
            {deployment.errorMessage}
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Logs</h2>
        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs space-y-0.5 max-h-[60vh] overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-zinc-600">No logs.</p>
          ) : (
            logs.map((log: import('@deployforge/shared').DeploymentLog) => (
              <div key={log.id} className="flex gap-3">
                <span className="text-zinc-700 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="text-zinc-600 shrink-0 w-10">[{log.level}]</span>
                <span className={levelColors[log.level] ?? 'text-zinc-300'}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
