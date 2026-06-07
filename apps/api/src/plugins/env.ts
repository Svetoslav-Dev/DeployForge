import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number
      DATABASE_URL: string
      NODE_ENV: string
      CORS_ORIGIN: string
      JWT_SECRET: string
    }
  }
}

export default fp(async (app: FastifyInstance) => {
  const PORT = parseInt(process.env.PORT ?? '3001', 10)
  const DATABASE_URL = process.env.DATABASE_URL
  const NODE_ENV = process.env.NODE_ENV ?? 'development'
  const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000'
  const JWT_SECRET = process.env.JWT_SECRET

  if (!DATABASE_URL) throw new Error('DATABASE_URL is required')
  if (!JWT_SECRET) throw new Error('JWT_SECRET is required')

  app.decorate('config', { PORT, DATABASE_URL, NODE_ENV, CORS_ORIGIN, JWT_SECRET })
})
