import type { FastifyInstance } from 'fastify'
import { DeploymentsService } from './deployments.service'

export async function deploymentsRoutes(app: FastifyInstance) {
  const svc = new DeploymentsService(app.prisma)

  app.get<{ Querystring: { applicationId?: string } }>('/deployments', async (req) => {
    return svc.list(req.query.applicationId)
  })

  app.get<{ Params: { id: string } }>('/deployments/:id', async (req, reply) => {
    try {
      return await svc.get(req.params.id)
    } catch {
      return reply.status(404).send({ error: 'Deployment not found' })
    }
  })

  app.get<{ Params: { id: string } }>('/deployments/:id/logs', async (req, reply) => {
    try {
      await svc.get(req.params.id)
      return svc.getLogs(req.params.id)
    } catch {
      return reply.status(404).send({ error: 'Deployment not found' })
    }
  })
}
