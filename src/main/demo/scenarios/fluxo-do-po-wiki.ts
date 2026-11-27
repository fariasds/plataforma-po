/**
 * A wiki fictícia do Cenário fluxo-do-po: o catálogo da Loja Online (ADR 0015).
 * Gerado junto com a pasta tests/regression/pastas/fluxo-do-po/loja/catalogo: a
 * cópia local e o .absorcao.json de lá conversam com estas páginas.
 */
export const CONTOSO_WIKI_PAGES: Array<{ path: string; content: string }> = [
  { path: '/Catálogo', content: '# Catálogo de Regras\n\nÍndice.\n' },
  { path: '/Catálogo/Loja', content: '# Loja Online\n\nDomínios da Loja.\n' },
  {
    path: '/Catálogo/Loja/Pagamentos',
    content:
      '# Pagamentos (PAG)\n\n## Visão geral do domínio\nRegras fictícias da Loja Online.\n\n### RN-PAG-012 · Formas de pagamento aceitas no checkout\n`Status: Ativa` · `Validação: Validada (2026-10-01)` · `Origem: PBI #3900` · `Atualizado: 2026-11-20`\n\n**Descrição:** O checkout aceita cartão e boleto.\n- Atualizações:\n  - 2026-11-20 · PBI #3950: boleto parcelado sai.\n\n### RN-PAG-015 · Limite do Pix por pedido\n`Status: Descontinuada` · `Validação: Não validada` · `Origem: PBI #3901` · `Atualizado: 2026-08-01`\n\n**Descrição:** O Pix tinha limite por pedido.\n\n### RN-PAG-016 · Pix à vista no checkout\n`Status: Ativa` · `Validação: Não validada` · `Origem: PBI #4211` · `Atualizado: 2026-11-25`\n\n**Descrição:** O cliente paga à vista por Pix.\n'
  },
  {
    path: '/Catálogo/Loja/Cupons',
    content:
      '# Cupons (CUP)\n\n## Visão geral do domínio\nRegras fictícias da Loja Online.\n\n### RN-CUP-004 · Cupom por categoria do produto\n`Status: Ativa` · `Validação: Não validada` · `Origem: PBI #3800` · `Atualizado: 2026-10-01`\n\n**Descrição:** O cupom vale para a categoria do produto.\n'
  },
  {
    path: '/Catálogo/Loja/Trocas',
    content:
      '# Trocas (TRO)\n\n## Visão geral do domínio\nRegras fictícias da Loja Online.\n\n### RN-TRO-001 · Troca sem nota fiscal\n`Status: Ativa` · `Validação: Validada (2026-11-24)` · `Origem: PBI #4061` · `Atualizado: 2026-09-10`\n\n**Descrição:** A troca aceita o pedido no lugar da nota.\n'
  },
  {
    path: '/Catálogo/Loja/Entregas',
    content:
      '# Entregas (ENT)\n\n## Visão geral do domínio\nRegras fictícias da Loja Online.\n\n### RN-ENT-001 · Prazo de entrega por região\n`Status: Ativa` · `Validação: Não validada` · `Origem: PBI #3700` · `Atualizado: 2026-07-01`\n\n**Descrição:** O prazo depende da região do CEP.\n'
  }
]
