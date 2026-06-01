import type { PrismaClient, Application } from '@prisma/client'
import { DockerService } from '../docker/docker.service'

export class DeploymentsService {
  private docker: DockerService

  constructor(private prisma: PrismaClient) {
    this.docker = new DockerService(prisma)
  }

  list(applicationId?: string) {
    return this.prisma.deployment.findMany({
      where: applicationId ? { applicationId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { application: { select: { name: true } } },
    })
  }

  get(id: string) {
    return this.prisma.deployment.findUniqueOrThrow({
      where: { id },
      include: { application: { select: { name: true, containerName: true } } },
    })
  }

  getLogs(id: string) {
    return this.prisma.deploymentLog.findMany({
      where: { deploymentId: id },
      orderBy: { timestamp: 'asc' },
    })
  }

  async trigger(application: Application, triggerType: 'manual' | 'webhook' | 'system', isRestart = false) {
    const deployment = await this.prisma.deployment.create({
      data: {
        applicationId: application.id,
        triggerType,
        status: 'pending',
      },
    })

    await this.prisma.application.update({
      where: { id: application.id },
      data: { status: 'deploying' },
    })

    // Run async — do not await so the endpoint returns immediately
    this.docker.deploy(application, deployment.id, isRestart).catch(() => {})

    return deployment
  }

  async stop(application: Application) {
    return this.docker.stop(application)
  }
}
