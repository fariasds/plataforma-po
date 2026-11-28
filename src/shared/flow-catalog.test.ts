import { describe, expect, it } from 'vitest'
import { DEFAULT_RULE_ID_PATTERN } from './config/schema'
import {
  buildCatalogIndex,
  contentHash,
  diffRules,
  parseCatalogPage,
  ruleCatalog
} from './flow-catalog'
import { applyAbsorb, filesToPublish, pageFile, planAbsorb, type AbsorbBase } from './flow-absorb'

// RN-CAT-02, RN-CAT-03, RN-CAT-06. Dados fictícios: organização `contoso`, Produto
// "Loja Online". O formato é o do catálogo do processo rule-first.

const CUPONS = `# Cupons (CUP)

## Visão geral do domínio
Texto livre.

| RN | Título |
|----|--------|
| RN-CUP-004 | Cupom por categoria |

### RN-CUP-004 · Cupom por categoria do produto
\`Status: Ativa\` · \`Validação: Não validada\` · \`Origem: 4230; 4231 (extensão — app)\` · \`Relacionadas: RN-CUP-001\` · \`Atualizado: 2026-11-20\`

**Descrição:** O cupom vale para a categoria.
**Comportamento:** ...
- Atualizações:
  - 2026-11-20 · PBI #4232: passa a valer no app.

### RN-CUP-001 · Um cupom por pedido
\`Status: Descontinuada\` · \`Validação: Validada (2026-09-01)\` · \`Origem: PBI #3100\` · \`Atualizado: 2026-09-01\`

**Descrição:** ...
`

describe('parseCatalogPage: a regra pelo título (RN-CAT-02)', () => {
  const page = parseCatalogPage('Cupons.md', CUPONS, DEFAULT_RULE_ID_PATTERN)

  it('título da página, e cada regra com os metadados', () => {
    expect(page.title).toBe('Cupons (CUP)')
    expect(page.rules.map((r) => [r.id, r.title, r.status, r.validation, r.updated])).toEqual([
      ['RN-CUP-004', 'Cupom por categoria do produto', 'Ativa', 'Não validada', '2026-11-20'],
      ['RN-CUP-001', 'Um cupom por pedido', 'Descontinuada', 'Validada', '2026-09-01']
    ])
  })

  it('Origem sem o que está entre parênteses, e os PBIs das Atualizações', () => {
    expect(page.rules[0].origins).toEqual([4230, 4231])
    expect(page.rules[0].updates).toEqual([4232])
    expect(page.rules[1].origins).toEqual([3100])
  })

  it('a tabela de varredura não é regra; outro padrão de ID também funciona', () => {
    expect(page.rules).toHaveLength(2)
    const other = parseCatalogPage('x.md', '### REG.12 · Outra forma\n', 'REG\\.\\d+')
    expect(other.rules.map((r) => r.id)).toEqual(['REG.12'])
    // O padrão de fábrica aceita subdomínio.
    const sub = parseCatalogPage('y.md', '### RN-ELN-APP-001 · Login\n', DEFAULT_RULE_ID_PATTERN)
    expect(sub.rules.map((r) => r.id)).toEqual(['RN-ELN-APP-001'])
  })

  it('o resumo da regra muda quando o texto dela muda, e não com o CRLF', () => {
    const crlf = parseCatalogPage(
      'Cupons.md',
      CUPONS.replace(/\n/g, '\r\n'),
      DEFAULT_RULE_ID_PATTERN
    )
    expect(crlf.rules[0].hash).toBe(page.rules[0].hash)
    const edited = parseCatalogPage(
      'Cupons.md',
      CUPONS.replace('O cupom vale para a categoria.', 'O cupom vale para a categoria e a marca.'),
      DEFAULT_RULE_ID_PATTERN
    )
    expect(diffRules(page, edited)).toEqual({ added: [], changed: ['RN-CUP-004'], removed: [] })
  })
})

describe('o índice do catálogo', () => {
  it('ID repetido entre páginas é apontado; vale o primeiro', () => {
    const a = parseCatalogPage('a.md', '### RN-CUP-004 · A\n', DEFAULT_RULE_ID_PATTERN)
    const b = parseCatalogPage('b.md', '### RN-CUP-004 · B\n', DEFAULT_RULE_ID_PATTERN)
    const index = buildCatalogIndex([a, b])
    expect(index.duplicates).toEqual(['RN-CUP-004'])
    expect(index.rules.get('RN-CUP-004')?.file).toBe('a.md')
  })

  it('o quadro consulta Origem e Atualizações juntas', () => {
    const index = buildCatalogIndex([
      parseCatalogPage('Cupons.md', CUPONS, DEFAULT_RULE_ID_PATTERN)
    ])
    expect(ruleCatalog(index).origins('RN-CUP-004')).toEqual([4230, 4231, 4232])
    expect(ruleCatalog(index).origins('RN-CUP-999')).toBeNull()
  })
})

