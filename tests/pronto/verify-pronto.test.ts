import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  changedRuleIds,
  evaluate,
  isChecked,
  report,
  tableCell,
  WAIVERS
} from '../../scripts/verify-pronto.mjs'

// O verificador da definição de pronto (scripts/verify-pronto.mjs), sem git: cada
// caso descreve o que um PR mudou e confere a etapa que ele deveria acusar.

type File = { status: string; path: string }

const SAME_VERSION = { before: '1.2.0', after: '1.2.0', lock: '1.2.0' }

function verdict(
  input: Partial<{
    files: File[]
    changedRules: string[]
    citedRules: string[]
    body: string
    version: { before: string; after: string; lock: string }
  }>
): Record<string, { status: string; detail: string }> {
  const items = evaluate({
    files: [],
    changedRules: [],
    citedRules: [],
    body: '',
    version: SAME_VERSION,
    ...input
  })
  return Object.fromEntries(items.map((item) => [item.step, item]))
}

const code = { status: 'M', path: 'src/main/services/azure/sprint-delivery.ts' }
const checked = (label: string): string => `## Checklist\n\n- [x] ${label}\n`

describe('regra de negócio', () => {
  it('não se aplica quando o PR não muda código do app', () => {
    const result = verdict({ files: [{ status: 'M', path: 'README.md' }] })
    expect(result['Regra de negócio'].status).toBe('na')
  })

  it('não conta teste nem Cenário como código do app', () => {
    const result = verdict({
      files: [
        { status: 'M', path: 'src/main/services/azure/sprint-delivery.test.ts' },
        { status: 'A', path: 'src/main/demo/scenarios/novo.ts' }
      ]
    })
    expect(result['Regra de negócio'].status).toBe('na')
  })

  it('falha quando o código muda e nenhuma regra muda', () => {
    expect(verdict({ files: [code] })['Regra de negócio'].status).toBe('fail')
  })

  it('passa quando uma regra mudou junto', () => {
    const result = verdict({ files: [code], changedRules: ['RN-ENT-04'] })
    expect(result['Regra de negócio']).toMatchObject({ status: 'ok' })
    expect(result['Regra de negócio'].detail).toContain('RN-ENT-04')
  })

  it('aceita a dispensa marcada no PR, e só marcada', () => {
    expect(
      verdict({ files: [code], body: checked(WAIVERS.rules) })['Regra de negócio'].status
    ).toBe('ok')
    const unchecked = `- [ ] ${WAIVERS.rules}`
    expect(verdict({ files: [code], body: unchecked })['Regra de negócio'].status).toBe('fail')
  })
})

describe('resultado aprovado', () => {
  const approved = { status: 'M', path: 'tests/regression/aprovados/squads/daily.json' }

  it('falha quando o aprovado muda sem regra citada que mudou junto', () => {
    expect(verdict({ files: [approved] })['Resultado aprovado'].status).toBe('fail')
    const citedButUnchanged = verdict({ files: [approved], citedRules: ['RN-ENT-04'] })
    expect(citedButUnchanged['Resultado aprovado'].status).toBe('fail')
  })

  it('passa quando o PR cita a regra que mudou', () => {
    const result = verdict({
      files: [approved],
      changedRules: ['RN-GLB-17'],
      citedRules: ['RN-GLB-17']
    })
    expect(result['Resultado aprovado'].status).toBe('ok')
  })
})

describe('Cenário', () => {
  const screen = { status: 'M', path: 'src/renderer/src/features/daily/DailyScreen.tsx' }

  it('falha quando a tela muda sem Cenário nem aprovado', () => {
    expect(verdict({ files: [screen] })['Cenário'].status).toBe('fail')
  })

  it('passa com Cenário, com aprovado ou com a dispensa', () => {
    const scenario = { status: 'A', path: 'src/main/demo/scenarios/novo.ts' }
    expect(verdict({ files: [screen, scenario] })['Cenário'].status).toBe('ok')
    const approved = { status: 'M', path: 'tests/regression/aprovados/squads/daily.json' }
    expect(verdict({ files: [screen, approved] })['Cenário'].status).toBe('ok')
    expect(verdict({ files: [screen], body: checked(WAIVERS.scenario) })['Cenário'].status).toBe(
      'ok'
    )
  })

  it('tela que não depende de Cenário passa com a caixa e um teste no PR', () => {
    const body = checked(WAIVERS.scenarioIndependent)
    const test = { status: 'A', path: 'src/shared/release-notes.test.ts' }
    expect(verdict({ files: [screen, test], body })['Cenário']).toMatchObject({
      status: 'ok',
      detail: expect.stringContaining('src/shared/release-notes.test.ts')
    })
  })

  it('a caixa de tela sem Cenário não basta sem teste em src/', () => {
    const body = checked(WAIVERS.scenarioIndependent)
    const outside = { status: 'M', path: 'tests/esteira/release-notes.test.ts' }
    expect(verdict({ files: [screen], body })['Cenário'].status).toBe('fail')
    expect(verdict({ files: [screen, outside], body })['Cenário'].status).toBe('fail')
  })
})

