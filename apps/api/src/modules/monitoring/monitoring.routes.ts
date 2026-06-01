import type { FastifyInstance } from 'fastify'
import { DockerService } from '../docker/docker.service'

export async function monitoringRoutes(app: FastifyInstance) {
  const docker = new DockerService(app.prisma)

  app.get('/monitoring/summary', async () => {
    const [
      totalApps,
      runningApps,
      stoppedApps,
      errorApps,
      failedDeployments,
      recentDeployments,
      runningContainers,
    ] = await Promise.all([
      app.prisma.application.count(),
      app.prisma.application.count({ where: { status: 'running' } }),
      app.prisma.application.count({ where: { status: 'stopped' } }),
      app.prisma.application.count({ where: { status: 'error' } }),
      app.prisma.deployment.count({ where: { status: 'failed' } }),
      app.prisma.deployment.findMany({
        take: 5,
        orderBy: { startedAt: 'desc' },
        include: { application: { select: { name: true } } },
      }),
      docker.listRunningContainers(),
    ])

    return {
      totalApps,
      runningApps,
      stoppedApps,
      errorApps,
      failedDeployments,
      runningContainers: runningContainers.length,
      recentDeployments,
    }
  })
}
