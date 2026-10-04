import { inject } from 'vitest'

// Runs before each test file — before the app's env module is imported.
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = inject('databaseUrl')
process.env.LOG_LEVEL = 'silent'
process.env.WEB_ORIGIN = 'http://localhost:5173'
process.env.AUTH_RATE_LIMIT = '1000'
