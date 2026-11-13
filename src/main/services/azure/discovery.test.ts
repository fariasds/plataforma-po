import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCRUM_PRESET } from '@shared/config/presets'
import { processProfileSchema } from '@shared/config/schema'
import org from '../../../../tests/fixtures/azure/discovery-org.json'
import scrum from '../../../../tests/fixtures/azure/discovery-process-scrum.json'
import custom from '../../../../tests/fixtures/azure/discovery-process-custom.json'

// Organização `contoso`, projetos fictícios. O `fetchAzure` é trocado por um
// roteador sobre as fixtures: o que se testa aqui é a leitura das respostas.

const fake = vi.hoisted(() => ({
  fetchAzure: vi.fn<(path: string) => Promise<unknown>>(),
  activeConfig: null as { organization: string } | null,
  configFile: ''
}))

vi.mock('./client', () => ({ fetchAzure: fake.fetchAzure }))
vi.mock('../../profile/config-loader', () => ({ getActiveConfig: () => fake.activeConfig }))
vi.mock('../../profile/profile-store', () => ({
  requireActiveProfile: () => ({ id: 'contoso', name: 'Contoso', dir: '' })
}))
vi.mock('../../profile/paths', () => ({ configPath: () => fake.configFile }))

const {
  discoveryOrganization,
  getAreaTree,
  getProcessDetails,
  listFields,
  listProjects,
  listTeams,
  suggestProcessProfile
} = await import('./discovery')

type ProcessFixture = typeof scrum | typeof custom

/** Responde como o Azure, pelo caminho pedido. */
function route(process: ProcessFixture) {
  return async (path: string): Promise<unknown> => {
    const [pathname] = path.split('?')
    if (pathname === '/_apis/projects') return org.projects
    const detail = /^\/_apis\/projects\/([^/]+)$/.exec(pathname)
    if (detail) return org.projectDetails[detail[1] as keyof typeof org.projectDetails]
    if (/^\/_apis\/projects\/[^/]+\/teams$/.test(pathname)) return org.teams
    if (pathname.endsWith('/_apis/wit/classificationnodes/areas')) return org.areas
    if (pathname.endsWith('/_apis/wit/fields')) return org.fields
    if (pathname.endsWith('/_apis/wit/workitemtypes')) return process.workitemtypes
    if (pathname.endsWith('/_apis/wit/workitemtypecategories'))
      return process.workitemtypecategories
    const states = /\/_apis\/wit\/workitemtypes\/([^/]+)\/states$/.exec(pathname)
    if (states) {
      const byType: Record<string, unknown[] | undefined> = process.states
      const value = byType[decodeURIComponent(states[1])]
      if (!value) throw new Error(`estados pedidos para tipo inesperado: ${states[1]}`)
      return { count: value.length, value }
    }
    throw new Error(`caminho inesperado: ${path}`)
  }
}

beforeEach(() => {
  fake.fetchAzure.mockReset()
  fake.fetchAzure.mockImplementation(route(scrum))
  fake.activeConfig = null
})

describe('listProjects', () => {
  it('traz o processo e o time padrão do detalhe de cada projeto, em ordem alfabética', async () => {
    expect(await listProjects()).toEqual([
      {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Loja Online',
        process: 'Scrum',
        defaultTeam: 'Loja Online Team'
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Varejo',
        process: 'Varejo Ágil',
        defaultTeam: 'Varejo Team'
      }
    ])
    const details = fake.fetchAzure.mock.calls.filter(([path]) =>
      path.includes('includeCapabilities=true')
    )
    expect(details).toHaveLength(2)
  })

  it('só faz GET em caminhos da API, sem montar URL', async () => {
    await listProjects()
    for (const [path] of fake.fetchAzure.mock.calls) expect(path).toMatch(/^\/_apis\//)
  })
})

describe('listTeams', () => {
  it('segue a paginação até vir uma página incompleta', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({
      id: `team-${String(i).padStart(3, '0')}`,
      name: `Time ${String(i).padStart(3, '0')}`
    }))
    fake.fetchAzure.mockImplementation(async (path) =>
      path.includes('$skip=0') ? { value: fullPage } : org.teams
    )
    const teams = await listTeams('Loja Online')
    expect(teams).toHaveLength(102)
    expect(fake.fetchAzure.mock.calls.map(([path]) => path)).toEqual([
      '/_apis/projects/Loja%20Online/teams?api-version=7.1&$top=100&$skip=0',
      '/_apis/projects/Loja%20Online/teams?api-version=7.1&$top=100&$skip=100'
    ])
  })

  it('devolve só id e nome', async () => {
    expect(await listTeams('Loja Online')).toEqual([
      { id: '00000000-0000-0000-0000-0000000000a3', name: 'Checkout' },
      { id: '00000000-0000-0000-0000-0000000000a1', name: 'Loja Online Team' }
    ])
  })
})

