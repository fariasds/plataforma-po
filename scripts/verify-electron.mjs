#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
/**
 * RN-SEC-30: varredura do Electron sem apontamento novo.
 *
 *   node scripts/verify-electron.mjs                  roda e compara com os aceites
 *   node scripts/verify-electron.mjs --sarif <arq>    idem, e guarda o SARIF (anexo da Release)
 *
 * Roda o Electronegativity da versão fixada no package.json sobre `src/`, com a
 * versão do Electron instalada. Todo apontamento precisa estar em
 * `tests/security/electronegativity-aceitos.json`, com motivo. Sai com 1 se houver
 * apontamento sem aceite ou aceite que já não aparece.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ACCEPTED_FILE = join(ROOT, 'tests/security/electronegativity-aceitos.json')
const require = createRequire(import.meta.url)

function scannerBin() {
  const pkgPath = require.resolve('@doyensec/electronegativity/package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const bin = typeof pkg.bin === 'string' ? pkg.bin : Object.values(pkg.bin)[0]
  return { path: join(dirname(pkgPath), bin), version: pkg.version }
}

function electronVersion() {
  return JSON.parse(readFileSync(require.resolve('electron/package.json'), 'utf8')).version
}

/** Chave sem linha: o aceite sobrevive a mudanças no código acima do apontamento. */
export function findingKey(check, file) {
  return `${check} ${file.replace(/\\/g, '/')}`
}

export function compare(findings, accepted) {
  const acceptedKeys = new Set(accepted.map((a) => findingKey(a.check, a.arquivo)))
  const foundKeys = new Set(findings.map((f) => findingKey(f.check, f.file)))
  return {
    unaccepted: findings.filter((f) => !acceptedKeys.has(findingKey(f.check, f.file))),
    stale: accepted.filter((a) => !foundKeys.has(findingKey(a.check, a.arquivo)))
  }
}

export function findingsFromSarif(sarif) {
  return sarif.runs.flatMap((run) =>
    (run.results ?? []).map((result) => {
      const location = result.locations?.[0]?.physicalLocation
      const uri = (location?.artifactLocation?.uri ?? '').replace(/\\/g, '/')
      return {
        check: result.ruleId,
        // Check global (ausência de algo no app inteiro) não tem arquivo. Os demais
        // vêm relativos a `src/`; a chave usa o caminho do repositório.
        file: !uri || uri.startsWith('file:') ? '(global)' : `src/${uri}`,
        line: location?.region?.startLine ?? 0
      }
    })
  )
}

function main() {
  const args = process.argv.slice(2)
  const sarifIndex = args.indexOf('--sarif')
  const sarifOut = sarifIndex >= 0 ? resolve(args[sarifIndex + 1]) : null

  const scanner = scannerBin()
  const electron = electronVersion()
  const work = mkdtempSync(join(tmpdir(), 'electronegativity-'))
  const sarifPath = join(work, 'resultado.sarif')

  try {
    execFileSync(
      process.execPath,
      [scanner.path, '-i', 'src', '-e', electron, '-r', '-v', 'false', '-o', sarifPath],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] }
    )
    const findings = findingsFromSarif(JSON.parse(readFileSync(sarifPath, 'utf8')))
    const accepted = JSON.parse(readFileSync(ACCEPTED_FILE, 'utf8')).aceitos
    const { unaccepted, stale } = compare(findings, accepted)

    if (sarifOut) copyFileSync(sarifPath, sarifOut)

    console.log(
      `[RN-SEC-30] Electronegativity ${scanner.version} · Electron ${electron} · ` +
        `${findings.length} apontamento(s), ${findings.length - unaccepted.length} aceito(s)`
    )
    for (const f of unaccepted) console.error(`  sem aceite: ${f.check} em ${f.file}:${f.line}`)
    for (const a of stale)
      console.error(`  aceite que não aparece mais: ${a.check} em ${a.arquivo}`)

    if (unaccepted.length || stale.length) {
      console.error(
        '\nCorrija o apontamento ou registre o motivo em tests/security/electronegativity-aceitos.json.'
      )
      process.exitCode = 1
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
