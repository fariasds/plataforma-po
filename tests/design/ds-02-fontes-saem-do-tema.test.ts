import { readdirSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import { describe, expect, it } from 'vitest'

// DS-02: família tipográfica sai do tema. Texto corrido herda Geist do
// ConfigProvider; IDs, horas e datas usam `MONO_FONT`. Uma tela que escreve o nome
// da fonte direto sai do padrão na primeira troca de fonte. Ver docs/design-system.md.

const RENDERER = join(__dirname, '../../src/renderer/src')

const LITERAL_FONT = /fontFamily:\s*['"`]|font-family:\s*['"]?[A-Za-z]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** `{ arquivo: [linhas] }` com família tipográfica escrita fora do tema. */
export function literalFonts(root = RENDERER): Record<string, number[]> {
  const found: Record<string, number[]> = {}
  for (const path of sourceFiles(root)) {
    const file = relative(root, path).split(sep).join('/')
    if (file === 'theme/index.ts') continue
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        if (LITERAL_FONT.test(line)) (found[file] ??= []).push(index + 1)
      })
  }
  return found
}

describe('DS-02: fontes saem do tema', () => {
  it('nenhuma tela ou componente escreve a família tipográfica', () => {
    expect(literalFonts()).toEqual({})
  })

  it('a varredura enxerga fonte literal (a barreira funciona)', () => {
    const fixture = join(__dirname, '__fixtures__/fonte-literal')
    expect(literalFonts(fixture)).toEqual({ 'Tela.tsx': [2] })
  })
})