describe('getAreaTree', () => {
  it('remonta os caminhos no formato da Configuração, sem o segmento "Area"', async () => {
    const root = await getAreaTree('Loja Online')
    expect(root.path).toBe('Loja Online')
    expect(root.children.map((area) => area.path)).toEqual([
      'Loja Online\\Catalogo',
      'Loja Online\\Checkout'
    ])
    expect(root.children[1].children[0]).toEqual({
      name: 'Pagamentos',
      path: 'Loja Online\\Checkout\\Pagamentos',
      children: []
    })
    expect(fake.fetchAzure).toHaveBeenCalledWith(
      '/Loja%20Online/_apis/wit/classificationnodes/areas?$depth=10&api-version=7.1'
    )
  })
})

describe('listFields', () => {
  it('oferece só os campos acrescentados pelo processo, sem os apagados', async () => {
    expect(await listFields('Loja Online')).toEqual([
      { name: 'Criticidade', referenceName: 'Contoso.Criticidade', type: 'string' },
      { name: 'Esforço Front', referenceName: 'Custom.EsforcoFront', type: 'double' },
      { name: 'Retrabalho', referenceName: 'Custom.Retrabalho', type: 'integer' }
    ])
  })
})

describe('getProcessDetails', () => {
  it('ignora tipos desativados e os da categoria oculta', async () => {
    const details = await getProcessDetails('Loja Online')
    expect(details.workItemTypes.map((type) => type.name)).toEqual([
      'Product Backlog Item',
      'Bug',
      'Task',
      'Epic'
    ])
    const statesAsked = fake.fetchAzure.mock.calls
      .map(([path]) => path)
      .filter((path) => path.endsWith('/states?api-version=7.1'))
    expect(statesAsked).toHaveLength(4)
  })

  it('traz a categoria de cada estado e o papel de cada tipo', async () => {
    const details = await getProcessDetails('Loja Online')
    expect(details.categories).toEqual({
      requirement: ['Product Backlog Item'],
      bug: 'Bug',
      task: 'Task'
    })
    const pbi = details.workItemTypes[0]
    expect(pbi.estimateField).toBe('Microsoft.VSTS.Scheduling.Effort')
    expect(pbi.states).toContainEqual({ name: 'Committed', category: 'InProgress' })
  })

  it('categoria desconhecida vira null, sem derrubar a descoberta', async () => {
    fake.fetchAzure.mockImplementation(async (path) => {
      if (path.includes('/states?')) return { value: [{ name: 'Estranho', category: 'Outra' }] }
      return route(scrum)(path)
    })
    const details = await getProcessDetails('Loja Online')
    expect(details.workItemTypes[0].states).toEqual([{ name: 'Estranho', category: null }])
  })
})

describe('suggestProcessProfile', () => {
  it('num projeto Scrum sem customização, sugere exatamente o preset Scrum', async () => {
    const suggestion = suggestProcessProfile(await getProcessDetails('Loja Online'))
    expect(suggestion).toEqual(SCRUM_PRESET)
  })

  it('num processo customizado, sugere pelas categorias, sem depender dos nomes', async () => {
    fake.fetchAzure.mockImplementation(route(custom))
    const suggestion = suggestProcessProfile(await getProcessDetails('Varejo'))
    expect(suggestion).toEqual({
      workItemTypes: ['História', 'Melhoria', 'Defeito'],
      plannableTypes: ['História', 'Melhoria'],
      developmentTypes: ['História', 'Melhoria'],
      bugType: 'Defeito',
      taskType: 'Atividade',
      estimateField: 'Microsoft.VSTS.Scheduling.StoryPoints',
      deliveredStates: ['Entregue', 'Publicada', 'Fechado'],
      terminalStates: ['Entregue', 'Publicada', 'Fechado', 'Cancelada', 'Descartado'],
      removedStates: ['Cancelada', 'Descartado'],
      inProgressState: 'Em desenvolvimento',
      devDoneState: 'Homologada',
      testingState: null,
      bugStateOrder: ['Aberto', 'Em análise', 'Corrigido', 'Fechado']
    })
  })

  it('as sugestões passam no schema do Perfil de processo', async () => {
    for (const fixture of [scrum, custom]) {
      fake.fetchAzure.mockImplementation(route(fixture))
      const suggestion = suggestProcessProfile(await getProcessDetails('Loja Online'))
      expect(processProfileSchema.safeParse(suggestion).success).toBe(true)
    }
  })

  it('sem tipo de requisito, não sugere nada', () => {
    expect(
      suggestProcessProfile({
        workItemTypes: [],
        categories: { requirement: [], bug: null, task: null }
      })
    ).toBeNull()
  })
})

describe('discoveryOrganization', () => {
  const dir = mkdtempSync(join(tmpdir(), 'discovery-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('usa a organização da Configuração em uso', () => {
    fake.activeConfig = { organization: 'contoso' }
    expect(discoveryOrganization()).toBe('contoso')
  })

  it('sem Configuração válida, lê a organização do arquivo como está no disco', () => {
    fake.configFile = join(dir, 'configuracao.json')
    writeFileSync(
      fake.configFile,
      JSON.stringify({ organization: 'contoso', products: 'quebrado' })
    )
    expect(discoveryOrganization()).toBe('contoso')
  })

  it('sem organização no arquivo, recusa com erro claro', () => {
    fake.configFile = join(dir, 'vazio.json')
    writeFileSync(fake.configFile, '{ não é json')
    expect(() => discoveryOrganization()).toThrow(/organization/)
  })
})
