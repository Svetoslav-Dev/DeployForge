import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient, Application } from '@prisma/client'
import { DeploymentsService } from '../deployments.service'

vi.mock('../../docker/docker.service', () => ({
  DockerService: vi.fn().mockImplementation(() => ({
    deploy: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue({ success: true, message: 'stopped' }),
  })),
}))

function makeMockPrisma() {
  return {
    deployment: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
    },
    deploymentLog: {
      findMany: vi.fn(),
    },
    application: {
      update: vi.fn(),
    },
  } as unknown as PrismaClient
}

const baseApp: Application = {
  id: 'app-1',
  name: 'test-app',
  description: null,
  dockerImage: 'nginx:alpine',
  containerName: 'test-app-c',
  internalPort: 80,
  externalPort: 8080,
  environment: {},
  status: 'stopped',
  webhookSecret: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const baseDeployment = {
  id: 'dep-1',
  applicationId: 'app-1',
  status: 'pending',
  triggerType: 'manual',
  startedAt: new Date(),
  finishedAt: null,
  summary: null,
  errorMessage: null,
}

describe('DeploymentsService', () => {
  let prisma: PrismaClient
  let svc: DeploymentsService

  beforeEach(() => {
    prisma = makeMockPrisma()
    svc = new DeploymentsService(prisma)
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('returns all deployments when no applicationId provided', async () => {
      vi.mocked(prisma.deployment.findMany).mockResolvedValue([baseDeployment] as any)

      await svc.list()

      expect(prisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      )
    })

    it('filters by applicationId when provided', async () => {
      vi.mocked(prisma.deployment.findMany).mockResolvedValue([])

      await svc.list('app-1')

      expect(prisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { applicationId: 'app-1' } }),
      )
    })

    it('limits results to 50', async () => {
      vi.mocked(prisma.deployment.findMany).mockResolvedValue([])

      await svc.list()

      expect(prisma.deployment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      )
    })
  })

  describe('getLogs', () => {
    it('fetches logs ordered by timestamp ascending', async () => {
      vi.mocked(prisma.deploymentLog.findMany).mockResolvedValue([])

      await svc.getLogs('dep-1')

      expect(prisma.deploymentLog.findMany).toHaveBeenCalledWith({
        where: { deploymentId: 'dep-1' },
        orderBy: { timestamp: 'asc' },
      })
    })
  })

  describe('trigger', () => {
    it('creates a deployment record with pending status', async () => {
      vi.mocked(prisma.deployment.create).mockResolvedValue(baseDeployment as any)
      vi.mocked(prisma.application.update).mockResolvedValue(baseApp)

      await svc.trigger(baseApp, 'manual')

      expect(prisma.deployment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicationId: 'app-1',
          triggerType: 'manual',
          status: 'pending',
        }),
      })
    })

    it('sets application status to deploying', async () => {
      vi.mocked(prisma.deployment.create).mockResolvedValue(baseDeployment as any)
      vi.mocked(prisma.application.update).mockResolvedValue(baseApp)

      await svc.trigger(baseApp, 'webhook')

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { status: 'deploying' },
      })
    })

    it('returns the created deployment immediately', async () => {
      vi.mocked(prisma.deployment.create).mockResolvedValue(baseDeployment as any)
      vi.mocked(prisma.application.update).mockResolvedValue(baseApp)

      const result = await svc.trigger(baseApp, 'manual')

      expect(result).toEqual(baseDeployment)
    })
  })
})
