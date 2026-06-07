import { describe, it, expect } from 'vitest'
import { createApplicationSchema, updateApplicationSchema } from '../applications.schema'

describe('createApplicationSchema', () => {
  const valid = {
    name: 'my-app',
    dockerImage: 'nginx:alpine',
    containerName: 'my-app-container',
    internalPort: 80,
    externalPort: 8080,
  }

  it('accepts a minimal valid payload', () => {
    const result = createApplicationSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('defaults environment to empty object', () => {
    const result = createApplicationSchema.safeParse(valid)
    expect(result.success && result.data.environment).toEqual({})
  })

  it('accepts optional description', () => {
    const result = createApplicationSchema.safeParse({ ...valid, description: 'A test app' })
    expect(result.success).toBe(true)
  })

  it('rejects name with uppercase letters', () => {
    const result = createApplicationSchema.safeParse({ ...valid, name: 'MyApp' })
    expect(result.success).toBe(false)
  })

  it('rejects name with spaces', () => {
    const result = createApplicationSchema.safeParse({ ...valid, name: 'my app' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = createApplicationSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 64 characters', () => {
    const result = createApplicationSchema.safeParse({ ...valid, name: 'a'.repeat(65) })
    expect(result.success).toBe(false)
  })

  it('rejects internalPort below 1', () => {
    const result = createApplicationSchema.safeParse({ ...valid, internalPort: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects internalPort above 65535', () => {
    const result = createApplicationSchema.safeParse({ ...valid, internalPort: 70000 })
    expect(result.success).toBe(false)
  })

  it('rejects externalPort below 1024 (privileged range)', () => {
    const result = createApplicationSchema.safeParse({ ...valid, externalPort: 80 })
    expect(result.success).toBe(false)
  })

  it('rejects webhookSecret shorter than 16 characters', () => {
    const result = createApplicationSchema.safeParse({ ...valid, webhookSecret: 'short' })
    expect(result.success).toBe(false)
  })

  it('accepts webhookSecret of 16+ characters', () => {
    const result = createApplicationSchema.safeParse({ ...valid, webhookSecret: 'a'.repeat(16) })
    expect(result.success).toBe(true)
  })

  it('accepts environment as key-value record', () => {
    const result = createApplicationSchema.safeParse({
      ...valid,
      environment: { NODE_ENV: 'production', PORT: '3000' },
    })
    expect(result.success).toBe(true)
  })
})

describe('updateApplicationSchema', () => {
  it('allows partial updates', () => {
    const result = updateApplicationSchema.safeParse({ dockerImage: 'nginx:1.25' })
    expect(result.success).toBe(true)
  })

  it('allows empty object (no-op update)', () => {
    const result = updateApplicationSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('still validates fields that are provided', () => {
    const result = updateApplicationSchema.safeParse({ name: 'Bad Name!' })
    expect(result.success).toBe(false)
  })
})
