import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We test the api module's fetch logic by mocking globalThis.fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after stubbing so the module picks up the mock
const { api } = await import('../api')

function makeResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as Response)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api.applications.list', () => {
  it('calls GET /api/applications', async () => {
    mockFetch.mockReturnValueOnce(makeResponse([]))

    await api.applications.list()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications'),
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    )
  })

  it('returns parsed JSON on success', async () => {
    const apps = [{ id: '1', name: 'app' }]
    mockFetch.mockReturnValueOnce(makeResponse(apps))

    const result = await api.applications.list()
    expect(result).toEqual(apps)
  })

  it('throws an Error on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ error: 'Not found' }, 404))

    await expect(api.applications.list()).rejects.toThrow('Not found')
  })
})

describe('api.applications.create', () => {
  it('calls POST /api/applications with JSON body', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ id: '1', name: 'new-app' }, 201))

    const payload = { name: 'new-app', dockerImage: 'nginx' }
    await api.applications.create(payload)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    )
  })
})

describe('api.applications.delete', () => {
  it('calls DELETE /api/applications/:id', async () => {
    mockFetch.mockReturnValueOnce(makeResponse(undefined, 204))

    await api.applications.delete('app-1')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/applications/app-1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('api.monitoring.summary', () => {
  it('calls GET /api/monitoring/summary', async () => {
    const summary = { totalApps: 0, runningApps: 0, stoppedApps: 0, errorApps: 0, failedDeployments: 0, runningContainers: 0, recentDeployments: [] }
    mockFetch.mockReturnValueOnce(makeResponse(summary))

    const result = await api.monitoring.summary()
    expect(result).toEqual(summary)
  })
})

describe('api.deployments.logs', () => {
  it('calls GET /api/deployments/:id/logs', async () => {
    mockFetch.mockReturnValueOnce(makeResponse([]))

    await api.deployments.logs('dep-1')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/deployments/dep-1/logs'),
      expect.any(Object),
    )
  })
})
