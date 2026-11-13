#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
// Paridade entre duas capturas de `src/main/dev/snapshot.ts`: a referência (código
// antigo) e a nova. Sai com 0 quando são iguais, com 1 quando há divergência e com
// 2 quando o uso está errado ou uma pasta não é captura.
//
//   node scripts/compare-snapshots.mjs <referência> <nova> [--mapeamento <arquivo>]
//   node scripts/compare-snapshots.mjs <referência> <nova> --sem-mapeamento
//   node scripts/compare-snapshots.mjs --self-test
//
// Antes de comparar, a forma antiga vira a nova. Quem sabe como é essa tradução é a
// empresa, então ela mora num arquivo fora do repositório público
// (perfis-privados/ferramentas/compare-snapshots-mapeamento.json, ou PO_COMPARE_MAPPING):
//
//   {
//     "iterationKeys": { "<chave antiga em sprint>": "<ID do Produto>" },
//     "values": { "<texto antigo>": "<texto novo>" },
//     "fileSelections": { "<seleção antiga no nome do arquivo>": "<ID do Grupo>" }
//   }
//
// - `sprint.<chave antiga>` → `sprint.iterations.<ID do Produto>`;
// - `values` troca texto em qualquer valor;
// - `fileSelections` troca a seleção no nome do arquivo (`serviço__seleção__sprint.json`).
// Os campos que dependem de "hoje" (listados no manifest) ficam de fora. O resto é
// comparado inteiro, com números exatos: tolerância zero.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const MANIFEST = 'manifest.json'
const DEFAULT_MAPPING_FILE = 'perfis-privados/ferramentas/compare-snapshots-mapeamento.json'
const NO_MAPPING = { iterationKeys: {}, values: {}, fileSelections: {} }

class UsageError extends Error {}

/** Tradução da forma antiga para a nova; trocada por `main` e pelo autoteste. */
let mapping = NO_MAPPING

function loadMapping(file) {
  const raw = readJson(file)
  for (const key of ['iterationKeys', 'values', 'fileSelections']) {
    const section = raw[key] ?? {}
    if (section === null || typeof section !== 'object' || Array.isArray(section)) {
      throw new UsageError(`${file}: "${key}" precisa ser um objeto`)
    }
  }
  return {
    iterationKeys: raw.iterationKeys ?? {},
    values: raw.values ?? {},
    fileSelections: raw.fileSelections ?? {}
  }
}

function explainMissingMapping(file) {
  return [
    `o arquivo de mapeamento não existe: ${file}`,
    'Ele diz como a captura de referência (formato antigo) vira o formato novo, e fica fora',
    'do repositório público. Crie-o com este formato:',
    '  { "iterationKeys": { "<chave antiga em sprint>": "<ID do Produto>" },',
    '    "values": { "<texto antigo>": "<texto novo>" },',
    '    "fileSelections": { "<seleção antiga no nome do arquivo>": "<ID do Grupo>" } }',
    'Para comparar duas capturas que já têm a mesma forma, passe --sem-mapeamento.'
  ].join('\n')
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new UsageError(`não consegui ler ${file}: ${error.message}`)
  }
}

function readManifest(dir) {
  const file = join(dir, MANIFEST)
  if (!existsSync(file)) throw new UsageError(`${dir} não tem ${MANIFEST}: não é uma captura`)
  const manifest = readJson(file)
  if (!Array.isArray(manifest.files)) throw new UsageError(`${file} não lista "files"`)
  return manifest
}

/** `serviço__seleção__sprint.json`, com a seleção antiga trocada pela nova. */
function normalizeFileName(name) {
  const parts = name.split('__')
  if (parts.length !== 3) return name
  const [service, selection, rest] = parts
  return [service, mapping.fileSelections[selection] ?? selection, rest].join('__')
}

function isIterationRef(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof value.path === 'string' &&
    typeof value.name === 'string'
  )
}

/** Forma antiga → nova, em qualquer profundidade. */
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'string') return mapping.values[value] ?? value
  if (value === null || typeof value !== 'object') return value

  const out = {}
  const iterations = {}
  for (const [key, child] of Object.entries(value)) {
    if (key in mapping.iterationKeys && (isIterationRef(child) || child === undefined)) {
      if (child) iterations[mapping.iterationKeys[key]] = normalize(child)
      continue
    }
    out[key] = normalize(child)
  }
  if (Object.keys(iterations).length > 0) {
    out.iterations = { ...iterations, ...(out.iterations ?? {}) }
  }
  return out
}

/** "a.b", "items[*].x" → segmentos; "*" casa qualquer índice de array. */
function parsePattern(pattern) {
  return pattern
    .replace(/\[\*\]/g, '.*')
    .split('.')
    .filter(Boolean)
}

function matchesIgnored(path, patterns) {
  return patterns.some(
    (pattern) =>
      pattern.length <= path.length &&
      pattern.every((segment, i) => segment === '*' || segment === String(path[i]))
  )
}

