'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/applications', label: 'Applications' },
  { href: '/deployments', label: 'Deployments' },
]

// useSyncExternalStore correctly handles SSR (empty server snapshot) and
// reads localStorage on the client without a useEffect + setState cascade.
function useUsername() {
  return useSyncExternalStore(
    () => () => {},
    () => localStorage.getItem('df_username') ?? '',
    () => '',
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const username = useUsername()

  async function logout() {
    await fetch(`${BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
    localStorage.removeItem('df_username')
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-52 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="px-4 py-5 border-b border-zinc-800">
        <span className="text-sm font-semibold tracking-widest text-zinc-200 uppercase">DeployForge</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {nav.map(({ href, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`block px-3 py-2 rounded text-sm font-medium transition-colors ${
                active
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800 space-y-2">
        {username && (
          <p className="px-2 text-xs text-zinc-600 truncate">{username}</p>
        )}
        <button
          onClick={logout}
          className="w-full px-3 py-2 text-left text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
