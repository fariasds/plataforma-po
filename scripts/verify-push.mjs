#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
/**
 * RN-SEC-32: para o GitHub só sai o que já é público por construção.
 *
 * Chamado pelo hook de pre-push (`.githooks/pre-push`) com o que o git passa a ele:
 *
 *   node scripts/verify-push.mjs <remoto> <url>
 *   entrada padrão: uma linha por ref, "<ref local> <sha local> <ref remoto> <sha remoto>"
 *
 * Recusa o push se:
 *   1. o clone guarda alguma história além da pública. O push só sai de um clone que
 *      nunca viu outra história: o que não está no disco não tem como ser enviado;
 *   2. um commit enviado não descende só da raiz pública (merge de história alheia);
 *   3. autor ou committer de commit novo não é um endereço noreply do GitHub;
 *   4. um commit novo cria um caminho que não pode ser público;
 *   5. uma linha adicionada ou uma mensagem de commit tem forma de credencial
 *      (RN-SEC-28) ou um termo da lista de termos (a mesma do `verify:neutral`).
 *
 * Cada commit novo é olhado, não só o último: um termo que entra num commit e sai no
 * seguinte continua no histórico, e o histórico público não esquece.
 *
 * A lista é obrigatória. Sem ela o push é recusado, a menos que PO_PUSH_SEM_LISTA=1,
 * para quem contribui e não tem a lista. A saída diz commit, arquivo, linha e o
 * número do termo, **nunca o termo**: o terminal pode estar sendo gravado ou
 * compartilhado.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BLOCKED_FILE, SECRET_SHAPES } from './scan-secrets.mjs'

/** Commit único que inaugurou o repositório público. Toda história enviada nasce dele. */
export const PUBLIC_ROOT = '7701d173577d42e74e1d623944a67e0326e50f32'

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
const ZERO_SHA = /^0+$/
const NOREPLY = /^[^\s@]+@users\.noreply\.github\.com$/
/** O GitHub assina como committer os squash e merges feitos pela interface dele. */
const GITHUB_COMMITTER = 'noreply@github.com'

/** Caminhos que só existem no lado privado, qualquer que seja o conteúdo. */
export const FORBIDDEN_PATHS = [
  /(^|\/)perfis-privados(\/|$)/,
  /(^|\/)docs\/plano-[^/]*(\/|$)/,
  /(^|\/)docs\/discovery(\/|$)/,
  /(^|\/)Claude outputs(\/|$)/,
  /(^|\/)dist(\/|$)/,
  BLOCKED_FILE
]

function git(args, cwd) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  })
}

function lines(text) {
  return text.split('\n').filter(Boolean)
}

/**
 * Lista de termos no formato do `verify:neutral`: uma regex por linha, `#` comenta,
 * e ` :: ` seguido de escopos separados por vírgula restringe a parte dos arquivos.
 */
export function parseDenylist(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line, index) => {
      const [source, scopeText] = line.split(' :: ')
      const scopes = (scopeText ?? '')
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean)
      return { number: index + 1, regex: new RegExp(source.trim(), 'i'), scopes }
    })
}

function matchesScope(file, scope) {
  return scope.startsWith('*') ? file.endsWith(scope.slice(1)) : file.startsWith(scope)
}

/** Mesma semântica do `verify:neutral`. Mensagem de commit (`file` nulo) só vê termo sem escopo. */
function applies(term, file) {
  if (file === null) return term.scopes.length === 0
  const included = term.scopes.filter((scope) => !scope.startsWith('!'))
  const excluded = term.scopes.filter((scope) => scope.startsWith('!')).map((s) => s.slice(1))
  if (excluded.some((scope) => matchesScope(file, scope))) return false
  return included.length === 0 || included.some((scope) => matchesScope(file, scope))
}

function scanLine(text, file, terms) {
  const found = []
  for (const shape of SECRET_SHAPES) {
    if (shape.pattern.test(text)) found.push(`forma de credencial: ${shape.name}`)
  }
  for (const term of terms) {
    if (applies(term, file) && term.regex.test(text)) found.push(`termo nº ${term.number} da lista`)
  }
  return found
}

/** Linhas adicionadas pelo commit, com arquivo e número da linha no arquivo novo. */
function addedLines(cwd, commit) {
  const parent = lines(git(['rev-list', '--parents', '-n', '1', commit], cwd))[0]
    .split(' ')
    .slice(1)[0]
  const diff = git(
    ['diff', '-U0', '--no-color', '--no-ext-diff', '--no-renames', parent ?? EMPTY_TREE, commit],
    cwd
  )
  const result = []
  let file = null
  let line = 0
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw === '+++ /dev/null' ? null : raw.slice(6)
    } else if (raw.startsWith('@@')) {
      const match = raw.match(/\+(\d+)/)
      line = match ? Number(match[1]) : 0
    } else if (raw.startsWith('+') && file !== null) {
      result.push({ file, line, text: raw.slice(1) })
      line++
    }
  }
  return result
}

