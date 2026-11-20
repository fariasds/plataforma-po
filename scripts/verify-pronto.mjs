#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
/**
 * Confere, num PR, a parte da definição de pronto que o `npm run check` não vê:
 * se a regra de negócio, o Cenário e a prova do teste de segurança acompanharam o
 * código. Ver CONTRIBUTING.md, "Definição de pronto".
 *
 *   node scripts/verify-pronto.mjs --base <ref> [--summary <arquivo>]
 *
 * O texto do PR vem da variável PR_BODY, nunca da linha de comando: ele é escrito
 * por quem abre o PR e não pode virar parte de um comando de shell.
 *
 * Uma etapa que não se aplica ao PR aparece como "não se aplica". Quando a mudança
 * de fato dispensa uma etapa (uma refatoração que não muda regra, por exemplo), o
 * PR declara isso marcando a caixa correspondente do template, e a dispensa fica
 * registrada no próprio PR para quem revisa.
 *
 * Sai com 1 se alguma etapa falhar, e com 0 se não.
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const RULE_ID = /RN-[A-Z]{3}-\d{2}/g

export const RULES_DIR = 'docs/regras-de-negocio/'

/** As caixas do template de PR. O texto precisa bater com o de .github/pull_request_template.md. */
export const WAIVERS = {
  rules: 'Sem mudança de regra de negócio',
  scenario: 'Sem mudança no que as telas mostram',
  scenarioIndependent: 'A tela mudou, mas não depende de Cenário; a lógica é provada por teste',
  securityProof: 'O teste de segurança novo falhou com a barreira desligada'
}

export function ruleIdsIn(text) {
  return [...new Set(text.match(RULE_ID) ?? [])]
}

/** Caixa marcada no texto do PR: `- [x] <texto>`, sem diferenciar maiúsculas. */
export function isChecked(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\s*[-*]\\s*\\[[xX]\\]\\s*${escaped}`, 'm').test(body)
}

/**
 * A regra a que cada linha de um documento de regras pertence: a do título
 * (`### RN-ENT-01 · ...`) ou do marcador (`**Regra (RN-ENT-04):**`) mais recente.
 * Devolve um vetor indexado pela linha (1, 2, ...).
 */
export function ruleSections(text) {
  const sections = [undefined]
  let current
  for (const line of text.split(/\r?\n/)) {
    const heading = /^#{1,4}\s/.test(line)
    const marker = line.match(/\*\*Regra \((RN-[A-Z]{3}-\d{2})\)/)
    if (heading) current = line.match(/RN-[A-Z]{3}-\d{2}/)?.[0]
    if (marker) current = marker[1]
    sections.push(current)
  }
  return sections
}

/** Linhas tocadas por um diff unificado: as novas (`+`) e as antigas (`-`). */
export function changedLines(diff) {
  const added = []
  const removed = []
  let oldLine = 0
  let newLine = 0
  for (const line of diff.split(/\r?\n/)) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (hunk) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      continue
    }
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) added.push({ number: newLine++, text: line.slice(1) })
    else if (line.startsWith('-')) removed.push({ number: oldLine++, text: line.slice(1) })
    else if (line.startsWith(' ')) {
      oldLine++
      newLine++
    }
  }
  return { added, removed }
}

/** Regras cuja seção mudou num documento: pelas linhas tocadas e pelos IDs escritos nelas. */
export function changedRuleIds({ before, after, diff }) {
  const ids = new Set()
  const { added, removed } = changedLines(diff)
  const sectionsAfter = ruleSections(after)
  const sectionsBefore = ruleSections(before)
  for (const line of added) {
    ruleIdsIn(line.text).forEach((id) => ids.add(id))
    if (sectionsAfter[line.number]) ids.add(sectionsAfter[line.number])
  }
  for (const line of removed) {
    ruleIdsIn(line.text).forEach((id) => ids.add(id))
    if (sectionsBefore[line.number]) ids.add(sectionsBefore[line.number])
  }
  return [...ids].sort()
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '')
  return match ? match.slice(1).map(Number) : undefined
}

