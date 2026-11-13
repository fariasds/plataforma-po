import { readFileSync } from 'fs'
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = resolve('src/shared')

// Só a versão vai para a janela, e não o package.json inteiro.
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string }

export default defineConfig({
  main: {
    resolve: {
      alias: { '@shared': shared }
    }
  },
  preload: {
    resolve: {
      alias: { '@shared': shared }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': shared
      }
    },
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [react()]
  }
})
