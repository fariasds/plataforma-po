import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import data from './release-notes.json'
import {
  RELEASE_NOTES,
  releaseModalDecision,
  releaseNotesSchema,
  searchReleaseNotes,
  type ReleaseEntry
} from './release-notes'

const packageVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

describe('release-notes.json (RN-HOM-04)', () => {
  it('segue o formato', () => {
    const parsed = releaseNotesSchema.safeParse(data)
    expect(parsed.success ? 'ok' : parsed.error.issues).toBe('ok')
    expect(RELEASE_NOTES.length).toBe((data as unknown[]).length)
  })

  // Subir a versão sem escrever as novidades dela deixaria o PO sem saber o que mudou.
  it('tem a entrada da versão do package.json, no topo', () => {
    expect(RELEASE_NOTES[0]?.version).toBe(packageVersion)
  })

  it('recusa versão fora de ordem, dois destaques e details fora do destaque', () => {
    const item = { type: 'new', title: 'T', text: 'Texto' }
    const entry = (version: string, items: object[] = [item]): object => ({
      version,
      date: '2026-11-20',
      items
    })
    expect(releaseNotesSchema.safeParse([entry('1.0.0'), entry('1.1.0')]).success).toBe(false)
    expect(releaseNotesSchema.safeParse([entry('1.0.0'), entry('1.0.0')]).success).toBe(false)
    expect(
      releaseNotesSchema.safeParse([
        entry('1.0.0', [
          { ...item, highlight: true },
          { ...item, highlight: true }
        ])
      ]).success
    ).toBe(false)
    expect(
      releaseNotesSchema.safeParse([entry('1.0.0', [{ ...item, details: 'Mais' }])]).success
    ).toBe(false)
    expect(
      releaseNotesSchema.safeParse([entry('1.0.0', [{ ...item, screen: 'https://x' }])]).success
    ).toBe(false)
  })
})

const item = (title: string, extra: object = {}): ReleaseEntry['items'][number] => ({
  type: 'new',
  title,
  text: `Explicação de ${title}`,
  ...extra
})

const NOTES: ReleaseEntry[] = [
  { version: '1.4.0', date: '2026-12-01', items: [item('Quarta', { highlight: true })] },
  { version: '1.3.0', date: '2026-11-20', items: [item('Terceira', { highlight: true })] },
  { version: '1.2.1', date: '2026-11-19', items: [item('Bastidor', { type: 'improvement' })] },
  { version: '1.2.0', date: '2026-11-19', items: [item('Segunda', { highlight: true })] }
]

const versions = (decision: ReturnType<typeof releaseModalDecision>): string[] =>
  decision.open ? decision.entries.map((entry) => entry.version) : []

describe('releaseModalDecision (RN-HOM-04)', () => {
  it('quem atualizou vê a versão nova uma vez', () => {
    expect(
      versions(releaseModalDecision(NOTES, '1.3.0', { lastSeen: '1.2.1', usedBefore: true }))
    ).toEqual(['1.3.0'])
    expect(releaseModalDecision(NOTES, '1.3.0', { lastSeen: '1.3.0', usedBefore: true })).toEqual({
      open: false,
      markSeen: false
    })
  })

  it('quem pulou versões vê todas desde a última vista, até a instalada', () => {
    expect(
      versions(releaseModalDecision(NOTES, '1.3.0', { lastSeen: '1.1.0', usedBefore: true }))
    ).toEqual(['1.3.0', '1.2.1', '1.2.0'])
  })

  it('instalação nova não abre e marca a instalada como vista', () => {
    expect(releaseModalDecision(NOTES, '1.3.0', { usedBefore: false })).toEqual({
      open: false,
      markSeen: true
    })
  })

  it('quem usava antes da memória de versão vista vê só a instalada', () => {
    expect(versions(releaseModalDecision(NOTES, '1.3.0', { usedBefore: true }))).toEqual(['1.3.0'])
  })

  it('versão só de bastidor não abre o modal', () => {
    expect(releaseModalDecision(NOTES, '1.2.1', { lastSeen: '1.2.0', usedBefore: true })).toEqual({
      open: false,
      markSeen: true
    })
  })

  it('versão instalada sem entrada, ou voltar para uma mais antiga, não abre', () => {
    expect(releaseModalDecision(NOTES, '1.5.0', { lastSeen: '1.4.0', usedBefore: true }).open).toBe(
      false
    )
    expect(releaseModalDecision(NOTES, '1.2.0', { lastSeen: '1.3.0', usedBefore: true }).open).toBe(
      false
    )
  })
})

describe('searchReleaseNotes (RN-HOM-05)', () => {
  const titles = (list: ReleaseEntry[]): string[] =>
    list.flatMap((e) => e.items.map((i) => i.title))

  it('sem filtro, devolve tudo', () => {
    expect(searchReleaseNotes(NOTES, '', 'all')).toEqual(NOTES)
  })

  it('procura no texto sem diferenciar acento nem caixa', () => {
    expect(titles(searchReleaseNotes(NOTES, 'EXPLICAÇAO DE TERC', 'all'))).toEqual(['Terceira'])
  })

  it('procura pelo número da versão, com ou sem v', () => {
    expect(searchReleaseNotes(NOTES, '1.2', 'all').map((e) => e.version)).toEqual([
      '1.2.1',
      '1.2.0'
    ])
    expect(searchReleaseNotes(NOTES, 'v1.4', 'all').map((e) => e.version)).toEqual(['1.4.0'])
  })

  it('filtra por tipo e some com a versão que fica vazia', () => {
    expect(searchReleaseNotes(NOTES, '', 'improvement').map((e) => e.version)).toEqual(['1.2.1'])
    expect(searchReleaseNotes(NOTES, 'nada disso', 'all')).toEqual([])
  })
})
