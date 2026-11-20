import { describe, expect, it } from 'vitest'
import { escapeMarkdown, releaseNotesMarkdown } from '../../scripts/release-notes.mjs'

// A seção "Novidades" da Release sai do mesmo arquivo que a Home mostra (RN-HOM-04).

describe('releaseNotesMarkdown', () => {
  it('abre pelo destaque, com o parágrafo longo, e lista o resto com o tipo', () => {
    const markdown = releaseNotesMarkdown({
      version: '1.3.0',
      date: '2026-11-20',
      items: [
        { type: 'fix', title: 'Correção', text: 'Corrigido.' },
        { type: 'new', title: 'Destaque', text: 'Curto.', details: 'Longo.', highlight: true },
        { type: 'improvement', title: 'Melhoria', text: 'Melhor.' }
      ]
    })
    expect(markdown).toBe(
      '### Destaque\n\nLongo.\n\n- **Correção: Correção.** Corrigido.\n- **Melhoria: Melhoria.** Melhor.\n'
    )
  })

  it('sem destaque, é só a lista', () => {
    expect(
      releaseNotesMarkdown({
        version: '1.2.1',
        date: '2026-11-19',
        items: [{ type: 'improvement', title: 'Bastidor', text: 'Nada muda.' }]
      })
    ).toBe('- **Melhoria: Bastidor.** Nada muda.\n')
  })

  it('o texto escrito à mão não vira marcação', () => {
    expect(escapeMarkdown('botão » e [link](x) <b>')).toBe('botão » e \\[link\\](x) \\<b\\>')
  })
})
