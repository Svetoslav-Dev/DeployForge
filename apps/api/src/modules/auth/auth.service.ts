import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'
import type { PrismaClient } from '@prisma/client'

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async validateCredentials(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } })
    if (!user) return null

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return null

    return { id: user.id, username: user.username, role: user.role }
  }

  async createUser(username: string, password: string, role: 'admin' | 'viewer' = 'viewer') {
    const passwordHash = await bcrypt.hash(password, 12)
    return this.prisma.user.create({
      data: { username, passwordHash, role },
      select: { id: true, username: true, role: true, createdAt: true },
    })
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  async deleteUser(id: string) {
    await this.prisma.user.delete({ where: { id } })
  }

  async createRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(32).toString('hex')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
    // Prune stale tokens for this user before creating a new one
    await this.prisma.refreshToken.deleteMany({
      where: { userId, OR: [{ revoked: true }, { expiresAt: { lt: new Date() } }] },
    })
    await this.prisma.refreshToken.create({ data: { tokenHash, userId, expiresAt } })
    return token
  }

  async validateRefreshToken(token: string): Promise<{ id: string; username: string; role: string } | null> {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, username: true, role: true } } },
    })
    if (!stored || stored.revoked || stored.expiresAt < new Date()) return null
    return stored.user
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await this.prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } })
  }
}
