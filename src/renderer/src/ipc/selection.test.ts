import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { configurationSchema, type Squad } from '@shared/config/schema'

// O módulo fala com a ponte do preload ao ser importado; aqui só a função pura importa.
vi.mock('./client', () => ({ ipc: {} }))
const { selectionOptions } = await import('./useAzure')

const read = (file: string): unknown => JSON.parse(readFileSync(resolve(file), 'utf8'))
const config = configurationSchema.parse(read('examples/exemplo-squads.json'))
const squad = (id: string): Squad => config.squads.find((s) => s.id === id)!
const ids = (options: { id: string }[]): string[] => options.map((o) => o.id)

describe('RN-GLB-02 e RN-GLB-17 — opções do filtro por Squad', () => {
  it('Squad com dois Produtos abre na Squad inteira, depois os Produtos dela', () => {
    const options = selectionOptions(config, 'review', squad('squad-digital'))
    expect(ids(options)).toEqual(['squad-digital', 'loja', 'app'])
    expect(options[0]).toMatchObject({
      name: 'Squad inteira',
      isGroup: true,
      memberColors: ['#7B61FF', '#00A58E']
    })
  })

  it('Squad com um Produto só mostra só ele', () => {
    expect(ids(selectionOptions(config, 'review', squad('squad-parceiros')))).toEqual(['portal'])
  })

  it('no Planning, a Squad inteira segue a regra do Grupo: some se tiver Produto contínuo', () => {
    const mixed = configurationSchema.parse({
      ...(read('examples/exemplo-squads.json') as object),
      products: config.products.map((p) => (p.id === 'app' ? { ...p, cadence: 'continuous' } : p))
    })
    const digital = mixed.squads.find((s) => s.id === 'squad-digital')!
    expect(ids(selectionOptions(mixed, 'planning', digital))).toEqual(['loja'])
    expect(ids(selectionOptions(mixed, 'review', digital))).toEqual([
      'squad-digital',
      'loja',
      'app'
    ])
  })

  it('sem Squad aberta, todos os Produtos e Grupos, como antes', () => {
    const plain = configurationSchema.parse(read('examples/exemplo-scrum.json'))
    expect(ids(selectionOptions(plain, 'review'))).toEqual(['loja', 'app', 'digital'])
  })
})
