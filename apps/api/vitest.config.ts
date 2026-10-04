import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // One shared database → run test files one at a time.
    fileParallelism: false,
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
})