function formatPath(path) {
  return (
    path.reduce(
      (acc, segment) =>
        typeof segment === 'number' ? `${acc}[${segment}]` : acc ? `${acc}.${segment}` : segment,
      ''
    ) || '(raiz)'
  )
}

function describe(value) {
  const text = JSON.stringify(value)
  return text === undefined ? 'ausente' : text.length > 80 ? `${text.slice(0, 77)}...` : text
}

/** Diferenças entre dois valores já normalizados, como `{ path, expected, actual }`. */
function diff(expected, actual, ignored, path = [], out = []) {
  if (matchesIgnored(path, ignored)) return out

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const length = Math.max(expected.length, actual.length)
    for (let i = 0; i < length; i++) diff(expected[i], actual[i], ignored, [...path, i], out)
    return out
  }

  const bothObjects =
    expected !== null &&
    actual !== null &&
    typeof expected === 'object' &&
    typeof actual === 'object' &&
    !Array.isArray(expected) &&
    !Array.isArray(actual)
  if (bothObjects) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
    for (const key of [...keys].sort()) {
      diff(expected[key], actual[key], ignored, [...path, key], out)
    }
    return out
  }

  // Object.is: tolerância zero, e NaN igual a NaN.
  if (!Object.is(expected, actual)) out.push({ path: formatPath(path), expected, actual })
  return out
}

function ignoredFor(file, ...manifests) {
  const service = file.split('__')[0]
  const patterns = manifests.flatMap((m) => m.dateDependentFields?.[service] ?? [])
  return [...new Set(patterns)].map(parsePattern)
}

/**
 * Compara duas pastas de captura. Devolve as divergências por arquivo e os avisos
 * (o que não reprova, como arquivo que só a captura nova tem).
 */
export function compareSnapshots(referenceDir, newDir) {
  const reference = readManifest(referenceDir)
  const current = readManifest(newDir)

  const referenceFiles = new Map(reference.files.map((f) => [normalizeFileName(f), f]))
  // A nova também passa pela normalização: a comparação de uma captura antiga com
  // ela mesma precisa dar zero.
  const currentFiles = new Map(current.files.map((f) => [normalizeFileName(f), f]))
  const divergences = []
  const warnings = []

  for (const [file, originalName] of referenceFiles) {
    if (!currentFiles.has(file)) {
      const failed = (current.errors ?? []).find((e) => normalizeFileName(e.file) === file)
      divergences.push({
        file,
        path: '(arquivo)',
        expected: 'presente',
        actual: failed ? `erro ${failed.code}: ${failed.message}` : 'ausente'
      })
      continue
    }
    const expected = normalize(readJson(join(referenceDir, originalName)))
    const actual = normalize(readJson(join(newDir, currentFiles.get(file))))
    for (const d of diff(expected, actual, ignoredFor(file, reference, current))) {
      divergences.push({ file, ...d })
    }
  }

  for (const file of currentFiles.keys()) {
    if (!referenceFiles.has(file)) warnings.push(`${file}: só existe na captura nova`)
  }
  for (const error of reference.errors ?? []) {
    warnings.push(`${error.file}: a referência não tem este arquivo (${error.code})`)
  }

  return { compared: referenceFiles.size, divergences, warnings }
}

function report({ compared, divergences, warnings }) {
  for (const warning of warnings) console.log(`aviso: ${warning}`)
  if (divergences.length === 0) {
    console.log(`Paridade: ${compared} arquivo(s) comparado(s), nenhuma divergência.`)
    return 0
  }
  const byFile = new Map()
  for (const d of divergences) byFile.set(d.file, [...(byFile.get(d.file) ?? []), d])
  for (const [file, list] of byFile) {
    console.log(`\n${file} — ${list.length} divergência(s)`)
    for (const d of list) {
      console.log(`  ${d.path}: referência ${describe(d.expected)} · nova ${describe(d.actual)}`)
    }
  }
  console.log(
    `\nParidade QUEBRADA: ${divergences.length} divergência(s) em ${byFile.size} de ${compared} arquivo(s).`
  )
  return 1
}

// ─── Autoteste ───────────────────────────────────────────────────────────────

function writeCapture(dir, manifest, files) {
  mkdirSync(dir)
  writeFileSync(join(dir, MANIFEST), JSON.stringify(manifest))
  for (const [name, data] of Object.entries(files))
    writeFileSync(join(dir, name), JSON.stringify(data))
}

