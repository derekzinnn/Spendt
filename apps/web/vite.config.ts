import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      // Same-origin in dev too: the browser talks to Vite, Vite forwards /api to Express.
      proxy: {
        '/api': { target: env.API_PROXY_TARGET ?? 'http://localhost:3333', changeOrigin: false },
      },
    },
  }
})
