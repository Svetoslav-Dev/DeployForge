import { describe, it, expect } from 'vitest'
import { createHmac, timingSafeEqual } from 'crypto'

// Duplicated from webhooks.routes.ts to test the algorithm in isolation
function verifyGitHubSignature(secret: string, body: string, signature: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

function makeSignature(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

describe('GitHub webhook signature verification', () => {
  const secret = 'super-secret-webhook-key'
  const body = JSON.stringify({ ref: 'refs/heads/main', repository: { name: 'my-repo' } })

  it('returns true for a valid signature', () => {
    const sig = makeSignature(secret, body)
    expect(verifyGitHubSignature(secret, body, sig)).toBe(true)
  })

  it('returns false for a tampered body', () => {
    const sig = makeSignature(secret, body)
    const tamperedBody = body + ' '
    expect(verifyGitHubSignature(secret, tamperedBody, sig)).toBe(false)
  })

  it('returns false for a wrong secret', () => {
    const sig = makeSignature('wrong-secret', body)
    expect(verifyGitHubSignature(secret, body, sig)).toBe(false)
  })

  it('returns false for a missing sha256 prefix', () => {
    const rawHex = createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyGitHubSignature(secret, body, rawHex)).toBe(false)
  })

  it('returns false for an empty signature string', () => {
    expect(verifyGitHubSignature(secret, body, '')).toBe(false)
  })

  it('returns false for a completely invalid signature', () => {
    expect(verifyGitHubSignature(secret, body, 'sha256=notahexvalue')).toBe(false)
  })

  it('is not vulnerable to short-circuit: different length signatures return false', () => {
    expect(verifyGitHubSignature(secret, body, 'sha256=abc')).toBe(false)
  })
})
