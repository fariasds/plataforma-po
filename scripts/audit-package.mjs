#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
/**
 * RN-SEC-13: o pacote não carrega segredo nem nada além do app.
 *
 *   node scripts/audit-package.mjs <pasta resources do app>
 *
 * A pasta é a `resources/` do app empacotado: `dist/win-unpacked/resources` depois
 * do `electron-builder`, ou a da pasta de instalação. A auditoria lê o `app.asar`
 * e o `app.asar.unpacked/` ao lado dele.
 *
 * A lista do electron-builder.yml é por exclusão, e pasta nova entra no pacote
 * sozinha. Por isso a auditoria é o contrário: uma lista do que **pode** estar no
 * pacote. O que não estiver nela é recusado, com o caminho.
 *
 * Sai com 1 se encontrar algo, e com 0 se não.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** O que pode existir na raiz do app.asar. A GPL pede que a licença acompanhe o programa. */
export const ALLOWED_ROOT = new Set(['out', 'package.json', 'LICENSE', 'node_modules', 'resources'])

/** Nunca, em lugar nenhum do pacote, nem dentro de node_modules. */
export const FORBIDDEN = [
  { name: 'arquivo de ambiente', pattern: /(^|\/)\.env(\..+)?$/ },
  { name: 'arquivo cifrado (.bin), forma do PAT guardado', pattern: /\.bin$/ },
  { name: 'dados privados', pattern: /(^|\/)perfis-privados(\/|$)/ },
  { name: 'pasta de agente', pattern: /(^|\/)\.claude(\/|$)/ },
  { name: 'repositório git', pattern: /(^|\/)\.git(\/|$)/ },
  { name: 'Configuração de alguém', pattern: /(^|\/)perfis\.json$/ }
]

/** Caminhos do pacote, com `/` e sem barra inicial, em violações. */
export function auditEntries(entries, unpacked = []) {
  const violations = []
  for (const entry of entries) {
    const root = entry.split('/')[0]
    if (!ALLOWED_ROOT.has(root)) {
      violations.push({
        path: entry,
        reason: `fora do que o pacote pode ter (${[...ALLOWED_ROOT].join(', ')})`
      })
      continue
    }
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(entry)) violations.push({ path: entry, reason: rule.name })
    }
  }
  // asarUnpack só tira resources/ do asar (electron-builder.yml).
  for (const entry of unpacked) {
    if (!entry.startsWith('resources/')) {
      violations.push({ path: `app.asar.unpacked/${entry}`, reason: 'só resources/ sai do asar' })
    }
    for (const rule of FORBIDDEN) {
      if (rule.pattern.test(entry))
        violations.push({ path: `app.asar.unpacked/${entry}`, reason: rule.name })
    }
  }
  return violations
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

/** A raiz de cada caminho do asar: `\out\main\index.js` vira `out/main/index.js`. */
const normalize = (path) => path.replace(/\\/g, '/').replace(/^\//, '')

export async function listResources(resourcesDir) {
  const asarFile = join(resourcesDir, 'app.asar')
  if (!existsSync(asarFile)) throw new Error(`não achei ${asarFile}`)
  const asar = await import('@electron/asar')
  const entries = asar.listPackage(asarFile, { isPack: false }).map(normalize).filter(Boolean)
  const unpackedDir = join(resourcesDir, 'app.asar.unpacked')
  const unpacked = existsSync(unpackedDir)
    ? walk(unpackedDir).map((path) => normalize(relative(unpackedDir, path)))
    : []
  return { entries, unpacked }
}

async function main(args) {
  if (!args[0]) {
    console.error('Uso: node scripts/audit-package.mjs <pasta resources do app>')
    return 2
  }
  const { entries, unpacked } = await listResources(resolve(args[0]))
  const violations = auditEntries(entries, unpacked)
  if (violations.length === 0) {
    console.log(
      `Pacote auditado (RN-SEC-13): ${entries.length} entradas no app.asar, ${unpacked.length} fora dele, nada indevido.`
    )
    return 0
  }
  console.error(`Pacote recusado (RN-SEC-13): ${violations.length} entrada(s) indevida(s).`)
  for (const violation of violations.slice(0, 50))
    console.error(`  ${violation.path}: ${violation.reason}`)
  if (violations.length > 50) console.error(`  ... e mais ${violations.length - 50}`)
  console.error('Exclua no electron-builder.yml o que não é do app.')
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2))
}