function isGreater(next, previous) {
  const a = parseVersion(next)
  const b = parseVersion(previous)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

const isTest = (path) => /\.test\.tsx?$/.test(path)
const isProductCode = (path) =>
  path.startsWith('src/') && !isTest(path) && !path.startsWith('src/main/demo/')
const touchesScreens = (path) =>
  !isTest(path) &&
  (path.startsWith('src/renderer/src/features/') || path.startsWith('src/main/services/'))

/**
 * O veredito, sem git: recebe o que mudou e devolve uma etapa por linha.
 *
 * files: [{ status: 'A' | 'M' | 'D' | 'R', path }]
 * changedRules: IDs cuja seção mudou em docs/regras-de-negocio/
 * citedRules: IDs citados no texto do PR e nas mensagens de commit
 * version: { before, after, lock } do package.json e do package-lock.json
 */
export function evaluate({ files, changedRules, citedRules, body, version }) {
  const paths = files.map((file) => file.path)
  const items = []

  const code = paths.filter(isProductCode)
  if (code.length === 0) {
    items.push({ step: 'Regra de negócio', status: 'na', detail: 'o PR não muda código do app' })
  } else if (changedRules.length > 0) {
    items.push({
      step: 'Regra de negócio',
      status: 'ok',
      detail: `regras tocadas: ${changedRules.join(', ')}`
    })
  } else if (isChecked(body, WAIVERS.rules)) {
    items.push({
      step: 'Regra de negócio',
      status: 'ok',
      detail: `declarado no PR: "${WAIVERS.rules}"`
    })
  } else {
    items.push({
      step: 'Regra de negócio',
      status: 'fail',
      detail: `o código do app mudou e nenhuma regra em ${RULES_DIR} mudou. Atualize a regra ou marque "${WAIVERS.rules}"`
    })
  }

  const approved = paths.filter((path) => path.startsWith('tests/regression/aprovados/'))
  if (approved.length === 0) {
    items.push({
      step: 'Resultado aprovado',
      status: 'na',
      detail: 'nenhum aprovado da regressão mudou'
    })
  } else {
    const justified = citedRules.filter((id) => changedRules.includes(id))
    items.push(
      justified.length > 0
        ? {
            step: 'Resultado aprovado',
            status: 'ok',
            detail: `${approved.length} aprovado(s) mudaram, justificados por ${justified.join(', ')}`
          }
        : {
            step: 'Resultado aprovado',
            status: 'fail',
            detail: `${approved.length} aprovado(s) mudaram, mas o PR não cita uma regra que mudou junto. Aprovado que muda sem regra que muda é regressão: corrija o código, não o aprovado`
          }
    )
  }

  const screens = paths.filter(touchesScreens)
  const scenarioTouched = paths.some(
    (path) =>
      path.startsWith('src/main/demo/scenarios/') || path.startsWith('tests/regression/aprovados/')
  )
  if (screens.length === 0) {
    items.push({
      step: 'Cenário',
      status: 'na',
      detail: 'o PR não muda telas nem os serviços que as alimentam'
    })
  } else if (scenarioTouched) {
    items.push({
      step: 'Cenário',
      status: 'ok',
      detail: 'Cenário ou aprovado da regressão acompanhou a mudança'
    })
  } else if (isChecked(body, WAIVERS.scenario)) {
    items.push({ step: 'Cenário', status: 'ok', detail: `declarado no PR: "${WAIVERS.scenario}"` })
  } else if (isChecked(body, WAIVERS.scenarioIndependent)) {
    // O que a tela mostra não vem do Azure (as novidades do arquivo embarcado, a
    // tela Segurança): todo Cenário daria o mesmo resultado. A prova é um teste da
    // lógica, e ele tem de estar no PR — a caixa sozinha não basta.
    const tests = paths.filter((path) => path.startsWith('src/') && isTest(path))
    items.push(
      tests.length > 0
        ? {
            step: 'Cenário',
            status: 'ok',
            detail: `declarado no PR: "${WAIVERS.scenarioIndependent}". Testes: ${tests.join(', ')}`
          }
        : {
            step: 'Cenário',
            status: 'fail',
            detail: `marcado "${WAIVERS.scenarioIndependent}", mas nenhum teste em src/ mudou. Prove a lógica da tela num teste`
          }
    )
  } else {
    items.push({
      step: 'Cenário',
      status: 'fail',
      detail: `telas ou serviços mudaram e nenhum Cenário (src/main/demo/scenarios/) nem aprovado mudou. Cubra a mudança num Cenário ou marque "${WAIVERS.scenario}" (ou, se a tela não depende de Cenário, "${WAIVERS.scenarioIndependent}")`
    })
  }

  const newSecurityTests = files.filter(
    (file) => file.status === 'A' && /^tests\/security\/.+\.test\.ts$/.test(file.path)
  )
  if (newSecurityTests.length === 0) {
    items.push({
      step: 'Prova do teste de segurança',
      status: 'na',
      detail: 'nenhum teste de segurança novo'
    })
  } else if (isChecked(body, WAIVERS.securityProof)) {
    items.push({
      step: 'Prova do teste de segurança',
      status: 'ok',
      detail: `declarado no PR: "${WAIVERS.securityProof}"`
    })
  } else {
    items.push({
      step: 'Prova do teste de segurança',
      status: 'fail',
      detail: `teste novo em tests/security/ sem a prova de que já falhou. Desligue a barreira, veja falhar, restaure, conte no PR e marque "${WAIVERS.securityProof}"`
    })
  }

  if (version.before === version.after) {
    items.push({
      step: 'Versão',
      status: 'na',
      detail: `continua ${version.after}: integra sem gerar versão nova`
    })
  } else if (!isGreater(version.after, version.before)) {
    items.push({
      step: 'Versão',
      status: 'fail',
      detail: `${version.before} → ${version.after}: a versão nova precisa ser maior que a anterior`
    })
  } else if (version.lock !== version.after) {
    items.push({
      step: 'Versão',
      status: 'fail',
      detail: `package.json diz ${version.after} e package-lock.json diz ${version.lock}. Rode npm install para alinhar`
    })
  } else {
    items.push({
      step: 'Versão',
      status: 'ok',
      detail: `${version.before} → ${version.after}: este PR gera a versão v${version.after}`
    })
  }

  return items
}

const ICON = { ok: '✅', fail: '❌', na: '➖' }

/** A barra invertida primeiro: senão um `\|` do texto viraria `\\|` e quebraria a célula. */
export function tableCell(text) {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')
}

export function report(items) {
  const failed = items.some((item) => item.status === 'fail')
  const lines = [
    '<!-- pronto -->',
    '## Definição de pronto',
    '',
    failed
      ? '**Falta etapa.** O que precisa mudar está na coluna da direita.'
      : '**Tudo cumprido.**',
    '',
    '| | Etapa | Detalhe |',
    '|---|---|---|',
    ...items.map((item) => `| ${ICON[item.status]} | ${item.step} | ${tableCell(item.detail)} |`),
    '',
    'Os portões técnicos (compilação, testes, segurança, credenciais, build) são o check `check`, na lista de checks do PR.'
  ]
  return lines.join('\n') + '\n'
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function show(ref, path) {
  try {
    return git(['show', `${ref}:${path}`])
  } catch {
    return ''
  }
}

export function collect(base) {
  const mergeBase = git(['merge-base', base, 'HEAD']).trim()
  const files = git(['diff', '--name-status', '--no-renames', `${mergeBase}`, 'HEAD'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split('\t')
      return { status: status[0], path }
    })

  const changedRules = new Set()
  for (const file of files) {
    if (!file.path.startsWith(RULES_DIR) || file.path.endsWith('README.md')) continue
    const diff = git(['diff', '-U0', mergeBase, 'HEAD', '--', file.path])
    changedRuleIds({
      before: show(mergeBase, file.path),
      after: show('HEAD', file.path),
      diff
    }).forEach((id) => changedRules.add(id))
  }

  const body = process.env.PR_BODY ?? ''
  const messages = git(['log', '--format=%B', `${mergeBase}..HEAD`])
  const json = (text) => {
    try {
      return JSON.parse(text)
    } catch {
      return {}
    }
  }
  const version = {
    before: json(show(mergeBase, 'package.json')).version,
    after: json(show('HEAD', 'package.json')).version,
    lock: json(show('HEAD', 'package-lock.json')).version
  }

  return {
    files,
    changedRules: [...changedRules].sort(),
    citedRules: ruleIdsIn(`${body}\n${messages}`),
    body,
    version
  }
}

function main(argv) {
  const option = (name) => {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
  }
  const base = option('--base')
  if (!base) {
    console.error('Uso: node scripts/verify-pronto.mjs --base <ref> [--summary <arquivo>]')
    return 2
  }
  const items = evaluate(collect(base))
  const text = report(items)
  process.stdout.write(text)
  const summary = option('--summary')
  if (summary) writeFileSync(summary, text, 'utf8')
  return items.some((item) => item.status === 'fail') ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2))
}
