import { readdirSync, readFileSync } from 'fs'
import { join, relative, sep } from 'path'
import { describe, expect, it } from 'vitest'

// DS-01: cor de interface sai do tema. Uma tela nova que escreve `#52C41A` direto
// cria um verde que o resto do app não usa, e a próxima mudança de paleta não a
// alcança. Ver docs/design-system.md.

const RENDERER = join(__dirname, '../../src/renderer/src')

/**
 * Onde cor literal é permitida, e por quê. Acrescentar um arquivo aqui é decisão
 * de design: diga o motivo no comentário.
 */
const ALLOWED = [
  // A fonte única de tokens.
  'theme/index.ts',
  // O desenho do logo tem as cores da marca, que não mudam com o destaque.
  'components/AppLogo.tsx',
  // Paleta própria de uma feature (cores do Azure nos gráficos, risco da Daily).
  /^features\/[^/]+\/constants\.ts$/,
  // Sugestões de cor para um Produto novo: é dado da Configuração, não interface.
  'features/onboarding/draft.ts'
]

/** Branco é a superfície e o texto sobre cor sólida; não é uma escolha de paleta. */
const ALWAYS_OK = new Set(['#FFF', '#FFFFFF'])

const HEX = /#[0-9A-Fa-f]{8}\b|#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
  })
}

function isAllowed(file: string): boolean {
  return ALLOWED.some((rule) => (typeof rule === 'string' ? rule === file : rule.test(file)))
}

/** `{ arquivo: ['linha: #COR'] }` com toda cor literal fora dos lugares permitidos. */
export function literalColors(root = RENDERER): Record<string, string[]> {
  const found: Record<string, string[]> = {}
  for (const path of sourceFiles(root)) {
    const file = relative(root, path).split(sep).join('/')
    if (isAllowed(file)) continue
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .forEach((line, index) => {
        // Comentário pode citar uma cor para explicar a escolha.
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
        for (const match of line.match(HEX) ?? []) {
          if (ALWAYS_OK.has(match.toUpperCase())) continue
          ;(found[file] ??= []).push(`${index + 1}: ${match}`)
        }
      })
  }
  return found
}

describe('DS-01: cores saem do tema', () => {
  it('nenhuma tela ou componente escreve cor literal', () => {
    expect(literalColors()).toEqual({})
  })

  it('a varredura enxerga cor literal (a barreira funciona)', () => {
    const fixture = join(__dirname, '__fixtures__/cor-literal')
    expect(literalColors(fixture)).toEqual({ 'Tela.tsx': ['3: #52C41A'] })
  })
})
