import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- script .mjs sem declaração de tipos
import { compare, findingsFromSarif } from '../../scripts/verify-electron.mjs'

// RN-SEC-30: o portão compara a varredura do Electronegativity com os aceites.
// A varredura em si roda no `npm run verify:electron`; aqui se prova a comparação,
// que é o que decide se o portão fica vermelho.

const ROOT = resolve(__dirname, '../..')

function sarif(results: Array<{ ruleId: string; uri?: string }>): unknown {
  return {
    runs: [
      {
        results: results.map(({ ruleId, uri }) => ({
          ruleId,
          locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: 3 } } }]
        }))
      }
    ]
  }
}

describe('RN-SEC-30: varredura do Electron sem apontamento novo', () => {
  it('apontamento sem aceite reprova', () => {
    const findings = findingsFromSarif(
      sarif([{ ruleId: 'SANDBOX_JS_CHECK', uri: 'main\\index.ts' }])
    )
    const { unaccepted } = compare(findings, [])
    expect(unaccepted).toEqual([{ check: 'SANDBOX_JS_CHECK', file: 'src/main/index.ts', line: 3 }])
  })

  it('apontamento aceito passa, mesmo com a linha mudando', () => {
    const findings = findingsFromSarif(
      sarif([{ ruleId: 'PRELOAD_JS_CHECK', uri: 'main/index.ts' }])
    )
    const result = compare(findings, [{ check: 'PRELOAD_JS_CHECK', arquivo: 'src/main/index.ts' }])
    expect(result).toEqual({ unaccepted: [], stale: [] })
  })

  it('aceite que não aparece mais reprova', () => {
    const { stale } = compare(
      [],
      [{ check: 'CSP_GLOBAL_CHECK', arquivo: 'src/renderer/index.html' }]
    )
    expect(stale).toHaveLength(1)
  })

  it('check global não tem arquivo', () => {
    const findings = findingsFromSarif(
      sarif([{ ruleId: 'PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK', uri: 'file:///' }])
    )
    expect(findings[0].file).toBe('(global)')
  })

  it('todo aceite tem motivo escrito', () => {
    const { aceitos } = JSON.parse(
      readFileSync(join(ROOT, 'tests/security/electronegativity-aceitos.json'), 'utf8')
    ) as { aceitos: Array<{ check: string; arquivo: string; motivo?: string }> }
    expect(aceitos.filter((a) => !a.motivo || a.motivo.length < 40)).toEqual([])
  })
})
