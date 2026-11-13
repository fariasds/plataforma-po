import type { Configuration, ConfigurationInput, ProcessProfile } from '@shared/config/schema'

/**
 * O rascunho que o assistente edita passo a passo e, no fim, vira a
 * Configuração. Fica separado das telas para a conversão ser testável sem React.
 */

export interface ProductDraft {
  /** Chave local da sessão: o ID pode mudar enquanto o Produto não foi salvo. */
  key: string
  id: string
  /** O PO digitou o ID: renomear o Produto não o sobrescreve mais. */
  idTouched: boolean
  /** Já existe na Configuração salva. RN-CFG-02: o ID não muda mais. */
  idLocked: boolean
  name: string
  color: string
  project: string
  team: string | null
  areaPaths: string[]
  excludedAreaPaths: string[]
  cadence: 'sprints' | 'continuous'
}

export interface GroupDraft {
  key: string
  id: string
  idTouched: boolean
  idLocked: boolean
  name: string
  /** Chaves de `ProductDraft`, não IDs: o ID do Produto ainda pode mudar. */
  products: string[]
}

export interface WizardDraft {
  organization: string
  projects: string[]
  products: ProductDraft[]
  groups: GroupDraft[]
  processProfiles: Record<string, ProcessProfile>
  /** Projeto → ID do Perfil de processo que os Produtos dele usam. */
  projectProcess: Record<string, string>
  customFields: Configuration['customFields']
  recurrentBugTag: string | null
  calendar: Configuration['calendar']
  /** O que o assistente não edita e atravessa intacto da Configuração anterior. */
  kept: Pick<Configuration, 'appearance' | 'criticality' | 'storyPoints' | 'capacityDefaults'>
}

export const SCHEMA_REF = './configuracao.schema.json'

/**
 * Cores iniciais dos Produtos, distintas entre si e com contraste para texto
 * branco. O PO troca na tela; aqui só se evita começar com todos iguais.
 */
export const PRODUCT_PALETTE = [
  '#2F6FED',
  '#7B61FF',
  '#0E9F6E',
  '#E8590C',
  '#C2255C',
  '#0B7285',
  '#5C940D',
  '#862E9C'
] as const

export function paletteColor(index: number): string {
  return PRODUCT_PALETTE[index % PRODUCT_PALETTE.length]
}

/** Mesma regra do schema (RN-CFG-02); repetida aqui só para validar na hora. */
export const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/

/** "Loja Online — Açaí" → "loja-online-acai". Começa sempre com letra. */
export function idFromName(name: string, taken: Iterable<string> = []): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 32)
    .replace(/-+$/g, '')
  const base = slug || 'produto'

  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const candidate = base.slice(0, 32 - suffix.length).replace(/-+$/, '') + suffix
    if (!used.has(candidate)) return candidate
  }
}

let sequence = 0
export function newKey(prefix: string): string {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence}`
}

/** Monta o rascunho a partir da Configuração em uso — a inicial, na primeira execução. */
export function draftFromConfig(config: Configuration): WizardDraft {
  const products: ProductDraft[] = config.products.map((product) => ({
    key: newKey('p'),
    id: product.id,
    idTouched: true,
    idLocked: true,
    name: product.name,
    color: product.color,
    project: product.project,
    team: product.team ?? null,
    areaPaths: product.areaPaths,
    excludedAreaPaths: product.excludedAreaPaths,
    cadence: product.cadence
  }))
  const keyById = new Map(products.map((p) => [p.id, p.key]))

  const projectProcess: Record<string, string> = {}
  for (const product of config.products) {
    projectProcess[product.project] ??= product.processProfile
  }

  return {
    organization: config.organization,
    projects: [...new Set(config.products.map((p) => p.project))],
    products,
    groups: config.groups.map((group) => ({
      key: newKey('g'),
      id: group.id,
      idTouched: true,
      idLocked: true,
      name: group.name,
      products: group.products.flatMap((id) => keyById.get(id) ?? [])
    })),
    processProfiles: config.processProfiles,
    projectProcess,
    customFields: config.customFields,
    recurrentBugTag: config.recurrentBugTag,
    calendar: config.calendar,
    kept: {
      appearance: config.appearance,
      criticality: config.criticality,
      storyPoints: config.storyPoints,
      capacityDefaults: config.capacityDefaults
    }
  }
}

/**
 * O rascunho na forma do arquivo. Só entram os Perfis de processo que algum
 * Produto usa, e campos vazios opcionais ficam de fora para o arquivo sair
 * enxuto para quem for lê-lo depois — o PO ou a IA dele.
 */
export function buildConfiguration(draft: WizardDraft): ConfigurationInput {
  const selected = new Set(draft.projects)
  const products = draft.products.filter((p) => selected.has(p.project))
  const idByKey = new Map(products.map((p) => [p.key, p.id]))
  const usedProfiles = new Set(products.map((p) => draft.projectProcess[p.project]))

  return {
    $schema: SCHEMA_REF,
    version: 1,
    organization: draft.organization,
    ...(draft.kept.appearance ? { appearance: draft.kept.appearance } : {}),
    processProfiles: Object.fromEntries(
      Object.entries(draft.processProfiles).filter(([id]) => usedProfiles.has(id))
    ),
    products: products.map((p) => ({
      id: p.id,
      name: p.name.trim(),
      color: p.color,
      project: p.project,
      ...(p.team ? { team: p.team } : {}),
      areaPaths: p.areaPaths,
      excludedAreaPaths: p.excludedAreaPaths,
      processProfile: draft.projectProcess[p.project],
      cadence: p.cadence
    })),
    groups: draft.groups.map((g) => ({
      id: g.id,
      name: g.name.trim(),
      products: g.products.flatMap((key) => idByKey.get(key) ?? [])
    })),
    customFields: draft.customFields,
    criticality: draft.kept.criticality,
    recurrentBugTag: draft.recurrentBugTag?.trim() || null,
    calendar: draft.calendar,
    storyPoints: draft.kept.storyPoints,
    capacityDefaults: draft.kept.capacityDefaults
  }
}

/** IDs em uso por outro item que não `key`: Produtos e Grupos dividem o mesmo filtro. */
export function idsExcept(draft: WizardDraft, key: string): string[] {
  return [...activeProducts(draft), ...draft.groups]
    .filter((item) => item.key !== key)
    .map((item) => item.id)
}

export function activeProducts(draft: WizardDraft): ProductDraft[] {
  const selected = new Set(draft.projects)
  return draft.products.filter((p) => selected.has(p.project))
}

/** Problema do ID digitado, ou `null`. Mostrado na hora, antes da revisão. */
export function idProblem(draft: WizardDraft, key: string, id: string): string | null {
  if (!ID_PATTERN.test(id)) return 'Começa com letra; só letras, números, "_" ou "-"; até 32.'
  if (idsExcept(draft, key).includes(id)) return 'Já existe outro Produto ou Grupo com este ID.'
  return null
}