function createdPaths(cwd, commit) {
  const parent = lines(git(['rev-list', '--parents', '-n', '1', commit], cwd))[0]
    .split(' ')
    .slice(1)[0]
  return lines(
    git(
      ['diff', '--name-only', '--no-renames', '--diff-filter=AMR', parent ?? EMPTY_TREE, commit],
      cwd
    )
  )
}

/**
 * Problemas que impedem o push. Lista vazia: pode enviar.
 *
 * `updates` são as linhas que o git passa ao pre-push. `terms` é `null` quando não
 * há lista; aí o push só passa com `allowWithoutList`.
 */
export function verifyPush({
  cwd,
  remote,
  updates,
  publicRoot = PUBLIC_ROOT,
  terms,
  allowWithoutList = false
}) {
  const problems = []

  if (!terms && !allowWithoutList) {
    problems.push(
      'a lista de termos não foi encontrada. Configure `git config plataforma.denylist <caminho>`;' +
        ' quem não tem a lista e só contribui define PO_PUSH_SEM_LISTA=1'
    )
  }

  const foreignRoots = lines(git(['rev-list', '--max-parents=0', '--all'], cwd)).filter(
    (root) => root !== publicRoot
  )
  if (foreignRoots.length > 0) {
    problems.push(
      `este clone guarda ${foreignRoots.length} história(s) além da pública.` +
        ' O push só sai de um clone que contém apenas a história pública'
    )
    return problems // o resto não importa: este clone não publica nada
  }

  for (const { localRef, localSha } of updates) {
    if (ZERO_SHA.test(localSha)) continue // apagar branch remota não envia conteúdo

    const roots = lines(git(['rev-list', '--max-parents=0', localSha], cwd))
    if (roots.length !== 1 || roots[0] !== publicRoot) {
      problems.push(`${localRef}: a história não nasce só da raiz pública`)
      continue
    }

    const fresh = lines(
      git(['rev-list', localSha, '--not', remote ? `--remotes=${remote}` : '--remotes'], cwd)
    )
    for (const commit of fresh) {
      const short = commit.slice(0, 7)
      const [author, committer, message] = git(
        ['log', '-1', '--format=%ae%x00%ce%x00%B', commit],
        cwd
      ).split('\0')

      if (!NOREPLY.test(author))
        problems.push(`${short}: autor não é um endereço noreply do GitHub`)
      if (!NOREPLY.test(committer) && committer !== GITHUB_COMMITTER) {
        problems.push(`${short}: committer não é um endereço noreply do GitHub`)
      }

      for (const path of createdPaths(cwd, commit)) {
        if (FORBIDDEN_PATHS.some((pattern) => pattern.test(path))) {
          problems.push(`${short}: ${path} não pode ser público`)
        }
      }

      message.split(/\r?\n/).forEach((text, index) => {
        for (const finding of scanLine(text, null, terms ?? [])) {
          problems.push(`${short}: mensagem do commit, linha ${index + 1}: ${finding}`)
        }
      })

      for (const { file, line, text } of addedLines(cwd, commit)) {
        for (const finding of scanLine(text, file, terms ?? [])) {
          problems.push(`${short}: ${file}:${line}: ${finding}`)
        }
      }
    }
  }
  return problems
}

export function parseUpdates(input) {
  return lines(input).map((line) => {
    const [localRef, localSha, remoteRef, remoteSha] = line.trim().split(/\s+/)
    return { localRef, localSha, remoteRef, remoteSha }
  })
}

function loadTerms(cwd) {
  let path = process.env.PO_NEUTRAL_DENYLIST ?? null
  if (!path) {
    try {
      path = git(['config', '--get', 'plataforma.denylist'], cwd).trim() || null
    } catch {
      path = null // `git config --get` sai com 1 quando a chave não existe
    }
  }
  if (!path) return null
  const full = resolve(cwd, path)
  // Configurada e ausente é erro, não ausência: a lista pode ter sido movida.
  if (!existsSync(full)) throw new Error(`a lista de termos configurada não existe: ${full}`)
  return parseDenylist(readFileSync(full, 'utf8'))
}

function main(args) {
  const [remote] = args
  const cwd = git(['rev-parse', '--show-toplevel'], process.cwd()).trim()
  let problems
  try {
    problems = verifyPush({
      cwd,
      remote,
      updates: parseUpdates(readFileSync(0, 'utf8')),
      terms: loadTerms(cwd),
      allowWithoutList: process.env.PO_PUSH_SEM_LISTA === '1'
    })
  } catch (error) {
    problems = [error instanceof Error ? error.message : String(error)]
  }
  if (problems.length === 0) return 0
  console.error('ERRO: push recusado (RN-SEC-32):')
  for (const problem of problems) console.error(`  ${problem}`)
  console.error('')
  console.error('Nada foi enviado. O termo encontrado não é mostrado de propósito.')
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
