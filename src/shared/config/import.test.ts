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

describe('planImport no modo Mesclar (RN-CFG-11)', () => {
  it('o arquivo vence no ID igual e o que só existe no Perfil fica', () => {
    const current = config((draft) => {
      draft.products.push({ ...draft.products[0], id: 'backoffice', name: 'Backoffice' })
    })
    const incoming = text((draft) => {
      draft.products[0].name = 'Loja Nova'
      draft.products.push({ ...draft.products[0], id: 'portal', name: 'Portal' })
    })

    const plan = planImport(current, incoming, 'merge')

    if (!plan.ok) throw new Error(JSON.stringify(plan.issues))
    const ids = plan.config.products.map((p) => p.id)
    expect(ids).toContain('backoffice')
    expect(ids).toContain('portal')
    expect(plan.config.products.find((p) => p.id === 'loja')?.name).toBe('Loja Nova')
    expect(plan.diff.products.removed).toEqual([])
  })

  it('Substituir tira o que só existe no Perfil, e a prévia mostra', () => {
    const current = config((draft) => {
      draft.products.push({ ...draft.products[0], id: 'backoffice', name: 'Backoffice' })
    })
    const plan = planImport(current, exampleText, 'replace')
    if (!plan.ok) throw new Error(JSON.stringify(plan.issues))
    expect(removedFromDiff(plan.diff).products).toEqual(['backoffice'])
  })

  it('a cor de destaque é de quem usa e fica ao mesclar', () => {
    const current = config((draft) => {
      draft.appearance = { accentColor: '#112233' }
    })
    const incoming = text((draft) => {
      draft.appearance = { accentColor: '#445566' }
    })
    const plan = planImport(current, incoming, 'merge')
    if (!plan.ok) throw new Error(JSON.stringify(plan.issues))
    expect(plan.config.appearance?.accentColor).toBe('#112233')
  })

  it('a soma é validada de novo: o Produto do Perfil fora das Squads do arquivo é erro', () => {
    const squads = readFileSync(resolve('examples/exemplo-squads.json'), 'utf8')
    const squadConfig = validateConfiguration(JSON.parse(squads))
    if (!squadConfig.ok) throw new Error('exemplo de Squads inválido')
    const current = {
      ...squadConfig.config,
      products: [
        ...squadConfig.config.products,
        { ...squadConfig.config.products[0], id: 'sozinho', name: 'Sozinho' }
      ],
      squads: squadConfig.config.squads.map((squad, index) =>
        index === 0 ? { ...squad, products: [...squad.products, 'sozinho'] } : squad
      )
    }

    // O arquivo traz a mesma Squad sem o Produto "sozinho": ele fica sem Squad (RN-GLB-17).
    const plan = planImport(current, squads, 'merge')

    expect(plan.ok).toBe(false)
  })

  it('sem Perfil, Mesclar é o mesmo que Substituir', () => {
    const plan = planImport(null, exampleText, 'merge')
    if (!plan.ok) throw new Error('plano recusado')
    expect(plan.content).toEqual(JSON.parse(exampleText))
  })
})
