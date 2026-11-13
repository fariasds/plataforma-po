#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
// Conta, nos arquivos versionados, os termos que não podem ir para a versão pública
// e os marcadores de transição. Sem --strict só informa; com --strict é portão.
//
// Cada linha da lista é uma regex. Para valer só em parte do repositório, acrescente
// ` :: ` e escopos separados por vírgula: `src/` casa pelo começo do caminho,
// `*.test.ts` pelo fim, e `!` na frente exclui. Sem escopo, vale em todo arquivo.
//
// A lista de termos vem de PO_NEUTRAL_DENYLIST (caminho de arquivo) ou de
// perfis-privados/neutral-denylist.txt. Ela não mora aqui porque publicá-la seria
// publicar justamente o que se quer esconder.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const strict = process.argv.includes('--strict')
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

const EXCLUDED_PREFIXES = ['perfis-privados/', 'docs/plano-open-source/', '.claude/commands/']
const EXCLUDED_FILES = new Set(['package-lock.json'])
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.icns',
  '.webp',
  '.bmp',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.zip',
  '.gz',
  '.7z',
  '.exe',
  '.dll',
  '.node',
  '.pdf',
  '.bin'
])

// Montado em partes para este arquivo não contar a si mesmo.
const SHIM_LABEL = 'TEMP' + '-SHIM'

function loadDenylist() {
  const path = process.env.PO_NEUTRAL_DENYLIST
    ? resolve(process.env.PO_NEUTRAL_DENYLIST)
    : resolve(root, 'perfis-privados/neutral-denylist.txt')
  if (!existsSync(path)) return { path, terms: null }

  const terms = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [source, scopeText] = line.split(' :: ')
      const scopes = (scopeText ?? '')
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean)
      return { label: source.trim(), regex: new RegExp(source.trim(), 'gi'), scopes }
    })
  return { path, terms }
}

function matchesScope(file, scope) {
  return scope.startsWith('*') ? file.endsWith(scope.slice(1)) : file.startsWith(scope)
}

/** Sem escopo vale em todo arquivo; com escopo, é preciso casar um incluso e nenhum excluso. */
function appliesTo(file, scopes = []) {
  const included = scopes.filter((scope) => !scope.startsWith('!'))
  const excluded = scopes.filter((scope) => scope.startsWith('!')).map((scope) => scope.slice(1))
  if (excluded.some((scope) => matchesScope(file, scope))) return false
  return included.length === 0 || included.some((scope) => matchesScope(file, scope))
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter((file) => !EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix)))
    .filter((file) => !EXCLUDED_FILES.has(file.split('/').pop()))
    .filter((file) => !BINARY_EXTENSIONS.has(extname(file).toLowerCase()))
}

function readText(file) {
  const full = resolve(root, file)
  if (!existsSync(full)) return null // removido do disco, ainda no índice
  const buffer = readFileSync(full)
  if (buffer.subarray(0, 8000).includes(0)) return null // binário sem extensão conhecida
  return buffer.toString('utf8')
}

const { path: denylistPath, terms } = loadDenylist()
if (!terms) {
  console.warn(`[verify:neutral] lista de termos não encontrada em ${denylistPath}.`)
  console.warn('[verify:neutral] só os marcadores de transição serão contados.')
}

const patterns = [...(terms ?? []), { label: SHIM_LABEL, regex: new RegExp(SHIM_LABEL, 'g') }]
const rows = [] // { label, file, count }

for (const file of trackedFiles()) {
  const text = readText(file)
  if (text === null) continue
  for (const { label, regex, scopes } of patterns) {
    if (!appliesTo(file, scopes)) continue
    const count = text.match(regex)?.length ?? 0
    if (count > 0) rows.push({ label, file, count })
  }
}

const total = rows.reduce((sum, row) => sum + row.count, 0)

if (rows.length > 0) {
  const labelWidth = Math.max(5, ...rows.map((row) => row.label.length))
  const fileWidth = Math.max(7, ...rows.map((row) => row.file.length))
  const line = (a, b, c) => `${a.padEnd(labelWidth)}  ${b.padEnd(fileWidth)}  ${c}`
  console.log(line('Termo', 'Arquivo', 'N'))
  console.log(line('-'.repeat(labelWidth), '-'.repeat(fileWidth), '---'))
  for (const { label, file, count } of rows) console.log(line(label, file, String(count)))
  console.log()

  console.log('Por termo:')
  for (const { label } of patterns) {
    const sum = rows.filter((row) => row.label === label).reduce((s, row) => s + row.count, 0)
    if (sum > 0) console.log(`  ${label.padEnd(labelWidth)}  ${sum}`)
  }
  console.log()
}

const shims = rows.filter((row) => row.label === SHIM_LABEL).reduce((s, row) => s + row.count, 0)
console.log(`Total: ${total} ocorrência(s) (${SHIM_LABEL}: ${shims})`)

if (strict && (total > 0 || !terms)) {
  console.error(
    !terms
      ? '[verify:neutral] --strict exige a lista de termos.'
      : '[verify:neutral] --strict: ainda há ocorrências.'
  )
  process.exit(1)
}
