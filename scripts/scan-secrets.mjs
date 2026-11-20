#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
/**
 * RN-SEC-28: nenhuma credencial entra no repositório.
 *
 * Uma varredura só, usada em três lugares:
 *
 *   node scripts/scan-secrets.mjs            todos os arquivos do repositório (CI, em todo PR)
 *   node scripts/scan-secrets.mjs <pasta>    todos os arquivos de outra pasta (destino da exportação, T-21)
 *   node scripts/scan-secrets.mjs --staged   só as linhas adicionadas no stage (hook de pre-commit)
 *
 * As formas são as da RN-SEC-19 (`src/main/security/redact.ts`) e da RN-CFG-05
 * (`src/shared/config/secrets.ts`). A saída diz arquivo, linha e forma, **nunca o
 * valor**: no CI o log é público, e repetir o token ali seria vazá-lo de novo.
 *
 * Sai com 1 se encontrar algo, e com 0 se não.
 */
import { execFileSync } from 'node:child_process'
import { closeSync, fstatSync, openSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** As bordas evitam casar dentro de palavras maiores, como os hashes do package-lock. */
export const SECRET_SHAPES = [
  { name: 'PAT clássico do Azure DevOps', pattern: /(^|[^A-Za-z0-9])[a-z2-7]{52}([^A-Za-z0-9]|$)/ },
  {
    name: 'PAT do Azure DevOps',
    pattern: /(^|[^A-Za-z0-9])[A-Za-z0-9]{76}AZDO[A-Za-z0-9]{4}([^A-Za-z0-9]|$)/
  },
  { name: 'token do GitHub', pattern: /(^|[^A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36}([^A-Za-z0-9]|$)/ },
  {
    name: 'token granular do GitHub',
    pattern: /(^|[^A-Za-z0-9])github_pat_[A-Za-z0-9_]{60,}([^A-Za-z0-9]|$)/
  },
  {
    name: 'credencial em cabeçalho Basic ou Bearer',
    pattern: /\b(Basic|Bearer)\s+[A-Za-z0-9+/=._~-]{20,}/
  },
  {
    name: 'valor literal de Authorization',
    pattern: /Authorization["']?\s*[:=]\s*["']?[A-Za-z0-9+/=._~-]{20,}/i
  }
]

/** Arquivos que nunca entram, qualquer que seja o conteúdo. */
export const BLOCKED_FILE = /(^|\/)(pat\.bin|\.env(\..+)?)$/

/** Acima disso não é código nem documento: é artefato, e não deveria estar aqui. */
const MAX_FILE_BYTES = 5 * 1024 * 1024
const SKIPPED_DIRS = new Set(['.git', 'node_modules'])

/** Linhas (1, 2, ...) e formas encontradas num texto. */
export function scanText(text) {
  const findings = []
  text.split(/\r?\n/).forEach((line, index) => {
    for (const shape of SECRET_SHAPES) {
      if (shape.pattern.test(line)) findings.push({ line: index + 1, shape: shape.name })
    }
  })
  return findings
}

function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0)
}

/**
 * Conteúdo do arquivo, ou `null` se ele não deve ser varrido. Checagem e leitura
 * usam o mesmo descritor: com `stat` e leitura pelo caminho, o arquivo pode ser
 * trocado entre as duas, e o tamanho checado deixa de ser o do que foi lido.
 */
function readCandidate(full) {
  let fd
  try {
    fd = openSync(full, 'r')
  } catch {
    return null // apagado no disco mas ainda no índice
  }
  try {
    const stat = fstatSync(fd)
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null
    return readFileSync(fd)
  } finally {
    closeSync(fd)
  }
}

/** Varre arquivos dados por caminho relativo a `root`. */
export function scanFiles(root, files) {
  const findings = []
  for (const file of files) {
    const path = file.replace(/\\/g, '/')
    if (BLOCKED_FILE.test(path)) {
      findings.push({ file: path, line: 0, shape: 'arquivo de credencial' })
      continue
    }
    const buffer = readCandidate(join(root, file))
    if (!buffer || isBinary(buffer)) continue
    for (const finding of scanText(buffer.toString('utf8')))
      findings.push({ file: path, ...finding })
  }
  return findings
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function walk(root, dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED_DIRS.has(entry.name)) return []
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(root, full)
    return entry.isFile() ? [relative(root, full)] : []
  })
}

/**
 * Num repositório git: tudo o que está versionado ou viria a ser (não ignorado).
 * Fora de um: todos os arquivos da pasta, menos `.git` e `node_modules`.
 */
export function listFiles(root) {
  try {
    const inside = git(['rev-parse', '--is-inside-work-tree'], root).trim() === 'true'
    const top = resolve(git(['rev-parse', '--show-toplevel'], root).trim())
    if (inside && top === resolve(root)) {
      return git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], root)
        .split('\0')
        .filter(Boolean)
    }
  } catch {
    // não é repositório git
  }
  return walk(root)
}

/** Só as linhas adicionadas no stage, com o número da linha no arquivo novo. */
export function scanStaged(root) {
  const findings = []
  const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], root)
    .split('\0')
    .filter(Boolean)
  for (const name of names) {
    if (BLOCKED_FILE.test(name))
      findings.push({ file: name, line: 0, shape: 'arquivo de credencial' })
  }

  const diff = git(
    ['diff', '--cached', '-U0', '--diff-filter=ACM', '--no-color', '--no-ext-diff'],
    root
  )
  let file = null
  let line = 0
  for (const row of diff.split('\n')) {
    if (row.startsWith('+++ ')) {
      file = row.slice(4).replace(/^b\//, '')
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row)
    if (hunk) {
      line = Number(hunk[1])
      continue
    }
    if (row.startsWith('+') && file) {
      for (const shape of SECRET_SHAPES) {
        if (shape.pattern.test(row.slice(1))) findings.push({ file, line, shape: shape.name })
      }
      line++
    }
  }
  return findings
}

function report(findings) {
  if (findings.length === 0) return 0
  console.error('ERRO: possível credencial no repositório (RN-SEC-28):')
  for (const { file, line, shape } of findings) {
    console.error(`  ${file}${line ? `:${line}` : ''}  ${shape}`)
  }
  console.error('')
  console.error('O valor não é mostrado de propósito. Revogue o token se ele for real:')
  console.error('o histórico do git não esquece, e apagar o arquivo não basta.')
  return 1
}

function main(args) {
  if (args[0] === '--staged') return report(scanStaged(process.cwd()))
  const root = resolve(args[0] ?? process.cwd())
  return report(scanFiles(root, listFiles(root)))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
