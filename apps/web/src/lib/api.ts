import type {
  Application,
  Deployment,
  DeploymentLog,
  MonitoringSummary,
} from '@deployforge/shared'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getServerToken(): Promise<string | undefined> {
  // Only called server-side (Next.js server components → API).
  // Browser requests use credentials: 'include' — the httpOnly cookie is sent automatically.
  try {
    const { cookies } = await import('next/headers')
    const store = await cookies()
    return store.get('df_token')?.value
  } catch {
    return undefined
  }
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (typeof window === 'undefined') {
    const token = await getServerToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  if (init?.headers) Object.assign(headers, init.headers)

  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      if (retry) {
        const refreshed = await fetch(`${BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        })
        if (refreshed.ok) return request<T>(path, init, false)
      }
      window.location.href = '/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ user: { id: string; username: string; role: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ username, password }) },
      ),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    me: () => request<{ id: string; username: string; role: string }>('/auth/me'),
    users: {
      list: () => request<{ id: string; username: string; role: string; createdAt: string }[]>('/auth/users'),
      create: (username: string, password: string, role: 'admin' | 'viewer') =>
        request('/auth/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),
      delete: (id: string) => request(`/auth/users/${id}`, { method: 'DELETE' }),
    },
  },
  applications: {
    list: () => request<Application[]>('/applications'),
    get: (id: string) => request<Application>(`/applications/${id}`),
    create: (data: Partial<Application>) =>
      request<Application>('/applications', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Application>) =>
      request<Application>(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/applications/${id}`, { method: 'DELETE' }),
    deploy: (id: string) => request<Deployment>(`/applications/${id}/deploy`, { method: 'POST' }),
    stop: (id: string) => request<{ success: boolean; message: string }>(`/applications/${id}/stop`, { method: 'POST' }),
    restart: (id: string) => request<Deployment>(`/applications/${id}/restart`, { method: 'POST' }),
    status: (id: string) => request<{ id: string; status: string; containerName: string }>(`/applications/${id}/status`),
  },
  deployments: {
    list: (applicationId?: string) =>
      request<Deployment[]>(`/deployments${applicationId ? `?applicationId=${applicationId}` : ''}`),
    get: (id: string) => request<Deployment>(`/deployments/${id}`),
    logs: (id: string) => request<DeploymentLog[]>(`/deployments/${id}/logs`),
  },
  monitoring: {
    summary: () => request<MonitoringSummary>('/monitoring/summary'),
  },
}
