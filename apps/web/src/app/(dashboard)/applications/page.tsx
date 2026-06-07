import { api } from '@/lib/api'
import { StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ApplicationsPage() {
  let apps
  try {
    apps = await api.applications.list()
  } catch {
    return <div className="text-zinc-400 text-sm">Could not load applications.</div>
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">Applications</h1>
        <Link
          href="/applications/new"
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          New Application
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <p className="text-zinc-500 text-sm">No applications yet.</p>
          <Link href="/applications/new" className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300">
            Create your first application
          </Link>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Image</th>
              <th className="pb-2 font-medium">Port</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium">Deploys</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {apps.map((app) => (
              <tr key={app.id}>
                <td className="py-3 text-zinc-200 font-medium">
                  <Link href={`/applications/${app.id}`} className="hover:text-white">
                    {app.name}
                  </Link>
                </td>
                <td className="py-3 text-zinc-400 font-mono text-xs">{app.dockerImage}</td>
                <td className="py-3 text-zinc-400">{app.externalPort}</td>
                <td className="py-3"><StatusBadge status={app.status} /></td>
                <td className="py-3 text-zinc-400">{app._count?.deployments ?? 0}</td>
                <td className="py-3">
                  <Link href={`/applications/${app.id}`} className="text-zinc-500 hover:text-zinc-300 text-xs">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
