import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'

let app: FastifyInstance
let adminToken: string

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  adminToken = app.jwt.sign({ id: 'test-admin', username: 'admin', role: 'admin' })
})

afterAll(async () => {
  await app.prisma.deploymentLog.deleteMany()
  await app.prisma.deployment.deleteMany()
  await app.prisma.application.deleteMany()
  await app.close()
})

beforeEach(async () => {
  await app.prisma.deploymentLog.deleteMany()
  await app.prisma.deployment.deleteMany()
  await app.prisma.application.deleteMany()
})

const auth = () => ({ authorization: `Bearer ${adminToken}` })

describe('GET /api/monitoring/summary', () => {
  it('returns zeroed summary when no data exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/monitoring/summary', headers: auth() })
    expect(res.statusCode).toBe(200)

    const body = JSON.parse(res.body)
    expect(body.totalApps).toBe(0)
    expect(body.runningApps).toBe(0)
    expect(body.stoppedApps).toBe(0)
    expect(body.errorApps).toBe(0)
    expect(body.failedDeployments).toBe(0)
    expect(body.recentDeployments).toEqual([])
  })

  it('counts apps by status correctly', async () => {
    await app.prisma.application.createMany({
      data: [
        { name: 'app-a', dockerImage: 'nginx', containerName: 'c-a', internalPort: 80, externalPort: 9001, environment: {}, status: 'running' },
        { name: 'app-b', dockerImage: 'nginx', containerName: 'c-b', internalPort: 80, externalPort: 9002, environment: {}, status: 'stopped' },
        { name: 'app-c', dockerImage: 'nginx', containerName: 'c-c', internalPort: 80, externalPort: 9003, environment: {}, status: 'error' },
      ],
    })

    const res = await app.inject({ method: 'GET', url: '/api/monitoring/summary', headers: auth() })
    const body = JSON.parse(res.body)

    expect(body.totalApps).toBe(3)
    expect(body.runningApps).toBe(1)
    expect(body.stoppedApps).toBe(1)
    expect(body.errorApps).toBe(1)
  })

  it('counts failed deployments', async () => {
    const app_ = await app.prisma.application.create({
      data: { name: 'app-d', dockerImage: 'nginx', containerName: 'c-d', internalPort: 80, externalPort: 9004, environment: {} },
    })
    await app.prisma.deployment.createMany({
      data: [
        { applicationId: app_.id, status: 'success', triggerType: 'manual' },
        { applicationId: app_.id, status: 'failed', triggerType: 'manual' },
        { applicationId: app_.id, status: 'failed', triggerType: 'webhook' },
      ],
    })

    const res = await app.inject({ method: 'GET', url: '/api/monitoring/summary', headers: auth() })
    const body = JSON.parse(res.body)

    expect(body.failedDeployments).toBe(2)
  })

  it('includes up to 5 recent deployments', async () => {
    const app_ = await app.prisma.application.create({
      data: { name: 'app-e', dockerImage: 'nginx', containerName: 'c-e', internalPort: 80, externalPort: 9005, environment: {} },
    })
    await app.prisma.deployment.createMany({
      data: Array.from({ length: 7 }, () => ({
        applicationId: app_.id,
        status: 'success' as const,
        triggerType: 'manual' as const,
      })),
    })

    const res = await app.inject({ method: 'GET', url: '/api/monitoring/summary', headers: auth() })
    const body = JSON.parse(res.body)

    expect(body.recentDeployments).toHaveLength(5)
  })
})
