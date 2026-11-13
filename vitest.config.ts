import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// Mesmos aliases do electron.vite.config.ts: o código testado importa por eles.
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts']
  }
})
