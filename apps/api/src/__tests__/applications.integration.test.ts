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

const validPayload = {
  name: 'int-test-app',
  dockerImage: 'nginx:alpine',
  containerName: 'int-test-container',
  internalPort: 80,
  externalPort: 9090,
}

describe('GET /api/applications', () => {
  it('returns 200 with empty array when no applications exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/applications', headers: auth() })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('returns created applications', async () => {
    await app.prisma.application.create({ data: { ...validPayload, environment: {} } })

    const res = await app.inject({ method: 'GET', url: '/api/applications', headers: auth() })
    const body = JSON.parse(res.body)

    expect(res.statusCode).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('int-test-app')
  })

  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/applications' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/applications', () => {
  it('creates an application and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: auth(),
      payload: validPayload,
    })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.name).toBe('int-test-app')
    expect(body.status).toBe('stopped')
    expect(body.id).toBeDefined()
  })

  it('returns 400 for invalid payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/applications',
      headers: auth(),
      payload: { name: 'Bad Name!' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects duplicate names', async () => {
    await app.inject({ method: 'POST', url: '/api/applications', headers: auth(), payload: validPayload })
    const res = await app.inject({ method: 'POST', url: '/api/applications', headers: auth(), payload: validPayload })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
  })
})

describe('GET /api/applications/:id', () => {
  it('returns the application by id', async () => {
    const created = await app.prisma.application.create({ data: { ...validPayload, environment: {} } })

    const res = await app.inject({ method: 'GET', url: `/api/applications/${created.id}`, headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).id).toBe(created.id)
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/applications/nonexistent', headers: auth() })
    expect(res.statusCode).toBe(404)
  })
})

describe('PUT /api/applications/:id', () => {
  it('updates an application', async () => {
    const created = await app.prisma.application.create({ data: { ...validPayload, environment: {} } })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/applications/${created.id}`,
      headers: auth(),
      payload: { dockerImage: 'nginx:1.25' },
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).dockerImage).toBe('nginx:1.25')
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/applications/nonexistent',
      headers: auth(),
      payload: { dockerImage: 'nginx:1.25' },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('DELETE /api/applications/:id', () => {
  it('deletes an application and returns 204', async () => {
    const created = await app.prisma.application.create({ data: { ...validPayload, environment: {} } })

    const res = await app.inject({ method: 'DELETE', url: `/api/applications/${created.id}`, headers: auth() })

    expect(res.statusCode).toBe(204)

    const check = await app.inject({ method: 'GET', url: `/api/applications/${created.id}`, headers: auth() })
    expect(check.statusCode).toBe(404)
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/applications/nonexistent', headers: auth() })
    expect(res.statusCode).toBe(404)
  })
})

describe('Action role enforcement', () => {
  it('viewer cannot deploy', async () => {
    const created = await app.prisma.application.create({ data: { ...validPayload, environment: {} } })
    const viewerToken = app.jwt.sign({ id: 'v1', username: 'viewer', role: 'viewer' })
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${created.id}/deploy`,
      headers: { authorization: `Bearer ${viewerToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('viewer cannot stop', async () => {
    const created = await app.prisma.application.create({ data: { ...validPayload, environment: {} } })
    const viewerToken = app.jwt.sign({ id: 'v1', username: 'viewer', role: 'viewer' })
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${created.id}/stop`,
      headers: { authorization: `Bearer ${viewerToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('viewer cannot restart', async () => {
    const created = await app.prisma.application.create({ data: { ...validPayload, environment: {} } })
    const viewerToken = app.jwt.sign({ id: 'v1', username: 'viewer', role: 'viewer' })
    const res = await app.inject({
      method: 'POST',
      url: `/api/applications/${created.id}/restart`,
      headers: { authorization: `Bearer ${viewerToken}` },
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' })
  })
})
