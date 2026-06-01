import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-zinc-100">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  let summary
  try {
    summary = await api.monitoring.summary()
  } catch {
    return (
      <div className="text-zinc-400 text-sm">
        Could not connect to API. Make sure the backend is running.
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-zinc-100">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Apps" value={summary.totalApps} />
        <StatCard label="Running" value={summary.runningApps} />
        <StatCard label="Stopped" value={summary.stoppedApps} />
        <StatCard label="Failed Deploys" value={summary.failedDeployments} />
        <StatCard label="Error State" value={summary.errorApps} />
        <StatCard label="Live Containers" value={summary.runningContainers} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Recent Deployments</h2>
        {summary.recentDeployments.length === 0 ? (
          <p className="text-sm text-zinc-600">No deployments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-medium">App</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Trigger</th>
                <th className="pb-2 font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {summary.recentDeployments.map((d: import('@deployforge/shared').Deployment) => (
                <tr key={d.id} className="py-2">
                  <td className="py-2 text-zinc-300">
                    <Link href={`/deployments/${d.id}`} className="hover:text-white">
                      {d.application?.name ?? d.applicationId}
                    </Link>
                  </td>
                  <td className="py-2"><StatusBadge status={d.status} /></td>
                  <td className="py-2 text-zinc-500">{d.triggerType}</td>
                  <td className="py-2 text-zinc-500">
                    {new Date(d.startedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
