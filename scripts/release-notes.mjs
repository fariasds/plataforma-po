#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- JS puro, sem anotação de tipo */
/**
 * Seção "Novidades" da Release no GitHub, a partir de src/shared/release-notes.json:
 * o mesmo texto que o app mostra na Home (RN-HOM-04), para a página da Release não
 * ser uma lista de títulos de PR.
 *
 *   node scripts/release-notes.mjs <versão> <arquivo de saída>
 *
 * Roda no job de build, que tem o código; o job que cria a Release só lê o arquivo.
 * Sai com 1 se a versão não tiver entrada.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TYPE_LABEL = { new: 'Novo', improvement: 'Melhoria', fix: 'Correção' }

/** O que for marcação de Markdown no texto vira texto: o arquivo é escrito à mão. */
export function escapeMarkdown(text) {
  return text.replace(/[\\`*_[\]<>|#]/g, (c) => `\\${c}`)
}

export function releaseNotesMarkdown(entry) {
  const highlight = entry.items.find((item) => item.highlight)
  const lines = []
  if (highlight) {
    lines.push(
      `### ${escapeMarkdown(highlight.title)}`,
      '',
      escapeMarkdown(highlight.details ?? highlight.text),
      ''
    )
  }
  for (const item of entry.items) {
    if (item === highlight) continue
    lines.push(
      `- **${TYPE_LABEL[item.type]}: ${escapeMarkdown(item.title)}.** ${escapeMarkdown(item.text)}`
    )
  }
  return lines.join('\n').trim() + '\n'
}

function main([version, output]) {
  if (!version || !output) {
    console.error('Uso: node scripts/release-notes.mjs <versão> <arquivo de saída>')
    process.exit(2)
  }
  const notes = JSON.parse(
    readFileSync(new URL('../src/shared/release-notes.json', import.meta.url), 'utf8')
  )
  const entry = notes.find((candidate) => candidate.version === version)
  if (!entry) {
    console.error(
      `src/shared/release-notes.json não tem a versão ${version}. Escreva as novidades dela (RN-HOM-04).`
    )
    process.exit(1)
  }
  writeFileSync(output, releaseNotesMarkdown(entry), 'utf8')
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
