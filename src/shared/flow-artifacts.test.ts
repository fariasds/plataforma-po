import { describe, expect, it } from 'vitest'
import { expandRuleIds, parseFeatureFolder, type FeatureFolderFiles } from './flow-artifacts'

// RN-FLX-04: o app lê só as linhas que os modelos do processo rule-first têm.
// Dados fictícios: organização `contoso`, Produto "Loja Online".

const BRIEF = `# Brief — Pagamento por Pix

Feature: #4102 · Produto: Loja Online · Atualizado: 2026-11-20

## 1. Problema
O cliente chega ao pagamento, não encontra Pix e abandona o pedido.

## 2. Para quem
Cliente da Loja Online no checkout.

## 3. Evidências
- Feedback #5214

## 4. Como é hoje
Hoje a RN-PAG-012 aceita só cartão e boleto.

## 5. Objetivo e métrica
<O que muda para o usuário e como vamos saber que resolveu.>

## 6. Escopo
- Pix à vista no checkout

**Não-escopo**
- Pix parcelado

## 7. Requisitos
- **R1** · O cliente paga à vista por Pix no checkout
  Decisões: D1 · RNs impactadas (orientação para a quebra): RN-PAG-012 (altera)
- **R2** · O pedido é liberado quando o pagamento é confirmado
  Decisões: D1, D2 · RNs impactadas: nova em PAG
- **R3** · Pedido com Pix não pago expira no prazo
  Decisões: D2

## 9. Perguntas em aberto
- [x] **P1** · Vale para o app? — **Respondida:** não, só no site.
- [ ] **P2** · O QR expira em quanto tempo? — \`bloqueia a quebra\`
- [ ] **P3** · Estorno parcial? — \`não bloqueia\`
- [ ] **P4** · Precisa de aviso por e-mail?
- [ ] <pergunta> — \`bloqueia a quebra\` / \`não bloqueia\`
`

const DECISIONS = `# Registro de Decisões — Pagamento por Pix

### D1 · Pix só à vista
\`Status: Aceita\` · \`Decidido por: PO\` · \`Data: 2026-11-18\`

**Contexto:** ...

### D2 · O QR expira em 30 minutos
\`Status: Proposta\` · \`Decidido por: —\` · \`Data: 2026-11-19\`

### D3 · Avisar o cliente por e-mail
\`Status: Aprovada\` · \`Decidido por: PO\` · \`Data: 2026-11-19\`

### D4 · Substituída
\`Status: Substituída por D2\` · \`Decidido por: PO\` · \`Data: 2026-11-10\`

### D5 · <A escolha, em uma frase>
\`Status: Proposta\`
`

const PLAN = `# Plano de PBIs — Pagamento por Pix

## PBIs

### P1 · DEV · Gerar o QR Code Pix no checkout
Azure: #4211 · Status: Escrito (aprovado pelo PO em 20/11) · Arquivo: \`PBI-4211-qr-pix.md\`
**Como** cliente, **Quero** pagar com Pix, **Para** concluir a compra.
Requisitos: R1 · Decisões: D1 · Depende de: —
RNs: RN-PAG-012, 016 a 018 (nova); RN-PED-021 (RN-NOT-009 só no catálogo)

### P2 · DEV · Liberar o pedido com o pagamento confirmado
Azure: #a criar · Status: Planejado · Arquivo: —
Requisitos: R2 · Decisões: D1, D2 · Depende de: P1
RNs (preenchido na task de feature, Passo 2): —

### P3 · DESIGN · Cliente não sabe quanto tempo tem para pagar o Pix — checkout
Azure: — · Status: Cancelado (coberto pelo P2) · Arquivo: —
Requisitos: R3 · Decisões: D2

### P4 · TESTE · Testar o Pix
Azure: #4299 · Status: Planejado

### P5 · AJUSTE VISUAL · Trocar o botão de pagamento pelo novo
Azure: #4214 · Status: Revisar
Requisitos: R1

## Cobertura Requisito → PBI
| Requisito | PBI(s) | Observação |
|---|---|---|
| R1 | P1 | |
| R2 | P2 | |
| R3 | — | vira estudo na próxima fase |
`

function folder(overrides: Partial<FeatureFolderFiles> = {}): FeatureFolderFiles {
  return {
    slug: 'pagamento-pix',
    files: ['README.md', 'discovery/brief.md', 'discovery/decisoes.md', 'plano-pbis.md'],
    readme: '# Pagamento por Pix no checkout\n\nFase: Pronta para quebra\nFeature: #4102 — link\n',
    brief: BRIEF,
    decisions: DECISIONS,
    plan: PLAN,
    ...overrides
  }
}

describe('expandRuleIds: as abreviações do PO', () => {
  it('o prefixo continua nos números soltos', () => {
    expect(expandRuleIds('RN-DOC-045, 041, 043; RN-PED-045')).toEqual([
      'RN-DOC-045',
      'RN-DOC-041',
      'RN-DOC-043',
      'RN-PED-045'
    ])
  })

  it('"a" é faixa, com o mesmo número de dígitos', () => {
    expect(expandRuleIds('RN-PED-050 a 053')).toEqual([
      'RN-PED-050',
      'RN-PED-051',
      'RN-PED-052',
      'RN-PED-053'
    ])
  })

  it('o que está entre parênteses é observação', () => {
    expect(
      expandRuleIds('RN-DOC-080 (nova); RN-PED-045 (RN-NOT-013 só no catálogo, PO 27/10)')
    ).toEqual(['RN-DOC-080', 'RN-PED-045'])
  })

  it('o prefixo com subdomínio também continua', () => {
    expect(expandRuleIds('RN-ELN-APP-001, 003 a 004')).toEqual([
      'RN-ELN-APP-001',
      'RN-ELN-APP-003',
      'RN-ELN-APP-004'
    ])
  })

  it('"—" e texto sem regra não dão nada', () => {
    expect(expandRuleIds('—')).toEqual([])
    expect(expandRuleIds('Passo 2 de 4')).toEqual([])
  })
})

