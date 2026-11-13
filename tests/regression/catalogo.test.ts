import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../../src/main/demo/scenarios'

/**
 * `docs/cenarios.md` é a lista que o PO e quem contribui leem para saber o que
 * já está protegido. Ela é escrita à mão; este teste garante que não mente.
 */

interface Row {
  id: string
  regras: string[]
  telas: string[]
}

function catalogRows(): Row[] {
  const doc = readFileSync(join(__dirname, '../../docs/cenarios.md'), 'utf8')
  const section = doc.split('## Catálogo')[1]?.split(/\n## /)[0] ?? ''
  return section
    .split('\n')
    .filter((line) => /^\| `[^`]+` \|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim())
      const list = (cell: string): string[] => cell.split(',').map((v) => v.trim())
      return { id: cells[0].replace(/`/g, ''), regras: list(cells[2]), telas: list(cells[3]) }
    })
}

describe('docs/cenarios.md', () => {
  const rows = catalogRows()

  it('lista exatamente os Cenários do código, na mesma ordem', () => {
    expect(rows.map((r) => r.id)).toEqual(SCENARIOS.map((s) => s.id))
  })

  it('toda regra citada existe em docs/regras-de-negocio/', () => {
    const dir = join(__dirname, '../../docs/regras-de-negocio')
    const docs = readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => readFileSync(join(dir, file), 'utf8'))
      .join('\n')
    const cited = [...new Set(SCENARIOS.flatMap((s) => s.regras))]
    expect(cited.filter((id) => !new RegExp(`\\b${id}\\b`).test(docs))).toEqual([])
  })

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s: regras e telas iguais às do código',
    (id, scenario) => {
      const row = rows.find((r) => r.id === id)
      expect(row?.regras).toEqual(scenario.regras)
      expect(row?.telas).toEqual(scenario.telas)
    }
  )
})
