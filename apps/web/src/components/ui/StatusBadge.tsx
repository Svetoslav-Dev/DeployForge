const colors: Record<string, string> = {
  running: 'bg-green-900 text-green-300 border-green-700',
  success: 'bg-green-900 text-green-300 border-green-700',
  stopped: 'bg-zinc-700 text-zinc-300 border-zinc-600',
  error: 'bg-red-900 text-red-300 border-red-700',
  failed: 'bg-red-900 text-red-300 border-red-700',
  deploying: 'bg-blue-900 text-blue-300 border-blue-700',
  pending: 'bg-yellow-900 text-yellow-300 border-yellow-700',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[status] ?? 'bg-zinc-700 text-zinc-300 border-zinc-600'}`}>
      {status}
    </span>
  )
}
