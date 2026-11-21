import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { planImport } from './import'
import type { Configuration } from './schema'
import { TEMPLATE_KIND, templateFrom, validateTemplate } from './template'
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

describe('Modelo de processo (RN-CFG-10)', () => {
  it('não leva organização, Produtos, Grupos, Squads nem cor de destaque', () => {
    const template = templateFrom(config())
    expect(template.kind).toBe(TEMPLATE_KIND)
    for (const key of ['organization', 'products', 'groups', 'squads', 'appearance']) {
      expect(template).not.toHaveProperty(key)
    }
    expect(template).toHaveProperty('processProfiles')
    expect(template).toHaveProperty('calendar')
  })

  it('o Modelo exportado é válido', () => {
    expect(validateTemplate(templateFrom(config())).ok).toBe(true)
  })

  it('Modelo com Produto é recusado: o Modelo não é Configuração', () => {
    const template = { ...templateFrom(config()), products: [] }
    expect(validateTemplate(template).ok).toBe(false)
  })

  it('segredo no Modelo é recusado como na Configuração (RN-CFG-05)', () => {
    const template = { ...templateFrom(config()), recurrentBugTag: 'ghp_' + 'a'.repeat(36) }
    expect(validateTemplate(template).ok).toBe(false)
  })

  it('importar um Modelo mantém os Produtos e soma os Perfis de processo', () => {
    const other = config((draft) => {
      const [first] = Object.keys(draft.processProfiles)
      draft.processProfiles.kanban = { ...draft.processProfiles[first], inProgressState: 'Doing' }
      draft.recurrentBugTag = '[volta]'
    })
    const current = config()

    const plan = planImport(current, JSON.stringify(templateFrom(other)))

    if (!plan.ok) throw new Error(JSON.stringify(plan.issues))
    expect(plan.kind).toBe('template')
    expect(plan.config.products).toEqual(current.products)
    expect(plan.config.organization).toBe(current.organization)
    expect(Object.keys(plan.config.processProfiles)).toContain('kanban')
    expect(plan.config.recurrentBugTag).toBe('[volta]')
    expect(plan.diff.processProfiles.added.map((p) => p.id)).toEqual(['kanban'])
    expect(plan.diff.products).toEqual({ added: [], changed: [], removed: [] })
  })

  it('Modelo sem Perfil para entrar é recusado', () => {
    const plan = planImport(null, JSON.stringify(templateFrom(config())))
    expect(plan.ok).toBe(false)
  })

  it('a soma continua validada: Produto sem o Perfil de processo dele é erro', () => {
    const current = config((draft) => {
      draft.products[0].processProfile = 'kanban'
      const [first] = Object.keys(draft.processProfiles)
      draft.processProfiles.kanban = draft.processProfiles[first]
    })
    // O Modelo traz só o Perfil "kanban" quebrado: o Produto continua apontando para ele.
    const template = templateFrom(config())
    const broken = { ...template, processProfiles: { kanban: { workItemTypes: [] } } }

    expect(planImport(current, JSON.stringify(broken)).ok).toBe(false)
  })
})