describe('README', () => {
  it('ID da Feature, título e a linha Fase, que o app só mostra', () => {
    const parsed = parseFeatureFolder(folder())
    expect(parsed).toMatchObject({
      featureId: 4102,
      draft: false,
      title: 'Pagamento por Pix no checkout',
      readmePhase: 'Pronta para quebra',
      archived: null
    })
  })

  it('"#a criar" é rascunho; "Arquivada:" arquiva com data e motivo', () => {
    const draft = parseFeatureFolder(
      folder({
        readme:
          '# Lista de presentes\nFeature: #a criar\nArquivada: 2026-11-01 · cliente desistiu\n'
      })
    )
    expect(draft.draft).toBe(true)
    expect(draft.featureId).toBeNull()
    expect(draft.archived).toEqual({ date: '2026-11-01', reason: 'cliente desistiu' })
  })

  it('"Feature:" fora do padrão vira linha não reconhecida', () => {
    const parsed = parseFeatureFolder(folder({ readme: '# X\nFeature: 4102\n' }))
    expect(parsed.unrecognized.filter((u) => u.file === 'README.md')).toEqual([
      expect.objectContaining({ file: 'README.md', line: 2 })
    ])
  })

  it('pasta só com o README, e pasta sem discovery/', () => {
    expect(parseFeatureFolder(folder({ files: ['README.md'] })).onlyReadme).toBe(true)
    const legacy = parseFeatureFolder(
      folder({ files: ['README.md', 'PBI-1.md'], brief: null, plan: null })
    )
    expect(legacy.hasDiscovery).toBe(false)
    expect(legacy.onlyReadme).toBe(false)
  })
})

describe('Brief', () => {
  const brief = parseFeatureFolder(folder()).brief!

  it('seção com só o texto do modelo conta como vazia', () => {
    expect(brief.sections).toEqual({ problem: true, audience: true, objective: false, scope: true })
  })

  it('Requisitos com as Decisões de origem e as regras impactadas', () => {
    expect(brief.requirements).toEqual([
      { key: 'R1', decisions: ['D1'], rules: ['RN-PAG-012'] },
      { key: 'R2', decisions: ['D1', 'D2'], rules: [] },
      { key: 'R3', decisions: ['D2'], rules: [] }
    ])
  })

  it('toda regra citada pelo ID, para conferir no catálogo', () => {
    expect(brief.citations).toEqual(['RN-PAG-012'])
  })

  it('pergunta respondida, que bloqueia, que não bloqueia e sem marca; o modelo fica de fora', () => {
    expect(brief.questions.map((q) => [q.answered, q.blocks])).toEqual([
      [true, null],
      [false, true],
      [false, false],
      [false, null]
    ])
    expect(brief.questions[1].line).toBe(36)
  })
})

describe('Registro de Decisões', () => {
  const parsed = parseFeatureFolder(folder())

  it('status e data; Substituída por Dn é status', () => {
    expect(parsed.decisions).toEqual([
      { key: 'D1', line: 3, status: 'Aceita', date: '2026-11-18' },
      { key: 'D2', line: 8, status: 'Proposta', date: '2026-11-19' },
      { key: 'D4', line: 14, status: 'Substituída', date: '2026-11-10' }
    ])
  })

  it('status desconhecido é linha não reconhecida, com o número da linha', () => {
    expect(parsed.unrecognized).toContainEqual(
      expect.objectContaining({ file: 'discovery/decisoes.md', line: 12 })
    )
  })
})

describe('Plano de PBIs', () => {
  const parsed = parseFeatureFolder(folder())
  const plan = parsed.plan!

  it('tipo, ID do Azure, status, Requisitos, Decisões e regras', () => {
    expect(plan.pbis).toEqual([
      expect.objectContaining({
        key: 'P1',
        type: 'DEV',
        azureId: 4211,
        status: 'Escrito',
        requirements: ['R1'],
        decisions: ['D1'],
        rules: ['RN-PAG-012', 'RN-PAG-016', 'RN-PAG-017', 'RN-PAG-018', 'RN-PED-021']
      }),
      expect.objectContaining({ key: 'P2', azureId: null, status: 'Planejado', rules: [] }),
      expect.objectContaining({ key: 'P3', type: 'DESIGN', azureId: null, status: 'Cancelado' })
    ])
  })

  it('tipo e status desconhecidos são linhas não reconhecidas, e o PBI fica de fora', () => {
    const lines = parsed.unrecognized.filter((u) => u.file === 'plano-pbis.md').map((u) => u.line)
    expect(lines).toEqual([20, 24])
  })

  it('a cobertura justifica o Requisito sem PBI', () => {
    expect(plan.justified).toEqual(['R3'])
  })
})
