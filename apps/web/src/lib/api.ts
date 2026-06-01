import type {
  Application,
  Deployment,
  DeploymentLog,
  MonitoringSummary,
} from '@deployforge/shared'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
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
