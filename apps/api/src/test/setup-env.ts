import { inject } from 'vitest'

// Runs before each test file — before the app's env module is imported.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = inject('databaseUrl')
process.env.LOG_LEVEL = 'silent'
process.env.WEB_ORIGIN = 'http://localhost:5173'
process.env.AUTH_RATE_LIMIT = '1000'
// The in-memory test database (PGlite) serves one connection reliably; a real Postgres
// (TEST_DATABASE_URL) can take the normal pool.
process.env.DATABASE_POOL_SIZE ??= process.env.TEST_DATABASE_URL ? '10' : '1'
