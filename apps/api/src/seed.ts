/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const username = process.env.ADMIN_USERNAME ?? 'admin'
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(12).toString('hex')

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    console.error(`User "${username}" already exists. Delete it first or use a different ADMIN_USERNAME.`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { username, passwordHash, role: 'admin' },
    select: { id: true, username: true, role: true },
  })

  console.log('Admin user created:')
  console.log(`  Username: ${user.username}`)
  console.log(`  Password: ${password}`)
  console.log(`  Role:     ${user.role}`)
  if (!process.env.ADMIN_PASSWORD) {
    console.log('\nSave this password — it will not be shown again.')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
