import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { PROCESS_PRESETS } from './presets'
import { configurationSchema, renderConfigurationJsonSchema } from './schema'
import { removedIds, validateConfiguration, type ConfigurationIssue } from './validate'

const read = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(resolve(path), 'utf8'))

// O teste corrompe o JSON de propósito, em qualquer ponto: tipar isto seria reescrever o schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = any

const example = (): Record<string, unknown> => read('examples/exemplo-scrum.json')

/** Cópia do exemplo com uma alteração aplicada; o original não é tocado. */
function mutate(change: (config: Draft) => void): unknown {
  const config = structuredClone(example())
  change(config)
  return config
}

function issuesOf(raw: unknown): ConfigurationIssue[] {
  const result = validateConfiguration(raw)
  return result.ok ? [] : result.issues
}

function expectIssue(raw: unknown, path: string, message: RegExp): void {
  const issues = issuesOf(raw)
  expect(issues, JSON.stringify(issues, null, 2)).toContainEqual(
    expect.objectContaining({ path, message: expect.stringMatching(message) })
  )
}

describe('Configuração — casos válidos', () => {
  it('o exemplo fictício é válido', () => {
    expect(issuesOf(example())).toEqual([])
  })

  it('o exemplo usa o preset Scrum sem alteração', () => {
    const result = validateConfiguration(example())
    expect(result.ok && result.config.processProfiles.scrum).toEqual(PROCESS_PRESETS.scrum)
  })

  // As Configurações reais ficam em perfis-privados/, que não vai para o
  // repositório público; lá a lista sai vazia e o caso é pulado.
  const privateConfigs = existsSync('perfis-privados')
    ? readdirSync('perfis-privados').filter((name) => name.endsWith('.json'))
    : []

  it.runIf(privateConfigs.length > 0)('as Configurações privadas são válidas', () => {
    for (const name of privateConfigs) {
      expect(issuesOf(read(`perfis-privados/${name}`)), name).toEqual([])
    }
  })

  it('os presets passam pelo schema do Perfil de processo', () => {
    for (const preset of Object.values(PROCESS_PRESETS)) {
      const config = mutate((c) => (c.processProfiles.scrum = preset))
      expect(issuesOf(config)).toEqual([])
    }
  })

  it('aplica os padrões às chaves omitidas', () => {
    const config = mutate((c) => {
      delete c.groups
      delete c.customFields
      delete c.criticality
      delete c.recurrentBugTag
      delete c.products[1].areaPaths
    })
    const parsed = configurationSchema.parse(config)
    expect(parsed.groups).toEqual([])
    expect(parsed.customFields.reworkCount).toBeNull()
    expect(parsed.products[1].areaPaths).toEqual([])
    expect(parsed.products[1].cadence).toBe('sprints')
  })

  it('o percentual único de bugs, de antes da separação, vale para as duas disciplinas (RN-PLN-15)', () => {
    const config = mutate((c) => {
      c.capacityDefaults = { frontDevs: 2, backDevs: 3, sprintDays: 10, bugPercent: 25 }
    })
    expect(configurationSchema.parse(config).capacityDefaults).toEqual({
      frontDevs: 2,
      backDevs: 3,
      sprintDays: 10,
      frontBugPercent: 25,
      backBugPercent: 25
    })
  })

  it('o percentual da disciplina vence o único', () => {
    const config = mutate((c) => {
      c.capacityDefaults = {
        frontDevs: 2,
        backDevs: 3,
        sprintDays: 10,
        bugPercent: 25,
        backBugPercent: 10
      }
    })
    expect(configurationSchema.parse(config).capacityDefaults).toMatchObject({
      frontBugPercent: 25,
      backBugPercent: 10
    })
  })
})

