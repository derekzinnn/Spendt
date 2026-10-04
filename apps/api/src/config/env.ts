import { existsSync } from 'node:fs'

import { z } from 'zod'

// Local development reads apps/api/.env; in production the variables come from the
// container environment and the file simply doesn't exist.
if (existsSync('.env')) process.loadEnvFile('.env')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Public origin of the web app, e.g. https://spendly.example.com. Used for Origin checks (Phase 1). */
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  /** Express "trust proxy" setting. Behind Caddy on the same host, "loopback" is right. */
  TRUST_PROXY: z.string().default('loopback'),
  /** Attempts per IP per 15 min on login/register/invite endpoints. */
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n' + z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
