import Fastify from 'fastify'
import cors from '@fastify/cors'

import envPlugin from './plugins/env'
import prismaPlugin from './plugins/prisma'
import { applicationsRoutes } from './modules/applications/applications.routes'
import { deploymentsRoutes } from './modules/deployments/deployments.routes'
import { monitoringRoutes } from './modules/monitoring/monitoring.routes'
import { webhooksRoutes } from './modules/webhooks/webhooks.routes'

const app = Fastify({ logger: true })

async function start() {
  await app.register(envPlugin)
  await app.register(cors, { origin: app.config.CORS_ORIGIN })
  await app.register(prismaPlugin)

  // Mount all routes under /api
  await app.register(
    async (api) => {
      await api.register(applicationsRoutes)
      await api.register(deploymentsRoutes)
      await api.register(monitoringRoutes)
      await api.register(webhooksRoutes)
    },
    { prefix: '/api' },
  )

  app.get('/health', async () => ({ status: 'ok' }))

  await app.listen({ port: app.config.PORT, host: '0.0.0.0' })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
