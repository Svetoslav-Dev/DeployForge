import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup-integration.ts'],
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run integration tests serially to avoid DB conflicts
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
})
