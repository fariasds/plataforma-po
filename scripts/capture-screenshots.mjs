#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
// Prints do README e da divulgação, tirados do Perfil de demonstração (RN-GLB-15):
// nenhum dado real aparece, porque nenhum dado real existe na pasta usada.
//
//   npm run build
//   npm run screenshots
//
// Sobe o app **já construído** (`out/`) com uma pasta `userData` temporária, nova a
// cada execução, entra em "Explorar com dados de exemplo" e salva um print de cada
// tela em `docs/imagens/`, sempre no mesmo tamanho de janela. A pasta `userData`
// verdadeira nunca é tocada: o app recebe `--user-data-dir`, e o script confere que
// o Electron obedeceu antes de clicar em qualquer coisa. Feche o app antes de rodar.

import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { _electron as electron } from 'playwright-core'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'docs', 'imagens')
const WIDTH = 1440
const HEIGHT = 900
/** Tempo para as telas buscarem no Azure fictício e os gráficos desenharem. */
const SETTLE_MS = 1500
const TIMEOUT_MS = 30_000

/**
 * Telas, na ordem do menu. O nome vira o arquivo em `docs/imagens/`. A Home aparece
 * duas vezes: antes das outras telas ela mostra os primeiros passos, e depois de
 * Planning, Daily e Review ela vira a Home de quem já usa o app (`RN-HOM-03`).
 */
const SCREENS = [
  { file: 'home-primeiros-passos.png', hash: '#/home' },
  { file: 'planning.png', hash: '#/planning' },
  { file: 'daily.png', hash: '#/daily' },
  { file: 'entregas.png', hash: '#/dashboard/sprint-delivery' },
  { file: 'bugs.png', hash: '#/dashboard/bug-analysis' },
  { file: 'configuracao.png', hash: '#/configuracao' },
  { file: 'home.png', hash: '#/home' }
]

function fail(message) {
  console.error(`[screenshots] ${message}`)
  process.exitCode = 1
}

/** Espera os indicadores de carregamento sumirem e dá um respiro para os gráficos. */
async function settle(window) {
  await window.waitForLoadState('domcontentloaded')
  await window
    .waitForFunction(() => document.querySelectorAll('.ant-spin-spinning').length === 0, null, {
      timeout: TIMEOUT_MS
    })
    .catch(() => console.warn('[screenshots] a tela ainda carregava ao fim da espera'))
  await window.waitForTimeout(SETTLE_MS)
}

async function main() {
  if (!existsSync(join(ROOT, 'out', 'main', 'index.js'))) {
    fail('não achei o app construído em out/. Rode "npm run build" antes.')
    return
  }

  const require = createRequire(import.meta.url)
  /** O pacote `electron` exporta o caminho do executável. */
  const executablePath = require('electron')
  const userData = mkdtempSync(join(tmpdir(), 'plataforma-po-prints-'))
  mkdirSync(OUT_DIR, { recursive: true })

  const app = await electron.launch({
    executablePath,
    args: [ROOT, `--user-data-dir=${userData}`],
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'production', ELECTRON_RENDERER_URL: '' },
    timeout: TIMEOUT_MS
  })

  try {
    // Antes de qualquer clique: o app está mesmo na pasta temporária?
    const actual = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
    if (resolve(actual) !== resolve(userData)) {
      fail(`o app abriu em ${actual}, e não na pasta temporária. Nada foi capturado.`)
      return
    }

    const window = await app.firstWindow({ timeout: TIMEOUT_MS })
    await app.evaluate(
      ({ BrowserWindow }, size) => {
        const [main] = BrowserWindow.getAllWindows()
        main.setContentSize(size.width, size.height)
        main.center()
      },
      { width: WIDTH, height: HEIGHT }
    )

    // Primeira execução: a pasta é nova, então as portas de entrada aparecem.
    const demoDoor = window.getByText('Explorar com dados de exemplo')
    await demoDoor.waitFor({ timeout: TIMEOUT_MS })
    await settle(window)
    await window.screenshot({ path: join(OUT_DIR, 'primeira-execucao.png') })

    await demoDoor.click()
    await window.getByText('Dados fictícios de demonstração').waitFor({ timeout: TIMEOUT_MS })

    for (const screen of SCREENS) {
      await window.evaluate((hash) => {
        window.location.hash = hash
      }, screen.hash)
      // O cursor parado sobre o card do usuário abre o menu dele no print, e a
      // rolagem da tela anterior sobrevive à troca de rota: zera os dois.
      // A tela ainda pode rolar enquanto carrega, por isso o topo vem depois da espera.
      // O cursor fica sobre o título da página, onde nada reage ao mouse.
      await settle(window)
      await window.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        window.scrollTo(0, 0)
      })
      await window.mouse.move(WIDTH / 2, 130)
      await window.waitForTimeout(300)
      await window.screenshot({ path: join(OUT_DIR, screen.file) })
      console.log(`[screenshots] ${screen.file}`)
    }
  } finally {
    await app.close().catch(() => {})
    rmSync(userData, { recursive: true, force: true })
  }

  if (!process.exitCode) console.log(`[screenshots] prints em ${OUT_DIR}`)
}

main().catch((error) => {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error))
})
