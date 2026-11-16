import { AppError } from '@shared/errors'
import type { Configuration, ProcessProfile, Product } from '@shared/config/schema'
import { getActiveConfig } from '../../profile/config-loader'

/**
 * Tradução da seleção do usuário — o ID de um Produto, de um Grupo ou de uma
 * Squad inteira — para o que os serviços consultam no Azure (RN-GLB-01,
 * RN-GLB-02, RN-GLB-17).
 *
 * Nenhum serviço conhece Produto pelo nome: tudo passa por aqui, lido da
 * Configuração ativa.
 */

export interface ResolvedProduct {
  id: string
  name: string
  color: string
  /** Projeto do Azure DevOps onde os itens vivem. */
  project: string
  /** Time que fornece as iterações; `null` usa a árvore do projeto (RN-GLB-05). */
  team: string | null
  areaPaths: string[]
  excludedAreaPaths: string[]
  cadence: Product['cadence']
  processProfileId: string
  processProfile: ProcessProfile
}

export interface ResolvedScope {
  products: ResolvedProduct[]
}

/** A Configuração em uso, ou erro tipado — nenhum dashboard roda sem ela. */
export function requireActiveConfig(): Configuration {
  const config = getActiveConfig()
  if (!config) {
    throw new AppError(
      'PROFILE_MISSING',
      'Não há Configuração válida em uso. Crie um Perfil ou corrija o arquivo configuracao.json.'
    )
  }
  return config
}

function resolveProduct(product: Product, config: Configuration): ResolvedProduct {
  return {
    id: product.id,
    name: product.name,
    color: product.color,
    project: product.project,
    team: product.team ?? null,
    areaPaths: product.areaPaths,
    excludedAreaPaths: product.excludedAreaPaths,
    cadence: product.cadence,
    processProfileId: product.processProfile,
    // O schema garante a referência (RN-CFG-03).
    processProfile: config.processProfiles[product.processProfile]
  }
}

/**
 * Um Produto vira ele mesmo; um Grupo ou uma Squad vira a lista dos seus
 * Produtos, na ordem em que os cita. ID desconhecido é erro, nunca escopo vazio: o renderer pode
 * estar com uma seleção de antes da Configuração mudar.
 */
export function resolveScope(selectionId: string, config: Configuration): ResolvedScope {
  const product = config.products.find((p) => p.id === selectionId)
  if (product) return { products: [resolveProduct(product, config)] }

  const group = config.groups.find((g) => g.id === selectionId)
  if (group) {
    return {
      products: group.products.map((id) =>
        resolveProduct(
          config.products.find((p) => p.id === id)!,
          config
        )
      )
    }
  }

  const squad = config.squads.find((s) => s.id === selectionId)
  if (squad) {
    return {
      products: squad.products.map((id) =>
        resolveProduct(
          config.products.find((p) => p.id === id)!,
          config
        )
      )
    }
  }

  throw new AppError(
    'SELECTION_UNKNOWN',
    `"${String(selectionId)}" não é um Produto, Grupo ou Squad da Configuração em uso.`
  )
}

/** `resolveScope` sobre a Configuração ativa. */
export function activeScope(selectionId: string): ResolvedScope {
  return resolveScope(selectionId, requireActiveConfig())
}

/** Um Produto da Configuração ativa, pelo ID. Grupo não serve aqui. */
export function activeProduct(productId: string): ResolvedProduct {
  const config = requireActiveConfig()
  const product = config.products.find((p) => p.id === productId)
  if (!product) {
    throw new AppError(
      'SELECTION_UNKNOWN',
      `"${String(productId)}" não é um Produto da Configuração em uso.`
    )
  }
  return resolveProduct(product, config)
}

/**
 * Produtos com iterações próprias: os únicos que formam a Sprint unificada
 * (RN-GLB-04). Com uma Squad, só os dela (RN-GLB-17) — a não ser que nenhum dela
 * tenha sprint: uma Squad só de fluxo contínuo é medida pela janela dos demais,
 * como o Produto contínuo sempre foi.
 */
export function sprintProducts(
  config: Configuration,
  squadId: string | null = null
): ResolvedProduct[] {
  const all = config.products.filter((p) => p.cadence === 'sprints')
  if (squadId === null) return all.map((p) => resolveProduct(p, config))

  const squad = config.squads.find((s) => s.id === squadId)
  if (!squad) {
    throw new AppError(
      'SELECTION_UNKNOWN',
      `"${String(squadId)}" não é uma Squad da Configuração em uso.`
    )
  }
  const members = new Set(squad.products)
  const own = all.filter((p) => members.has(p.id))
  return (own.length > 0 ? own : all).map((p) => resolveProduct(p, config))
}
