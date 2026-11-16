import type { Configuration } from './config/schema'

/**
 * Leitura das Squads da Configuração (RN-GLB-17), usada pela janela e pela
 * regressão. O schema já garante que cada Produto está numa Squad só e que um
 * Grupo cabe numa Squad só (RN-CFG-03).
 */

type SquadView = Pick<Configuration, 'products' | 'groups' | 'squads'>

/**
 * Produtos de uma seleção: o Grupo e a Squad inteira viram os seus Produtos, na
 * ordem em que os citam; um Produto vira ele mesmo.
 */
export function selectionProductIds(config: SquadView, selectionId: string): string[] {
  const aggregate =
    config.groups.find((g) => g.id === selectionId) ??
    config.squads.find((s) => s.id === selectionId)
  return aggregate ? aggregate.products : [selectionId]
}

/** A seleção soma mais de um Produto (Grupo ou Squad inteira). */
export function isAggregateSelection(config: SquadView, selectionId: string): boolean {
  return (
    config.groups.some((g) => g.id === selectionId) ||
    config.squads.some((s) => s.id === selectionId)
  )
}

/**
 * Squad a que uma seleção pertence, ou `null` quando a Configuração não tem
 * Squads. Uma Squad pertence a ela mesma; um Grupo, à Squad dos seus Produtos.
 */
export function squadOfSelection(config: SquadView, selectionId: string): string | null {
  if (config.squads.length === 0) return null
  if (config.squads.some((s) => s.id === selectionId)) return selectionId
  const [first] = selectionProductIds(config, selectionId)
  return config.squads.find((s) => s.products.includes(first))?.id ?? null
}
