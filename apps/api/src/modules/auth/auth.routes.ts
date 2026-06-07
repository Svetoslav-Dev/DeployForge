import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import UAParser from 'ua-parser-js'
import { AuthService } from './auth.service'

const ACCESS_TTL = '1h'
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

const loginSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
})

const createUserSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-z0-9_-]+$/, 'lowercase letters, numbers, _ and - only'),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'viewer']).optional().default('viewer'),
})

function parseUA(uaString: string | undefined) {
  if (!uaString) return { os: undefined, browser: undefined }
  const parser = new UAParser(uaString)
  const os = parser.getOS()
  const browser = parser.getBrowser()
  return {
    os: [os.name, os.version].filter(Boolean).join(' ') || undefined,
    browser: [browser.name, browser.major].filter(Boolean).join(' ') || undefined,
  }
}

function getClientIp(req: { ip: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0]
    return first.trim()
  }
  return req.ip
}

function cookieOpts(app: FastifyInstance, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
    secure: app.config.NODE_ENV === 'production',
  }
}

export async function authRoutes(app: FastifyInstance) {
  const svc = new AuthService(app.prisma)

  // Login — rate limited to 5 attempts per 15 minutes per IP
  app.post('/auth/login', {
    config: {
      rateLimit: app.config.NODE_ENV === 'test'
        ? false
        : { max: 5, timeWindow: '15 minutes' },
    },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid credentials' })

    const { username, password } = parsed.data
    const ip = getClientIp(req as Parameters<typeof getClientIp>[0])
    const uaString = req.headers['user-agent']
    const { os, browser } = parseUA(uaString)

    const user = await svc.validateCredentials(username, password)

    await app.prisma.authLog.create({
      data: {
        username,
        event: user ? 'login_success' : 'login_failure',
        ip,
        userAgent: uaString ?? null,
        os: os ?? null,
        browser: browser ?? null,
      },
    })

    if (!user) {
      app.log.warn({ username, ip, browser, os }, 'Failed login attempt')
      return reply.status(401).send({ error: 'Invalid username or password' })
    }

    app.log.info({ username, ip, browser, os }, 'Successful login')

    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: ACCESS_TTL },
    )
    const refreshToken = await svc.createRefreshToken(user.id)

    reply.setCookie('df_token', token, cookieOpts(app, 60 * 60))
    reply.setCookie('df_refresh', refreshToken, {
      ...cookieOpts(app, REFRESH_MAX_AGE),
      path: '/api/auth/refresh',
    })

    return reply.send({ user })
  })

  // Refresh — issues a new access token using the httpOnly refresh token cookie
  app.post('/auth/refresh', async (req, reply) => {
    const refreshToken = req.cookies['df_refresh']
    if (!refreshToken) return reply.status(401).send({ error: 'No refresh token' })

    const user = await svc.validateRefreshToken(refreshToken)
    if (!user) {
      reply.clearCookie('df_refresh', { path: '/api/auth/refresh' })
      return reply.status(401).send({ error: 'Invalid or expired refresh token' })
    }

    // Rotate: revoke old, issue new
    await svc.revokeRefreshToken(refreshToken)
    const newRefreshToken = await svc.createRefreshToken(user.id)

    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: ACCESS_TTL },
    )

    reply.setCookie('df_token', token, cookieOpts(app, 60 * 60))
    reply.setCookie('df_refresh', newRefreshToken, {
      ...cookieOpts(app, REFRESH_MAX_AGE),
      path: '/api/auth/refresh',
    })

    return reply.send({ user })
  })

  // Logout — revokes refresh token and clears both cookies
  app.post('/auth/logout', async (req, reply) => {
    const refreshToken = req.cookies['df_refresh']
    if (refreshToken) await svc.revokeRefreshToken(refreshToken).catch(() => {})
    reply.clearCookie('df_token', { path: '/' })
    reply.clearCookie('df_refresh', { path: '/api/auth/refresh' })
    return reply.status(204).send()
  })

  // Current user — requires auth (handled by global hook)
  app.get('/auth/me', async (req) => {
    return req.user
  })

  // Admin: view auth logs
  app.get<{ Querystring: { limit?: string } }>('/auth/logs', async (req, reply) => {
    if ((req.user as { role: string }).role !== 'admin') {
      return reply.status(403).send({ error: 'Admin only' })
    }
    const limit = Math.min(parseInt(req.query.limit ?? '100', 10), 500)
    return app.prisma.authLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    })
  })

  // Admin: list users
  app.get('/auth/users', async (req, reply) => {
    if ((req.user as { role: string }).role !== 'admin') {
      return reply.status(403).send({ error: 'Admin only' })
    }
    return svc.listUsers()
  })

  // Admin: create user
  app.post('/auth/users', async (req, reply) => {
    if ((req.user as { role: string }).role !== 'admin') {
      return reply.status(403).send({ error: 'Admin only' })
    }
    const result = createUserSchema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ error: result.error.flatten() })

    try {
      const user = await svc.createUser(result.data.username, result.data.password, result.data.role)
      return reply.status(201).send(user)
    } catch {
      return reply.status(409).send({ error: 'Username already exists' })
    }
  })

  // Admin: delete user
  app.delete<{ Params: { id: string } }>('/auth/users/:id', async (req, reply) => {
    if ((req.user as { role: string }).role !== 'admin') {
      return reply.status(403).send({ error: 'Admin only' })
    }
    if ((req.user as { id: string }).id === req.params.id) {
      return reply.status(400).send({ error: 'Cannot delete your own account' })
    }
    try {
      await app.prisma.user.delete({ where: { id: req.params.id } })
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })
}
