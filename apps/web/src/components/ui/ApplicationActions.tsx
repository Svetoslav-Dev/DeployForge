'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { AppStatus } from '@deployforge/shared'

export function ApplicationActions({ id, status }: { id: string; status: AppStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this application and all its deployments?')) return
    await run(async () => {
      await api.applications.delete(id)
      router.push('/applications')
    })
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-400">{error}</span>}

      {status !== 'running' && (
        <button
          disabled={busy}
          onClick={() => run(() => api.applications.deploy(id))}
          className="px-3 py-1.5 text-sm bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded transition-colors"
        >
          Deploy
        </button>
      )}

      {status === 'running' && (
        <>
          <button
            disabled={busy}
            onClick={() => run(() => api.applications.restart(id))}
            className="px-3 py-1.5 text-sm bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded transition-colors"
          >
            Restart
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => api.applications.stop(id))}
            className="px-3 py-1.5 text-sm border border-zinc-700 hover:border-zinc-500 disabled:opacity-50 text-zinc-300 rounded transition-colors"
          >
            Stop
          </button>
        </>
      )}

      <button
        disabled={busy}
        onClick={handleDelete}
        className="px-3 py-1.5 text-sm border border-red-900 hover:border-red-700 disabled:opacity-50 text-red-400 rounded transition-colors"
      >
        Delete
      </button>
    </div>
  )
}
