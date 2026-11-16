import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { configurationSchema } from '@shared/config/schema'
import { resolveScope, sprintProducts } from './scope'

const config = configurationSchema.parse(
  JSON.parse(readFileSync(resolve('examples/exemplo-squads.json'), 'utf8'))
)
const ids = (products: { id: string }[]): string[] => products.map((p) => p.id)

describe('RN-GLB-17 — escopo de Squad', () => {
  it('a Squad inteira vira os Produtos dela, na ordem em que os cita', () => {
    expect(ids(resolveScope('squad-digital', config).products)).toEqual(['loja', 'app'])
  })

  it('Produto e Grupo continuam resolvendo como antes', () => {
    expect(ids(resolveScope('portal', config).products)).toEqual(['portal'])
  })

  it('ID desconhecido é erro, nunca escopo vazio', () => {
    expect(() => resolveScope('squad-inexistente', config)).toThrow(
      /não é um Produto, Grupo ou Squad/
    )
  })

  it('as sprints de uma Squad vêm só dos Produtos dela', () => {
    expect(ids(sprintProducts(config, 'squad-parceiros'))).toEqual(['portal'])
    expect(ids(sprintProducts(config))).toEqual(['loja', 'app', 'portal', 'backoffice'])
  })

  it('Squad só de fluxo contínuo usa a janela de todos os Produtos com sprint', () => {
    const continuous = configurationSchema.parse({
      ...JSON.parse(readFileSync(resolve('examples/exemplo-squads.json'), 'utf8')),
      products: config.products.map((p) =>
        p.id === 'backoffice' ? { ...p, cadence: 'continuous' } : p
      )
    })
    expect(ids(sprintProducts(continuous, 'squad-interno'))).toEqual(['loja', 'app', 'portal'])
  })

  it('Squad desconhecida é erro', () => {
    expect(() => sprintProducts(config, 'outra')).toThrow(/não é uma Squad/)
  })
})
