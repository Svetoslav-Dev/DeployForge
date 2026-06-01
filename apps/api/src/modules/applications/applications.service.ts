import type { PrismaClient } from '@prisma/client'
import type { CreateApplicationInput, UpdateApplicationInput } from './applications.schema'

export class ApplicationsService {
  constructor(private prisma: PrismaClient) {}

  list() {
    return this.prisma.application.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deployments: true } } },
    })
  }

  get(id: string) {
    return this.prisma.application.findUniqueOrThrow({ where: { id } })
  }

  create(data: CreateApplicationInput) {
    return this.prisma.application.create({
      data: {
        ...data,
        environment: data.environment ?? {},
      },
    })
  }

  update(id: string, data: UpdateApplicationInput) {
    return this.prisma.application.update({ where: { id }, data })
  }

  async delete(id: string) {
    await this.prisma.application.delete({ where: { id } })
  }

  getStatus(id: string) {
    return this.prisma.application.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, containerName: true },
    })
  }
}
