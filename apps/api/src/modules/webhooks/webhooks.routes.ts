import type { FastifyInstance } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import { DeploymentsService } from '../deployments/deployments.service'

function verifyGitHubSignature(secret: string, body: string, signature: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function webhooksRoutes(app: FastifyInstance) {
  const deploySvc = new DeploymentsService(app.prisma)

  app.post<{ Params: { applicationId: string } }>(
    '/webhooks/github/:applicationId',
    {
      config: { rawBody: true },
    },
    async (req, reply) => {
      const { applicationId } = req.params
      const signature = req.headers['x-hub-signature-256'] as string | undefined

      let application
      try {
        application = await app.prisma.application.findUniqueOrThrow({ where: { id: applicationId } })
      } catch {
        return reply.status(404).send({ error: 'Application not found' })
      }

      if (application.webhookSecret) {
        if (!signature) return reply.status(401).send({ error: 'Missing signature' })
        const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)
        if (!verifyGitHubSignature(application.webhookSecret, rawBody, signature)) {
          return reply.status(401).send({ error: 'Invalid signature' })
        }
      }

      const event = req.headers['x-github-event'] as string | undefined
      if (event !== 'push') {
        return reply.send({ message: `Ignored event: ${event}` })
      }

      const deployment = await deploySvc.trigger(application, 'webhook')
      return reply.status(202).send({ message: 'Deployment triggered', deploymentId: deployment.id })
    },
  )
}
