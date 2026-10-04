import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @spendly/shared ships TypeScript source, so it must be bundled into the server.
  noExternal: ['@spendly/shared'],
})
