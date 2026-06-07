import fp from 'fastify-plugin'
import jwtPlugin from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; username: string; role: string }
    user: { id: string; username: string; role: string }
  }
}

const UNPROTECTED = new Set([
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/health',
])

function isWebhookRoute(url: string) {
  return url.startsWith('/api/webhooks/')
}

export default fp(async (app: FastifyInstance) => {
  await app.register(jwtPlugin, {
    secret: app.config.JWT_SECRET,
    cookie: { cookieName: 'df_token', signed: false },
  })

  app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (UNPROTECTED.has(req.routeOptions?.url ?? req.url)) return
    if (isWebhookRoute(req.url)) return

    try {
      await req.jwtVerify()
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})
