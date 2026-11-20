import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { configurationSchema } from './config/schema'
import { isAggregateSelection, selectionProductIds, squadOfSelection } from './squads'

const read = (file: string): unknown => JSON.parse(readFileSync(resolve(file), 'utf8'))
const withSquads = configurationSchema.parse(read('examples/exemplo-squads.json'))
const withoutSquads = configurationSchema.parse(read('examples/exemplo-scrum.json'))

describe('RN-GLB-17 — leitura das Squads', () => {
  it('a Squad inteira vira os Produtos dela', () => {
    expect(selectionProductIds(withSquads, 'squad-digital')).toEqual(['loja', 'app'])
    expect(isAggregateSelection(withSquads, 'squad-digital')).toBe(true)
  })

  it('Produto e Grupo seguem como antes', () => {
    expect(selectionProductIds(withSquads, 'portal')).toEqual(['portal'])
    expect(isAggregateSelection(withSquads, 'portal')).toBe(false)
    expect(selectionProductIds(withoutSquads, 'digital')).toEqual(['loja', 'app'])
  })

  it('cada seleção sabe a Squad a que pertence', () => {
    expect(squadOfSelection(withSquads, 'squad-digital')).toBe('squad-digital')
    expect(squadOfSelection(withSquads, 'app')).toBe('squad-digital')
    expect(squadOfSelection(withSquads, 'backoffice')).toBe('squad-interno')
  })

  it('sem Squads, nenhuma seleção pertence a Squad', () => {
    expect(squadOfSelection(withoutSquads, 'loja')).toBeNull()
  })
})
