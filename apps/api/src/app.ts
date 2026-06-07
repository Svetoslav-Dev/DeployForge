import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import cookiePlugin from '@fastify/cookie'

import envPlugin from './plugins/env'
import prismaPlugin from './plugins/prisma'
import jwtPlugin from './plugins/jwt'
import { authRoutes } from './modules/auth/auth.routes'
import { applicationsRoutes } from './modules/applications/applications.routes'
import { deploymentsRoutes } from './modules/deployments/deployments.routes'
import { monitoringRoutes } from './modules/monitoring/monitoring.routes'
import { webhooksRoutes } from './modules/webhooks/webhooks.routes'

export async function buildApp(opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false })

  await app.register(envPlugin)
  await app.register(cors, {
    origin: app.config.CORS_ORIGIN,
    credentials: true,
  })
  await app.register(rateLimit, {
    global: false, // Only apply to routes that opt in or have a config.rateLimit
    max: 100,
    timeWindow: '1 minute',
  })
  await app.register(cookiePlugin)
  await app.register(prismaPlugin)
  await app.register(jwtPlugin)

  await app.register(
    async (api) => {
      await api.register(authRoutes)
      await api.register(applicationsRoutes)
      await api.register(deploymentsRoutes)
      await api.register(monitoringRoutes)
      await api.register(webhooksRoutes)
    },
    { prefix: '/api' },
  )

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