describe('RN-CFG-01 — forma estrita', () => {
  it('rejeita chave desconhecida (erro de digitação)', () => {
    expectIssue(
      mutate((c) => (c.products[0].areaPath = ['x'])),
      'products[0]',
      /areaPath/
    )
  })

  it('rejeita versão desconhecida', () => {
    expectIssue(
      mutate((c) => (c.version = 2)),
      'version',
      /./
    )
  })

  it('rejeita cor fora do formato', () => {
    expectIssue(
      mutate((c) => (c.products[0].color = 'blue')),
      'products[0].color',
      /#RRGGBB/
    )
  })

  it('rejeita nome de exibição no lugar do nome de referência do campo', () => {
    expectIssue(
      mutate((c) => (c.customFields.reworkCount = 'Rework Times')),
      'customFields.reworkCount',
      /nome de referência/
    )
  })

  it.each(['13-01', '02-30', '04-31', '8-12'])('rejeita feriado recorrente "%s"', (monthDay) => {
    expectIssue(
      mutate((c) => (c.calendar.extraHolidays = [{ monthDay, name: 'x' }])),
      'calendar.extraHolidays[0].monthDay',
      /MM-DD|não existe/
    )
  })

  it('rejeita feriado com data única inválida', () => {
    expectIssue(
      mutate((c) => (c.calendar.extraHolidays = [{ date: '2026-02-30', name: 'x' }])),
      'calendar.extraHolidays[0].date',
      /AAAA-MM-DD/
    )
  })

  it('rejeita expediente sobreposto e horas produtivas acima do expediente', () => {
    const config = mutate((c) => {
      c.calendar.workingHours = [
        { start: '09:00', end: '12:00' },
        { start: '11:00', end: '13:00' }
      ]
      c.calendar.productiveHoursPerDay = 10
    })
    expectIssue(config, 'calendar.workingHours[1]', /sobreposição/)
    expectIssue(config, 'calendar.productiveHoursPerDay', /expediente/)
  })

  it('o JSON Schema versionado está atualizado (rode `npm run schema:generate`)', () => {
    const file = readFileSync(
      resolve('resources/profile-template/configuracao.schema.json'),
      'utf8'
    ).replace(/\r\n/g, '\n')
    expect(file).toBe(renderConfigurationJsonSchema())
  })
})

describe('RN-PLN-15 — reserva de bugs por disciplina', () => {
  it('sem percentual da disciplina nem o único, aponta o campo que falta', () => {
    const config = mutate((c) => {
      c.capacityDefaults = { frontDevs: 2, backDevs: 3, sprintDays: 10, frontBugPercent: 20 }
    })
    expectIssue(config, 'capacityDefaults.backBugPercent', /bugs desta disciplina/)
  })
})

describe('RN-CFG-02 — IDs de Produto e Grupo', () => {
  it('rejeita ID com espaço ou acento', () => {
    expectIssue(
      mutate((c) => (c.products[0].id = 'loja online')),
      'products[0].id',
      /letra/
    )
  })

  it('aponta os IDs que sumiram entre duas versões', () => {
    const before = configurationSchema.parse(example())
    const after = configurationSchema.parse(
      mutate((c) => {
        c.products[0].id = 'loja-nova'
        c.groups[0].products = ['loja-nova', 'app']
        c.groups[0].id = 'canais'
      })
    )
    expect(removedIds(before, after)).toEqual({ products: ['loja'], groups: ['digital'] })
  })
})

describe('RN-CFG-03 — referências íntegras', () => {
  it('rejeita ID de Produto repetido', () => {
    expectIssue(
      mutate((c) => (c.products[1].id = 'loja')),
      'products[1].id',
      /repetido/
    )
  })

  it('rejeita Grupo com o mesmo ID de um Produto', () => {
    expectIssue(
      mutate((c) => (c.groups[0].id = 'app')),
      'groups[0].id',
      /igual ao de um Produto/
    )
  })

  it('rejeita Grupo que cita Produto inexistente', () => {
    expectIssue(
      mutate((c) => (c.groups[0].products = ['loja', 'site'])),
      'groups[0].products[1]',
      /"site", que não existe/
    )
  })

  it('rejeita Produto que cita Perfil de processo inexistente', () => {
    expectIssue(
      mutate((c) => (c.products[0].processProfile = 'kanban')),
      'products[0].processProfile',
      /"kanban" não existe/
    )
  })

  it('rejeita tipo planejável fora de workItemTypes', () => {
    expectIssue(
      mutate((c) => c.processProfiles.scrum.plannableTypes.push('Epic')),
      'processProfiles.scrum.plannableTypes[1]',
      /"Epic" não está em "workItemTypes"/
    )
  })

  it('rejeita estado entregue que não é terminal', () => {
    expectIssue(
      mutate((c) => c.processProfiles.scrum.deliveredStates.push('Committed')),
      'processProfiles.scrum.deliveredStates[1]',
      /terminalStates/
    )
  })
})