describe('template do PR', () => {
  // O script procura as caixas pelo texto: se o template mudar sozinho, a dispensa
  // marcada deixa de ser reconhecida.
  it('tem uma caixa para cada dispensa', () => {
    const template = readFileSync(
      new URL('../../.github/pull_request_template.md', import.meta.url),
      'utf8'
    )
    for (const label of Object.values(WAIVERS)) expect(template).toContain(`- [ ] ${label}`)
  })
})

describe('prova do teste de segurança', () => {
  const added = { status: 'A', path: 'tests/security/rn-sec-99-exemplo.test.ts' }

  it('só se aplica a teste de segurança novo', () => {
    const changed = { status: 'M', path: 'tests/security/rn-sec-18-fronteira-de-rede.test.ts' }
    expect(verdict({ files: [changed] })['Prova do teste de segurança'].status).toBe('na')
  })

  it('exige a caixa de prova marcada', () => {
    expect(verdict({ files: [added] })['Prova do teste de segurança'].status).toBe('fail')
    const result = verdict({ files: [added], body: checked(WAIVERS.securityProof) })
    expect(result['Prova do teste de segurança'].status).toBe('ok')
  })
})

describe('versão', () => {
  it('sem versão nova, integra sem gerar versão', () => {
    expect(verdict({})['Versão'].status).toBe('na')
  })

  it('passa quando sobe e o package-lock acompanha', () => {
    const result = verdict({ version: { before: '1.2.0', after: '1.3.0', lock: '1.3.0' } })
    expect(result['Versão']).toMatchObject({ status: 'ok' })
    expect(result['Versão'].detail).toContain('v1.3.0')
  })

  it('falha quando desce, quando não é número de versão ou quando o lock diverge', () => {
    expect(
      verdict({ version: { before: '1.2.0', after: '1.1.9', lock: '1.1.9' } })['Versão'].status
    ).toBe('fail')
    expect(
      verdict({ version: { before: '1.2.0', after: '1.3', lock: '1.3' } })['Versão'].status
    ).toBe('fail')
    expect(
      verdict({ version: { before: '1.2.0', after: '1.3.0', lock: '1.2.0' } })['Versão'].status
    ).toBe('fail')
  })
})

describe('regras tocadas num documento', () => {
  const before = [
    '# Entregas',
    '',
    '### RN-ENT-01 · Entrega pelo histórico',
    '',
    'Texto antigo.',
    '',
    '- **Regra (RN-ENT-04):** itens entregues.',
    '- Caso de borda antigo.'
  ].join('\n')

  it('atribui a linha editada à regra da seção, mesmo sem o ID na linha', () => {
    const after = before.replace('Texto antigo.', 'Texto novo.')
    const diff = '@@ -5 +5 @@\n-Texto antigo.\n+Texto novo.\n'
    expect(changedRuleIds({ before, after, diff })).toEqual(['RN-ENT-01'])
  })

  it('reconhece o marcador **Regra (...)** como início de seção', () => {
    const after = before.replace('Caso de borda antigo.', 'Caso de borda novo.')
    const diff = '@@ -8 +8 @@\n-- Caso de borda antigo.\n+- Caso de borda novo.\n'
    expect(changedRuleIds({ before, after, diff })).toEqual(['RN-ENT-04'])
  })
})

describe('caixas e relatório', () => {
  it('reconhece a caixa com x maiúsculo e com asterisco', () => {
    expect(isChecked(`* [X] ${WAIVERS.rules}`, WAIVERS.rules)).toBe(true)
    expect(isChecked(`- [ ] ${WAIVERS.rules}`, WAIVERS.rules)).toBe(false)
  })

  it('a célula da tabela escapa a barra invertida antes do separador', () => {
    expect(tableCell('a|b')).toBe('a\\|b')
    expect(tableCell('a\\|b')).toBe('a\\\\\\|b')
  })

  it('o relatório leva o marcador do comentário fixo e uma linha por etapa', () => {
    const text = report(
      evaluate({ files: [code], changedRules: [], citedRules: [], body: '', version: SAME_VERSION })
    )
    expect(text.startsWith('<!-- pronto -->')).toBe(true)
    expect(text).toContain('**Falta etapa.**')
    expect(text.match(/^\| (✅|❌|➖) \|/gm)).toHaveLength(5)
  })
})
