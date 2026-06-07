import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import type { OutgoingHttpHeaders } from 'http'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app'

let app: FastifyInstance
let adminToken: string

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
  adminToken = app.jwt.sign({ id: 'test-admin-id', username: 'test-admin', role: 'admin' })
})

afterAll(async () => {
  await app.prisma.refreshToken.deleteMany()
  await app.prisma.authLog.deleteMany()
  await app.prisma.user.deleteMany()
  await app.close()
})

beforeEach(async () => {
  await app.prisma.refreshToken.deleteMany()
  await app.prisma.authLog.deleteMany()
  await app.prisma.user.deleteMany()
})

async function createUser(username: string, password: string, role: 'admin' | 'viewer' = 'viewer') {
  const passwordHash = await bcrypt.hash(password, 4) // low cost for tests
  return app.prisma.user.create({
    data: { username, passwordHash, role },
    select: { id: true, username: true, role: true },
  })
}

function parseCookies(res: { headers: OutgoingHttpHeaders }): string[] {
  const raw = res.headers['set-cookie']
  return Array.isArray(raw) ? raw : raw != null ? [String(raw)] : []
}

describe('POST /api/auth/login', () => {
  it('returns user info and sets httpOnly cookies on success', async () => {
    await createUser('alice', 'password123', 'admin')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice', password: 'password123' },
    })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.user.username).toBe('alice')
    expect(body.token).toBeUndefined()

    const cookies = parseCookies(res)
    expect(cookies.some(c => c.startsWith('df_token=') && c.includes('HttpOnly'))).toBe(true)
    expect(cookies.some(c => c.startsWith('df_refresh=') && c.includes('HttpOnly'))).toBe(true)
  })

  it('returns 401 for wrong password', async () => {
    await createUser('bob', 'correct-password')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'bob', password: 'wrong-password' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 for unknown user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'anything' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 400 for missing password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'alice' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('writes an auth log entry for failed login', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'anything' },
    })
    const logs = await app.prisma.authLog.findMany({ where: { username: 'nobody' } })
    expect(logs).toHaveLength(1)
    expect(logs[0].event).toBe('login_failure')
  })

  it('writes an auth log entry for successful login', async () => {
    await createUser('carol', 'pass1234')
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'carol', password: 'pass1234' },
    })
    const logs = await app.prisma.authLog.findMany({ where: { username: 'carol' } })
    expect(logs).toHaveLength(1)
    expect(logs[0].event).toBe('login_success')
  })
})

describe('GET /api/auth/me', () => {
  it('returns current user when authenticated via Bearer token', async () => {
    const token = app.jwt.sign({ id: 'u1', username: 'carol', role: 'viewer' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).username).toBe('carol')
  })

  it('returns 401 without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/refresh', () => {
  it('issues new access token and rotates refresh token with valid cookie', async () => {
    await createUser('dave', 'password123', 'admin')
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'dave', password: 'password123' },
    })
    expect(loginRes.statusCode).toBe(200)

    const refreshCookie = parseCookies(loginRes).find(c => c.startsWith('df_refresh='))
    const refreshToken = refreshCookie?.split(';')[0].split('=')[1]
    expect(refreshToken).toBeDefined()

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `df_refresh=${refreshToken}` },
    })
    expect(refreshRes.statusCode).toBe(200)

    const newCookies = parseCookies(refreshRes)
    expect(newCookies.some(c => c.startsWith('df_token=') && c.includes('HttpOnly'))).toBe(true)
    expect(newCookies.some(c => c.startsWith('df_refresh=') && c.includes('HttpOnly'))).toBe(true)

    // Old refresh token should now be revoked — second use must fail
    const replayRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `df_refresh=${refreshToken}` },
    })
    expect(replayRes.statusCode).toBe(401)
  })

  it('returns 401 with an invalid refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: 'df_refresh=invalid-token' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 with no refresh token cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears auth cookies and revokes refresh token', async () => {
    await createUser('eve', 'password123')
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'eve', password: 'password123' },
    })
    const refreshCookie = parseCookies(loginRes).find(c => c.startsWith('df_refresh='))
    const refreshToken = refreshCookie?.split(';')[0].split('=')[1]

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: `df_refresh=${refreshToken}` },
    })
    expect(logoutRes.statusCode).toBe(204)

    // Refresh token should be revoked
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `df_refresh=${refreshToken}` },
    })
    expect(refreshRes.statusCode).toBe(401)
  })
})

describe('Admin: user management', () => {
  it('admin can list users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(JSON.parse(res.body))).toBe(true)
  })

  it('viewer cannot list users', async () => {
    const viewerToken = app.jwt.sign({ id: 'v1', username: 'viewer', role: 'viewer' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${viewerToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin can create a user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { username: 'newuser', password: 'securepass', role: 'viewer' },
    })
    expect(res.statusCode).toBe(201)
    expect(JSON.parse(res.body).username).toBe('newuser')
  })

  it('rejects duplicate usernames', async () => {
    await createUser('dupeuser', 'pass1234')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { username: 'dupeuser', password: 'securepass', role: 'viewer' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('viewer cannot create users', async () => {
    const viewerToken = app.jwt.sign({ id: 'v1', username: 'viewer', role: 'viewer' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/users',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { username: 'anotheruser', password: 'securepass', role: 'viewer' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('admin can delete a user', async () => {
    const user = await createUser('todelete', 'pass1234')
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/auth/users/${user.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when deleting a non-existent user', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/auth/users/nonexistent-id',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/auth/logs', () => {
  it('admin can view auth logs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/logs',
      headers: { authorization: `Bearer ${adminToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(JSON.parse(res.body))).toBe(true)
  })

  it('viewer cannot view auth logs', async () => {
    const viewerToken = app.jwt.sign({ id: 'v1', username: 'viewer', role: 'viewer' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/logs',
      headers: { authorization: `Bearer ${viewerToken}` },
    })
    expect(res.statusCode).toBe(403)
  })
})
