import { describe, expect, it } from 'vitest'
import { spToHours, type StoryPointsTable } from './story-points'

// Caracterização (T-02): a tabela completa de 1 a 13 que a Configuração de
// referência usa. Os números têm de continuar saindo iguais a antes.
const REFERENCE: StoryPointsTable = {
  '1': 3,
  '2': 6,
  '3': 12,
  '4': 18,
  '5': 24,
  '6': 28,
  '7': 32,
  '8': 36,
  '9': 40,
  '10': 45,
  '11': 50,
  '12': 55,
  '13': 60
}

describe('spToHours com a tabela de referência', () => {
  it('usa a tabela para valores inteiros de 1 a 13', () => {
    for (const [sp, hours] of Object.entries(REFERENCE)) {
      expect(spToHours(Number(sp), REFERENCE)).toBe(hours)
    }
    expect(spToHours(5, REFERENCE)).toBe(24)
    expect(spToHours(13, REFERENCE)).toBe(60)
  })

  it('devolve zero para ausente, zero ou negativo', () => {
    expect(spToHours(null, REFERENCE)).toBe(0)
    expect(spToHours(undefined, REFERENCE)).toBe(0)
    expect(spToHours(0, REFERENCE)).toBe(0)
    expect(spToHours(-3, REFERENCE)).toBe(0)
  })

  it('abaixo de 1 ponto, escala proporcional à primeira âncora', () => {
    expect(spToHours(0.5, REFERENCE)).toBe(1.5)
  })

  it('entre âncoras, interpola linearmente', () => {
    expect(spToHours(2.5, REFERENCE)).toBe(9)
    expect(spToHours(4.5, REFERENCE)).toBe(21)
  })

  it('acima de 13, extrapola pela inclinação do último trecho', () => {
    expect(spToHours(15, REFERENCE)).toBe(70)
    expect(spToHours(20, REFERENCE)).toBe(95)
  })
})

describe('spToHours com tabela customizada', () => {
  // Só a escala Fibonacci, fora de ordem no arquivo, como um PO escreveria.
  const custom: StoryPointsTable = { '8': 32, '1': 2, '3': 8, '2': 4, '5': 16 }

  it('lê o valor exato de cada entrada', () => {
    expect(spToHours(1, custom)).toBe(2)
    expect(spToHours(3, custom)).toBe(8)
    expect(spToHours(8, custom)).toBe(32)
  })

  it('interpola nos buracos da escala', () => {
    expect(spToHours(4, custom)).toBe(12)
    expect(spToHours(6.5, custom)).toBe(24)
  })

  it('extrapola pelo último trecho, não pelo primeiro', () => {
    // Último trecho: 5→16, 8→32, inclinação 16/3.
    expect(spToHours(13, custom)).toBe(58.7)
  })

  it('aceita chave fracionária', () => {
    expect(spToHours(0.5, { '0.5': 1, '1': 3 })).toBe(1)
    expect(spToHours(0.75, { '0.5': 1, '1': 3 })).toBe(2)
  })
})
