import { z } from 'zod'

export const createApplicationSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, hyphens only'),
  description: z.string().max(500).optional(),
  dockerImage: z.string().min(1).max(256),
  containerName: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
  internalPort: z.number().int().min(1).max(65535),
  externalPort: z.number().int().min(1024).max(65535),
  environment: z.record(z.string()).optional().default({}),
  webhookSecret: z.string().min(16).max(256).optional(),
})

export const updateApplicationSchema = createApplicationSchema.partial()

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>