describe('pageFile', () => {
  it('o caminho abaixo da raiz vira o arquivo; a raiz não', () => {
    expect(pageFile('/Catálogo/Loja', '/Catálogo/Loja/Cupons (CUP)')).toBe('Cupons (CUP).md')
    expect(pageFile('/Catálogo/Loja/', '/Catálogo/Loja/Pedidos/Retirada')).toBe(
      'Pedidos/Retirada.md'
    )
    expect(pageFile('/Catálogo/Loja', '/Catálogo/Loja')).toBeNull()
    expect(pageFile('/Catálogo/Loja', '/Catálogo/App/Login')).toBeNull()
  })

  it('caractere que o Windows recusa vira hífen, e não sobra caminho para cima', () => {
    expect(pageFile('/C', '/C/Pedido: prazo?')).toBe('Pedido- prazo-.md')
    expect(pageFile('/C', '/C/../segredos')).toBeNull()
  })
})

describe('planAbsorb e applyAbsorb (RN-CAT-03)', () => {
  const ROOT = '/Catálogo/Loja'
  const v1 = '### RN-CUP-004 · Cupom\nv1\n'
  const v2 = '### RN-CUP-004 · Cupom\nv2\n'
  const base: AbsorbBase = {
    version: 1,
    absorbedAt: '2026-11-01T10:00:00.000Z',
    source: { wiki: 'Loja.wiki', rootPage: ROOT },
    pages: {
      '/Catálogo/Loja/Igual': { file: 'Igual.md', hash: contentHash(v1) },
      '/Catálogo/Loja/Wiki': { file: 'Wiki.md', hash: contentHash(v1) },
      '/Catálogo/Loja/Local': { file: 'Local.md', hash: contentHash(v1) },
      '/Catálogo/Loja/Ambos': { file: 'Ambos.md', hash: contentHash(v1) },
      '/Catálogo/Loja/Saiu': { file: 'Saiu.md', hash: contentHash(v1) }
    }
  }
  const wiki = [
    { path: '/Catálogo/Loja/Igual', content: v1 },
    { path: '/Catálogo/Loja/Wiki', content: v2 },
    { path: '/Catálogo/Loja/Local', content: v1 },
    { path: '/Catálogo/Loja/Ambos', content: v2 },
    { path: '/Catálogo/Loja/Nova', content: v1 }
  ]
  const local = {
    'Igual.md': v1,
    'Wiki.md': v1,
    'Local.md': '### RN-CUP-004 · Cupom\nlocal\n',
    'Ambos.md': '### RN-CUP-004 · Cupom\nlocal\n',
    'Saiu.md': v1,
    'Rascunho.md': '### RN-CUP-010 · Nova regra\n'
  }
  const plan = planAbsorb(ROOT, wiki, local, base, DEFAULT_RULE_ID_PATTERN)

  it('cada página com o que mudou de cada lado', () => {
    expect(plan.pages.map((p) => [p.file, p.status])).toEqual([
      ['Ambos.md', 'conflict'],
      ['Igual.md', 'unchanged'],
      ['Local.md', 'local-changed'],
      ['Nova.md', 'new'],
      ['Saiu.md', 'removed-in-wiki'],
      ['Wiki.md', 'changed']
    ])
    expect(plan.localOnly).toEqual(['Rascunho.md'])
    expect(plan.pages.find((p) => p.file === 'Wiki.md')?.rules.changed).toEqual(['RN-CUP-004'])
  })

  it('entra o novo e o mudado só na wiki; o conflito, só se o PO escolheu a da wiki', () => {
    const now = new Date('2026-11-27T10:00:00Z')
    const kept = applyAbsorb(plan, wiki, base, base.source, new Set(), now)
    expect(kept.writes.map((w) => w.file)).toEqual(['Nova.md', 'Wiki.md'])
    expect(kept.skipped).toEqual(['/Catálogo/Loja/Ambos'])
    // A página local mudada segue com a base antiga: continua a publicar.
    expect(kept.base.pages['/Catálogo/Loja/Local'].hash).toBe(contentHash(v1))

    const taken = applyAbsorb(plan, wiki, base, base.source, new Set(['/Catálogo/Loja/Ambos']), now)
    expect(taken.writes.map((w) => w.file)).toEqual(['Ambos.md', 'Nova.md', 'Wiki.md'])
    expect(taken.base.pages['/Catálogo/Loja/Ambos'].hash).toBe(contentHash(v2))
    expect(taken.base.absorbedAt).toBe(now.toISOString())
  })
})

describe('filesToPublish (RN-CAT-06)', () => {
  it('o que difere da última absorção e o que nunca veio dela', () => {
    const base: AbsorbBase = {
      version: 1,
      absorbedAt: '',
      source: { wiki: 'Loja.wiki', rootPage: '/C' },
      pages: {
        '/C/A': { file: 'A.md', hash: contentHash('a') },
        '/C/B': { file: 'B.md', hash: contentHash('b') }
      }
    }
    expect(filesToPublish({ 'A.md': 'a', 'B.md': 'b2', 'C.md': 'c' }, base)).toEqual([
      'B.md',
      'C.md'
    ])
  })
})
