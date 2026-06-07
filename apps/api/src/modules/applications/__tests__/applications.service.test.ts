import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { ApplicationsService } from '../applications.service'

function makeMockPrisma() {
  return {
    application: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaClient
}

const baseApp = {
  id: 'app-1',
  name: 'test-app',
  description: null,
  dockerImage: 'nginx:alpine',
  containerName: 'test-app-c',
  internalPort: 80,
  externalPort: 8080,
  environment: {},
  status: 'stopped' as const,
  webhookSecret: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('ApplicationsService', () => {
  let prisma: PrismaClient
  let svc: ApplicationsService

  beforeEach(() => {
    prisma = makeMockPrisma()
    svc = new ApplicationsService(prisma)
  })

  describe('list', () => {
    it('returns applications ordered by createdAt desc', async () => {
      const apps = [{ ...baseApp, _count: { deployments: 2 } }]
      vi.mocked(prisma.application.findMany).mockResolvedValue(apps as any)

      const result = await svc.list()

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      )
      expect(result).toBe(apps)
    })
  })

  describe('get', () => {
    it('calls findUniqueOrThrow with the given id', async () => {
      vi.mocked(prisma.application.findUniqueOrThrow).mockResolvedValue(baseApp)

      const result = await svc.get('app-1')

      expect(prisma.application.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'app-1' } })
      expect(result).toBe(baseApp)
    })
  })

  describe('create', () => {
    it('creates with the provided data', async () => {
      vi.mocked(prisma.application.create).mockResolvedValue(baseApp)

      await svc.create({
        name: 'test-app',
        dockerImage: 'nginx:alpine',
        containerName: 'test-app-c',
        internalPort: 80,
        externalPort: 8080,
        environment: {},
      })

      expect(prisma.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'test-app', dockerImage: 'nginx:alpine' }),
        }),
      )
    })

    it('defaults environment to empty object when not provided', async () => {
      vi.mocked(prisma.application.create).mockResolvedValue(baseApp)

      await svc.create({
        name: 'test-app',
        dockerImage: 'nginx:alpine',
        containerName: 'test-app-c',
        internalPort: 80,
        externalPort: 8080,
        environment: {},
      })

      const callArg = vi.mocked(prisma.application.create).mock.calls[0][0]
      expect(callArg.data.environment).toEqual({})
    })
  })

  describe('update', () => {
    it('updates only the provided fields', async () => {
      vi.mocked(prisma.application.update).mockResolvedValue({ ...baseApp, dockerImage: 'nginx:1.25' })

      await svc.update('app-1', { dockerImage: 'nginx:1.25' })

      expect(prisma.application.update).toHaveBeenCalledWith({
        where: { id: 'app-1' },
        data: { dockerImage: 'nginx:1.25' },
      })
    })
  })

  describe('delete', () => {
    it('deletes the application by id', async () => {
      vi.mocked(prisma.application.delete).mockResolvedValue(baseApp)

      await svc.delete('app-1')

      expect(prisma.application.delete).toHaveBeenCalledWith({ where: { id: 'app-1' } })
    })
  })
})
