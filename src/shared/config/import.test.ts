import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import {
  diffConfiguration,
  hasChanges,
  parseConfigurationText,
  planImport,
  removedFromDiff
} from './import'
import type { Configuration } from './schema'
import { validateConfiguration } from './validate'

// O teste altera o JSON livremente; tipar isto seria reescrever o schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = any

const exampleText = readFileSync(resolve('examples/exemplo-scrum.json'), 'utf8')

function config(change?: (draft: Draft) => void): Configuration {
  const draft = JSON.parse(exampleText)
  change?.(draft)
  const result = validateConfiguration(draft)
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.config
}

function text(change: (draft: Draft) => void): string {
  const draft = JSON.parse(exampleText)
  change(draft)
  return JSON.stringify(draft)
}

describe('diffConfiguration (RN-CFG-09)', () => {
  it('a mesma Configuração não muda nada', () => {
    const diff = diffConfiguration(config(), config())
    expect(hasChanges(diff)).toBe(false)
  })

  it('separa o que entra, o que muda e o que sai, pelo ID', () => {
    const before = config()
    const after = config((draft) => {
      draft.products[0].name = 'Loja Nova'
      draft.products.push({ ...draft.products[0], id: 'backoffice', name: 'Backoffice' })
      draft.groups = []
    })

    const diff = diffConfiguration(before, after)

    expect(diff.products.changed).toEqual([{ id: 'loja', name: 'Loja Nova' }])
    expect(diff.products.added).toEqual([{ id: 'backoffice', name: 'Backoffice' }])
    expect(diff.groups.removed.map((g) => g.id)).toEqual(before.groups.map((g) => g.id))
    expect(hasChanges(diff)).toBe(true)
  })

  it('renomear o ID é sair um e entrar outro, e o que sai aparece em removed (RN-CFG-02)', () => {
    const after = config((draft) => {
      draft.products[0].id = 'loja2'
      for (const group of draft.groups) {
        group.products = group.products.map((p: string) => (p === 'loja' ? 'loja2' : p))
      }
    })

    const diff = diffConfiguration(config(), after)

    expect(removedFromDiff(diff).products).toEqual(['loja'])
    expect(diff.products.added.map((p) => p.id)).toEqual(['loja2'])
  })

  it('aponta a seção que mudou e o Perfil de processo alterado', () => {
    const after = config((draft) => {
      draft.recurrentBugTag = '[volta]'
      const [first] = Object.keys(draft.processProfiles)
      draft.processProfiles[first].inProgressState = 'Doing'
    })

    const diff = diffConfiguration(config(), after)

    expect(diff.sections).toEqual(['recurrentBugTag'])
    expect(diff.processProfiles.changed).toHaveLength(1)
  })

  it('sem Configuração anterior, tudo entra e nenhuma seção "muda"', () => {
    const diff = diffConfiguration(null, config())
    expect(diff.products.added.length).toBeGreaterThan(0)
    expect(diff.products.removed).toEqual([])
    expect(diff.sections).toEqual([])
  })
})

describe('planImport (RN-CFG-09)', () => {
  it('aceita a mesma organização sem diferenciar maiúsculas', () => {
    const plan = planImport(
      config(),
      text((draft) => {
        draft.organization = 'Contoso'
      })
    )
    expect(plan.ok).toBe(true)
  })

  it('recusa arquivo de outra organização, com o motivo', () => {
    const plan = planImport(
      config(),
      text((draft) => {
        draft.organization = 'fabrikam'
      })
    )
    expect(plan).toMatchObject({ ok: false, issues: [{ path: 'organization' }] })
  })

  it('sem Perfil anterior, a organização do arquivo vale', () => {
    const plan = planImport(
      null,
      text((draft) => {
        draft.organization = 'fabrikam'
      })
    )
    expect(plan.ok).toBe(true)
  })

  it('grava o JSON como veio, sem os valores padrão', () => {
    const plan = planImport(config(), exampleText)
    if (!plan.ok) throw new Error('plano recusado')
    expect(plan.content).toEqual(JSON.parse(exampleText))
  })

  it('a validação continua valendo: URL na organização é recusada (RN-CFG-04)', () => {
    const plan = planImport(
      null,
      text((draft) => {
        draft.organization = 'https://x.example'
      })
    )
    expect(plan.ok).toBe(false)
  })

  it('JSON quebrado mostra só a posição, sem repetir o texto (RN-CFG-05)', () => {
    const plan = planImport(null, '{ "organization": "contoso", oops }')
    expect(plan.ok).toBe(false)
    if (plan.ok) return
    expect(plan.issues[0].message).not.toContain('oops')
  })

  it('a Configuração exportada volta a ser importável', () => {
    const exported = JSON.stringify(config(), null, 2)
    expect(parseConfigurationText(exported).ok).toBe(true)
  })
})
