import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { SCRUM_PRESET } from '@shared/config/presets'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import {
  buildConfiguration,
  draftFromConfig,
  idFromName,
  productsWithoutSquad,
  type WizardDraft
} from './draft'
import { parseOrganizationInput } from './organization'

describe('parseOrganizationInput (RN-CFG-04)', () => {
  it('aceita o nome puro', () => {
    expect(parseOrganizationInput(' contoso ')).toEqual({
      ok: true,
      organization: 'contoso',
      fromUrl: false
    })
  })

  it.each([
    'https://dev.azure.com/contoso',
    'https://dev.azure.com/contoso/Loja/_boards/board',
    'dev.azure.com/contoso/',
    'https://contoso.visualstudio.com/Loja',
    'contoso.visualstudio.com'
  ])('extrai o nome de %s e avisa que veio de URL', (input) => {
    expect(parseOrganizationInput(input)).toEqual({
      ok: true,
      organization: 'contoso',
      fromUrl: true
    })
  })

  it.each(['https://azure.contoso.com/tfs/Default', 'http://127.0.0.1:8080/contoso', 'a@b.com'])(
    'recusa endereço de outro servidor: %s',
    (input) => {
      expect(parseOrganizationInput(input).ok).toBe(false)
    }
  )

  it.each(['', 'https://dev.azure.com/', 'conto so', '-contoso'])('recusa %j', (input) => {
    expect(parseOrganizationInput(input).ok).toBe(false)
  })
})

describe('idFromName', () => {
  it('tira acento e espaço, e começa com letra', () => {
    expect(idFromName('Loja Online — Açaí')).toBe('loja-online-acai')
    expect(idFromName('2º App')).toBe('app')
    expect(idFromName('!!!')).toBe('produto')
  })

  it('não repete um ID já usado', () => {
    expect(idFromName('App Mobile', ['app-mobile', 'app-mobile-2'])).toBe('app-mobile-3')
  })

  it('respeita o limite de 32 caracteres', () => {
    const id = idFromName('a'.repeat(40), ['a'.repeat(32)])
    expect(id).toHaveLength(32)
    expect(id.endsWith('-2')).toBe(true)
  })
})

const CONFIG: Configuration = (() => {
  const result = validateConfiguration({
    $schema: './configuracao.schema.json',
    version: 1,
    organization: 'contoso',
    appearance: { accentColor: '#2f6fed' },
    processProfiles: { scrum: SCRUM_PRESET },
    products: [
      {
        id: 'loja',
        name: 'Loja Online',
        color: '#7b61ff',
        project: 'Contoso',
        team: 'Loja Team',
        areaPaths: ['Contoso\\Loja'],
        excludedAreaPaths: ['Contoso\\Loja\\QA'],
        processProfile: 'scrum'
      },
      {
        id: 'app',
        name: 'App Mobile',
        color: '#0e9f6e',
        project: 'Contoso',
        areaPaths: ['Contoso\\App'],
        processProfile: 'scrum'
      }
    ],
    groups: [{ id: 'digital', name: 'Digital', products: ['loja', 'app'] }],
    calendar: {
      country: 'BR',
      workingHours: [{ start: '09:00', end: '17:00' }],
      productiveHoursPerDay: 6
    },
    storyPoints: { '1': 2, '2': 4 },
    capacityDefaults: {
      frontDevs: 2,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 20,
      backBugPercent: 20
    }
  })
  if (!result.ok) throw new Error(JSON.stringify(result.issues))
  return result.config
})()

describe('rascunho ↔ Configuração', () => {
  it('ida e volta preserva a Configuração, inclusive o que o assistente não edita', () => {
    const rebuilt = validateConfiguration(buildConfiguration(draftFromConfig(CONFIG)))
    expect(rebuilt.ok).toBe(true)
    if (rebuilt.ok) expect(rebuilt.config).toEqual(CONFIG)
  })

  it('Produto existente chega com o ID travado (RN-CFG-02)', () => {
    expect(draftFromConfig(CONFIG).products.every((p) => p.idLocked)).toBe(true)
  })

  it('projeto desmarcado leva os Produtos dele e as citações nos Grupos', () => {
    const draft: WizardDraft = draftFromConfig(CONFIG)
    draft.projects = []
    const built = buildConfiguration(draft)
    expect(built.products).toEqual([])
    expect(built.groups?.[0].products).toEqual([])
    // Perfil de processo sem Produto também sai.
    expect(built.processProfiles).toEqual({})
  })

  it('o Grupo acompanha o ID novo de um Produto ainda não salvo', () => {
    const draft = draftFromConfig(CONFIG)
    draft.products[0] = { ...draft.products[0], id: 'loja-nova', idLocked: false }
    expect(buildConfiguration(draft).groups?.[0].products).toEqual(['loja-nova', 'app'])
  })
})

describe('rascunho ↔ Configuração com Squads (RN-GLB-17)', () => {
  const squads: Configuration = (() => {
    const raw = JSON.parse(readFileSync(resolve('examples/exemplo-squads.json'), 'utf8'))
    const result = validateConfiguration(raw)
    if (!result.ok) throw new Error(JSON.stringify(result.issues))
    return result.config
  })()

  it('ida e volta preserva as Squads, com a cor e a capacidade que o assistente não edita', () => {
    const rebuilt = validateConfiguration(buildConfiguration(draftFromConfig(squads)))
    expect(rebuilt.ok && rebuilt.config.squads).toEqual(squads.squads)
  })

  it('a cor escolhida no assistente vai para o arquivo, e sem cor a chave some', () => {
    const draft = draftFromConfig(squads)
    draft.squads[0] = { ...draft.squads[0], color: '#2F6FED' }
    draft.squads[1] = { ...draft.squads[1], color: undefined }
    const built = buildConfiguration(draft)
    expect(built.squads?.[0].color).toBe('#2F6FED')
    expect(built.squads?.[1]).not.toHaveProperty('color')
  })

  it('sem Squads, a chave não aparece no arquivo', () => {
    expect('squads' in buildConfiguration(draftFromConfig(CONFIG))).toBe(false)
  })

  it('aponta o Produto que ficou sem Squad', () => {
    const draft = draftFromConfig(squads)
    draft.squads = draft.squads.filter((s) => s.id !== 'squad-interno')
    expect(productsWithoutSquad(draft).map((p) => p.id)).toEqual(['backoffice'])
    expect(productsWithoutSquad(draftFromConfig(CONFIG))).toEqual([])
  })
})