function selfTest() {
  const root = mkdtempSync(join(tmpdir(), 'po-compare-'))
  const dirs = { ref: join(root, 'ref'), same: join(root, 'same'), other: join(root, 'other') }
  const checks = []
  const check = (label, ok) => checks.push({ label, ok })
  const previousMapping = mapping
  mapping = {
    iterationKeys: { loja: 'LOJA', app: 'APP' },
    values: { 'DIGITAL ANTIGO': 'DIGITAL' },
    fileSelections: { TODOS: 'DIGITAL', 'DIGITAL ANTIGO': 'DIGITAL' }
  }

  try {
    const dateDependentFields = { daily: ['currentDay', 'items[*].risk'] }
    const iteration = (name) => ({ id: `id-${name}`, name, path: `Contoso\\${name}` })

    // Referência na forma antiga.
    const refFiles = {
      'sprint-delivery__DIGITAL__2026-09-14_2026-09-25.json': {
        totalInSprint: 12,
        sprint: { key: 'k', loja: iteration('Loja 10'), app: iteration('App 4') },
        typeDistribution: [{ name: 'Bug', value: 3 }]
      },
      'daily__TODOS__2026-09-14_2026-09-25.json': {
        currentDay: 3,
        items: [{ id: 1, product: 'LOJA', risk: 'on-track', storyPoints: 5 }],
        label: 'DIGITAL ANTIGO'
      }
    }
    const refManifest = { files: Object.keys(refFiles), errors: [], dateDependentFields }

    // Mesma captura na forma nova, com "hoje" diferente.
    const sameFiles = {
      'sprint-delivery__DIGITAL__2026-09-14_2026-09-25.json': {
        totalInSprint: 12,
        sprint: { key: 'k', iterations: { LOJA: iteration('Loja 10'), APP: iteration('App 4') } },
        typeDistribution: [{ name: 'Bug', value: 3 }]
      },
      'daily__DIGITAL__2026-09-14_2026-09-25.json': {
        currentDay: 7,
        items: [{ id: 1, product: 'LOJA', risk: 'over-sprint', storyPoints: 5 }],
        label: 'DIGITAL'
      }
    }
    const sameManifest = { files: Object.keys(sameFiles), errors: [], dateDependentFields }

    // Um número diferente em uma casa decimal e um arquivo faltando.
    const otherFiles = {
      'sprint-delivery__DIGITAL__2026-09-14_2026-09-25.json': {
        ...sameFiles['sprint-delivery__DIGITAL__2026-09-14_2026-09-25.json'],
        typeDistribution: [{ name: 'Bug', value: 3.0001 }]
      }
    }
    const otherManifest = { files: Object.keys(otherFiles), errors: [], dateDependentFields }

    writeCapture(dirs.ref, refManifest, refFiles)
    writeCapture(dirs.same, sameManifest, sameFiles)
    writeCapture(dirs.other, otherManifest, otherFiles)

    const same = compareSnapshots(dirs.ref, dirs.same)
    check(
      'capturas iguais depois de normalizar: nenhuma divergência',
      same.divergences.length === 0
    )
    check('capturas iguais: os dois arquivos foram comparados', same.compared === 2)

    const other = compareSnapshots(dirs.ref, dirs.other)
    check(
      'número diferente é divergência (tolerância zero)',
      other.divergences.some((d) => d.path === 'typeDistribution[0].value')
    )
    check(
      'arquivo que falta na captura nova é divergência',
      other.divergences.some(
        (d) => d.file.startsWith('daily__DIGITAL__') && d.path === '(arquivo)'
      )
    )

    // O código de saída vem do relatório; a saída dele não interessa aqui.
    const log = console.log
    console.log = () => {}
    let exitSame, exitOther
    try {
      exitSame = report(same)
      exitOther = report(other)
    } finally {
      console.log = log
    }
    check('o relatório sai com 0 quando não há divergência', exitSame === 0)
    check('o relatório sai com 1 quando há divergência', exitOther === 1)
  } finally {
    mapping = previousMapping
    rmSync(root, { recursive: true, force: true })
  }

  for (const { label, ok } of checks) console.log(`${ok ? 'ok  ' : 'FALHOU'} ${label}`)
  const failed = checks.filter((c) => !c.ok).length
  console.log(failed ? `\nAutoteste: ${failed} falha(s).` : '\nAutoteste: tudo certo.')
  return failed ? 1 : 0
}

// ─── Linha de comando ────────────────────────────────────────────────────────

function main(args) {
  if (args[0] === '--self-test') return selfTest()
  if (args.filter((a) => !a.startsWith('--')).length < 2) {
    console.error('Uso: node scripts/compare-snapshots.mjs <referência> <nova> [--mapeamento <arquivo>]')
    console.error('     node scripts/compare-snapshots.mjs --self-test')
    return 2
  }
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
    const flag = args.findIndex((a) => a === '--mapeamento')
    const positional = args.filter((a, i) => !a.startsWith('--') && (flag < 0 || i !== flag + 1))
    if (positional.length !== 2) {
      console.error('Uso: node scripts/compare-snapshots.mjs <referência> <nova>')
      return 2
    }
    if (!args.includes('--sem-mapeamento')) {
      const file = resolve(
        flag >= 0 ? args[flag + 1] : (process.env.PO_COMPARE_MAPPING ?? join(root, DEFAULT_MAPPING_FILE))
      )
      if (!existsSync(file)) throw new UsageError(explainMissingMapping(file))
      mapping = loadMapping(file)
    }
    return report(compareSnapshots(positional[0], positional[1]))
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Erro: ${error.message}`)
      return 2
    }
    throw error
  }
}

process.exitCode = main(process.argv.slice(2))
