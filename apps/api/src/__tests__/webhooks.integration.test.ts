import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createHmac } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
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

function sign(secret: string, body: string) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

const pushPayload = JSON.stringify({ ref: 'refs/heads/main' })

describe('POST /api/webhooks/github/:applicationId', () => {
  it('returns 404 for unknown application', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks/github/nonexistent',
      headers: { 'x-github-event': 'push', 'content-type': 'application/json' },
      payload: pushPayload,
    })
    expect(res.statusCode).toBe(404)
  })

  it('triggers deployment for push event on app without secret', async () => {
    const application = await app.prisma.application.create({
      data: {
        name: 'hook-app',
        dockerImage: 'nginx:alpine',
        containerName: 'hook-container',
        internalPort: 80,
        externalPort: 9010,
        environment: {},
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/webhooks/github/${application.id}`,
      headers: { 'x-github-event': 'push', 'content-type': 'application/json' },
      payload: pushPayload,
    })

    expect(res.statusCode).toBe(202)
    const body = JSON.parse(res.body)
    expect(body.deploymentId).toBeDefined()
  })

  it('ignores non-push events', async () => {
    const application = await app.prisma.application.create({
      data: {
        name: 'hook-app-2',
        dockerImage: 'nginx:alpine',
        containerName: 'hook-container-2',
        internalPort: 80,
        externalPort: 9011,
        environment: {},
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/webhooks/github/${application.id}`,
      headers: { 'x-github-event': 'pull_request', 'content-type': 'application/json' },
      payload: pushPayload,
    })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).message).toMatch(/ignored/i)
  })

  it('returns 401 when signature is missing and secret is set', async () => {
    const application = await app.prisma.application.create({
      data: {
        name: 'secured-app',
        dockerImage: 'nginx:alpine',
        containerName: 'secured-container',
        internalPort: 80,
        externalPort: 9012,
        environment: {},
        webhookSecret: 'a-very-secure-secret-key',
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/webhooks/github/${application.id}`,
      headers: { 'x-github-event': 'push', 'content-type': 'application/json' },
      payload: pushPayload,
    })

    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for an invalid signature', async () => {
    const application = await app.prisma.application.create({
      data: {
        name: 'secured-app-2',
        dockerImage: 'nginx:alpine',
        containerName: 'secured-container-2',
        internalPort: 80,
        externalPort: 9013,
        environment: {},
        webhookSecret: 'a-very-secure-secret-key',
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/webhooks/github/${application.id}`,
      headers: {
        'x-github-event': 'push',
        'x-hub-signature-256': 'sha256=invalidsignature',
        'content-type': 'application/json',
      },
      payload: pushPayload,
    })

    expect(res.statusCode).toBe(401)
  })

  it('accepts a valid HMAC signature and triggers deployment', async () => {
    const secret = 'a-very-secure-secret-key'
    const application = await app.prisma.application.create({
      data: {
        name: 'secured-app-3',
        dockerImage: 'nginx:alpine',
        containerName: 'secured-container-3',
        internalPort: 80,
        externalPort: 9014,
        environment: {},
        webhookSecret: secret,
      },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/webhooks/github/${application.id}`,
      headers: {
        'x-github-event': 'push',
        'x-hub-signature-256': sign(secret, pushPayload),
        'content-type': 'application/json',
      },
      payload: pushPayload,
    })

    expect(res.statusCode).toBe(202)
    expect(JSON.parse(res.body).deploymentId).toBeDefined()
  })
})
