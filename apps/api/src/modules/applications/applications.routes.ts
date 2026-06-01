import type { FastifyInstance } from 'fastify'
import { ApplicationsService } from './applications.service'
import { createApplicationSchema, updateApplicationSchema } from './applications.schema'
import { DeploymentsService } from '../deployments/deployments.service'

export async function applicationsRoutes(app: FastifyInstance) {
  const svc = new ApplicationsService(app.prisma)
  const deploySvc = new DeploymentsService(app.prisma)

  app.get('/applications', async () => svc.list())

  app.post('/applications', async (req, reply) => {
    const parsed = createApplicationSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    const app_ = await svc.create(parsed.data)
    return reply.status(201).send(app_)
  })

  app.get<{ Params: { id: string } }>('/applications/:id', async (req, reply) => {
    try {
      return await svc.get(req.params.id)
    } catch {
      return reply.status(404).send({ error: 'Application not found' })
    }
  })

  app.put<{ Params: { id: string } }>('/applications/:id', async (req, reply) => {
    const parsed = updateApplicationSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    try {
      return await svc.update(req.params.id, parsed.data)
    } catch {
      return reply.status(404).send({ error: 'Application not found' })
    }
  })

  app.delete<{ Params: { id: string } }>('/applications/:id', async (req, reply) => {
    try {
      await svc.delete(req.params.id)
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Application not found' })
    }
  })

  app.get<{ Params: { id: string } }>('/applications/:id/status', async (req, reply) => {
    try {
      return await svc.getStatus(req.params.id)
    } catch {
      return reply.status(404).send({ error: 'Application not found' })
    }
  })

  app.post<{ Params: { id: string } }>('/applications/:id/deploy', async (req, reply) => {
    try {
      const application = await svc.get(req.params.id)
      const deployment = await deploySvc.trigger(application, 'manual')
      return reply.status(202).send(deployment)
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'P2025') return reply.status(404).send({ error: 'Application not found' })
      return reply.status(500).send({ error: 'Deploy failed' })
    }
  })

  app.post<{ Params: { id: string } }>('/applications/:id/stop', async (req, reply) => {
    try {
      const application = await svc.get(req.params.id)
      const result = await deploySvc.stop(application)
      return reply.send(result)
    } catch {
      return reply.status(404).send({ error: 'Application not found' })
    }
  })

  app.post<{ Params: { id: string } }>('/applications/:id/restart', async (req, reply) => {
    try {
      const application = await svc.get(req.params.id)
      const deployment = await deploySvc.trigger(application, 'manual', true)
      return reply.status(202).send(deployment)
    } catch {
      return reply.status(404).send({ error: 'Application not found' })
    }
  })
}
