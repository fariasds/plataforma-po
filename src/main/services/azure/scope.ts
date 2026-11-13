import { AppError } from '@shared/errors'
import type { Configuration, ProcessProfile, Product } from '@shared/config/schema'
import { getActiveConfig } from '../../profile/config-loader'

/**
 * Tradução da seleção do usuário — o ID de um Produto ou de um Grupo — para o que
 * os serviços consultam no Azure (RN-GLB-01, RN-GLB-02).
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
 * Um Produto vira ele mesmo; um Grupo vira a lista dos seus Produtos, na ordem em
 * que o Grupo os cita. ID desconhecido é erro, nunca escopo vazio: o renderer pode
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

  throw new AppError(
    'SELECTION_UNKNOWN',
    `"${String(selectionId)}" não é um Produto nem um Grupo da Configuração em uso.`
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

/** Produtos com iterações próprias: os únicos que formam a Sprint unificada (RN-GLB-04). */
export function sprintProducts(config: Configuration): ResolvedProduct[] {
  return config.products
    .filter((p) => p.cadence === 'sprints')
    .map((p) => resolveProduct(p, config))
}
