import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { UnifiedSprint } from '@shared/azure'
import type { Configuration } from '@shared/config/schema'
import type { ManualPlanningItem, PlanningItem } from '@shared/dashboards'
import { createCalendar } from '@shared/calendar'
import { validateConfiguration } from '@shared/config/validate'
import { sprintMoment } from '@shared/home'
import { planningKeys } from '@shared/planning-keys'
import { createFakeAzure, type FakeAzure } from '../../src/main/demo/fake-azure'
import { SCENARIOS } from '../../src/main/demo/scenarios'
import type { Scenario } from '../../src/main/demo/types'
import { stableJson } from './stable-json'

/**
 * Regressão das telas: todo Cenário × toda tela, comparado com o resultado
 * aprovado em `aprovados/<cenario>/<tela>.json`.
 *
 * Aprovado que mudou é regressão até prova em contrário. Ele só muda junto com
 * a regra que justifica a mudança (veja CONTRIBUTING.md); atualizar com
 * `npm run test:regression -- -u` para o teste passar é esconder o defeito.
 */

// O fuso é parte do Cenário: o app lê as datas do Azure no horário local, e o
// mesmo item pode cair em dias diferentes em São Paulo e em UTC. Fixado aqui,
// o resultado é o mesmo na máquina do PO e no CI.
process.env.TZ = 'America/Sao_Paulo'

const state = vi.hoisted(() => ({
  config: null as Configuration | null,
  azure: null as FakeAzure | null,
  workData: {} as Record<string, unknown>
}))

function fake(): FakeAzure {
  if (!state.azure) throw new Error('Nenhum Cenário ativo')
  return state.azure
}

vi.mock('../../src/main/profile/config-loader', () => ({ getActiveConfig: () => state.config }))
vi.mock('../../src/main/profile/profile-store', () => ({
  requireActiveProfile: () => ({ id: 'cenario', name: 'Cenário', dir: '' })
}))
vi.mock('../../src/main/profile/paths', () => ({ configPath: () => '' }))
vi.mock('../../src/main/profile/work-data', () => ({
  readWorkData: (_profileId: string, key: string) => state.workData[key]
}))
vi.mock('../../src/main/services/azure/client', () => ({
  fetchAzure: (path: string) => fake().fetchAzure(path),
  postAzure: (path: string, body: unknown) => fake().postAzure(path, body),
  fetchGraph: (path: string) => fake().fetchGraph(path),
  fetchAzureAvatar: (url: string) => fake().fetchAzureAvatar(url),
  fetchAvatarByDescriptor: (descriptor: string) => fake().fetchAvatarByDescriptor(descriptor)
}))

const { getUnifiedSprints } = await import('../../src/main/services/azure/unified-sprints')
const { getSprintDeliveryData } = await import('../../src/main/services/azure/sprint-delivery')
const { getBugAnalysisData } = await import('../../src/main/services/azure/bug-analysis')
const { getTeamPerformanceData } = await import('../../src/main/services/azure/team-performance')
const { getDailyData } = await import('../../src/main/services/azure/daily')
const { getPlanningData } = await import('../../src/main/services/azure/planning')
const { getPlanningItem } = await import('../../src/main/services/azure/planning-item')
const { getCurrentUser, clearUserProfileCache } =
  await import('../../src/main/services/azure/directory')
const discovery = await import('../../src/main/services/azure/discovery')
const { buildSprintGoalRequest } = await import('../../src/main/services/ai/sprint-goal')
const { resolveScope } = await import('../../src/main/services/azure/scope')
const { buildPlanningSummary, summaryToMarkdown } =
  await import('../../src/renderer/src/features/planning/planning-summary')
const { resolveCapacity } = await import('../../src/renderer/src/features/planning/planning-rules')

const APPROVED_DIR = join(__dirname, 'aprovados')

/** Quantas sprints cada tela pede, como no renderer. */
const HISTORY_SPRINTS = 12
const DELIVERY_SPRINTS = 5
const PLANNABLE_SPRINTS = 5

// ─── Telas ───────────────────────────────────────────────────────────────────

/** O que uma tela devolve para um Cenário já ativo. */
type ScreenRun = (scenario: Scenario) => Promise<unknown>

/** Para cada seleção do Cenário, a mesma tela. */
async function perSelection(
  scenario: Scenario,
  run: (selectionId: string) => Promise<unknown>
): Promise<Record<string, unknown>> {
  const result: Record<string, unknown> = {}
  for (const selectionId of scenario.selections) result[selectionId] = await run(selectionId)
  return result
}

async function planningSprint(): Promise<UnifiedSprint | undefined> {
  return (await getUnifiedSprints(PLANNABLE_SPRINTS, true))[0]
}

function manualItems(
  scenario: Scenario,
  selectionId: string,
  sprint: UnifiedSprint
): ManualPlanningItem[] {
  const { products } = resolveScope(selectionId, state.config!)
  return products.flatMap((product) => {
    const stored = scenario.workData?.[planningKeys.manual(product.id, sprint.key)]
    return Array.isArray(stored) ? (stored as ManualPlanningItem[]) : []
  })
}

function uncheckedIds(scenario: Scenario, sprint: UnifiedSprint): Set<number> {
  const stored = scenario.workData?.[planningKeys.unchecked(sprint.key)]
  return new Set(Array.isArray(stored) ? (stored as number[]) : [])
}

/** Os itens que o PO veria marcados no Planning: os do Azure e os remanescentes. */
async function planningItems(
  scenario: Scenario,
  selectionId: string,
  sprint: UnifiedSprint
): Promise<PlanningItem[]> {
  const fromAzure = (await getPlanningData(selectionId, sprint)).items
  return [...fromAzure, ...manualItems(scenario, selectionId, sprint)]
}

export const SCREENS: Record<string, ScreenRun> = {
  'sprint-unificada': async () => ({
    revisao: await getUnifiedSprints(HISTORY_SPRINTS),
    planejamento: await getUnifiedSprints(PLANNABLE_SPRINTS, true)
  }),

  // A tela abre na sprint mais recente e o PO costuma olhar a anterior: as duas entram.
  entregas: async (scenario) => {
    const sprints = (await getUnifiedSprints(DELIVERY_SPRINTS)).slice(0, 2)
    return perSelection(scenario, async (selectionId) => {
      const bySprint: Record<string, unknown> = {}
      for (const sprint of sprints) {
        bySprint[sprint.key] = await getSprintDeliveryData(selectionId, sprint)
      }
      return bySprint
    })
  },

  bugs: async (scenario) => {
    const sprints = await getUnifiedSprints(HISTORY_SPRINTS)
    if (sprints.length === 0) return null
    return perSelection(scenario, (selectionId) =>
      getBugAnalysisData(selectionId, sprints, sprints[0])
    )
  },

  desempenho: async (scenario) => {
    const sprints = await getUnifiedSprints(HISTORY_SPRINTS)
    if (sprints.length === 0) return null
    return perSelection(scenario, (selectionId) => getTeamPerformanceData(selectionId, sprints))
  },

  daily: async (scenario) => {
    const [sprint] = await getUnifiedSprints(1)
    if (!sprint) return null
    return perSelection(scenario, (selectionId) => getDailyData(selectionId, sprint))
  },

  planning: async (scenario) => {
    const sprint = await planningSprint()
    if (!sprint) return null
    const config = state.config!
    return perSelection(scenario, async (selectionId) => {
      const { products } = resolveScope(selectionId, config)
      const manual = manualItems(scenario, selectionId, sprint)
      const items = await planningItems(scenario, selectionId, sprint)
      const isGroup = config.groups.some((g) => g.id === selectionId)
      const selectionName =
        config.groups.find((g) => g.id === selectionId)?.name ?? products[0]?.name ?? selectionId
      const { effortFrontend, effortBackend, effortQa } = config.customFields
      const goal = scenario.workData?.[planningKeys.goal(selectionId, sprint.key)]

      const summary = buildPlanningSummary({
        organization: config.organization,
        selectionName,
        sprintLabel: sprint.label,
        generatedAt: '(data da geração)',
        products: products.map(({ id, name }) => ({ id, name })),
        isGroup,
        items,
        uncheckedIds: uncheckedIds(scenario, sprint),
        manualIds: new Set(manual.map((i) => i.id)),
        effort: { frontend: !!effortFrontend, backend: !!effortBackend, qa: !!effortQa },
        capacity: resolveCapacity(
          config.capacityDefaults,
          (scenario.workData?.[planningKeys.capacity] as object | undefined) ?? {}
        ),
        productiveHoursPerDay: config.calendar.productiveHoursPerDay,
        storyPoints: config.storyPoints,
        goal: typeof goal === 'string' ? goal : undefined,
        showUnchecked: true
      })

      return {
        sprint: sprint.key,
        dados: await getPlanningData(selectionId, sprint),
        // O que o PO puxou de sprint anterior é buscado de novo pelo ID (RN-PLN-10).
        remanescentes: await Promise.all(manual.map((item) => getPlanningItem(item.id))),
        resumo: summaryToMarkdown(summary)
      }
    })
  },

  descoberta: async (scenario) => {
    const result: Record<string, unknown> = { projetos: await discovery.listProjects() }
    for (const { name } of scenario.azure.projects) {
      const details = await discovery.getProcessDetails(name)
      result[name] = {
        times: await discovery.listTeams(name),
        areas: await discovery.getAreaTree(name),
        processo: details,
        sugestao: discovery.suggestProcessProfile(details),
        campos: await discovery.listFields(name)
      }
    }
    return result
  },

  usuario: async () => {
    clearUserProfileCache()
    return getCurrentUser()
  },

  // A Home lê a mesma sprint da Daily e decide o momento no renderer (RN-HOM-02);
  // o cálculo é puro, e aqui roda no "hoje" do Cenário.
  home: async () => {
    const [sprint] = await getUnifiedSprints(1)
    return {
      sprint: sprint?.key ?? null,
      momento: sprintMoment(sprint, createCalendar(state.config!.calendar), new Date())
    }
  }
}

/**
 * O pedido que o PO copia para a IA (RN-SEC-24) também é resultado aprovado: um
 * campo a mais no pedido aparece no diff. Só existe para Cenário com item de
 * Planning marcado.
 */
async function sprintGoalRequests(scenario: Scenario): Promise<Record<string, unknown> | null> {
  const sprint = await planningSprint()
  if (!sprint) return null
  const result: Record<string, unknown> = {}
  for (const selectionId of scenario.selections) {
    const unchecked = uncheckedIds(scenario, sprint)
    const ids = (await planningItems(scenario, selectionId, sprint))
      .map((item) => item.id)
      .filter((id) => !unchecked.has(id))
    if (ids.length > 0) result[selectionId] = await buildSprintGoalRequest(selectionId, sprint, ids)
  }
  return Object.keys(result).length > 0 ? result : null
}

/** Handlers de IPC que leem o Azure e a tela que os cobre aqui. */
const COVERED_HANDLERS: Record<string, string> = {
  getSprints: 'sprint-unificada',
  getSprintDelivery: 'entregas',
  getBugAnalysis: 'bugs',
  getTeamPerformance: 'desempenho',
  getDaily: 'daily',
  getPlanning: 'planning',
  getPlanningItem: 'planning',
  getCurrentUser: 'usuario',
  discoverProjects: 'descoberta',
  discoverTeams: 'descoberta',
  discoverAreas: 'descoberta',
  discoverProcess: 'descoberta',
  discoverFields: 'descoberta',
  buildSprintGoalRequest: 'pedido-ia'
}

/** Arquivos de handler cujos canais falam com o Azure. */
const AZURE_HANDLER_FILES = ['azure-handlers.ts', 'discovery-handlers.ts', 'ai-handlers.ts']

// ─── Execução ────────────────────────────────────────────────────────────────

/** Ativa o Cenário: Configuração validada, Azure fictício, Dados de trabalho e relógio. */
function activate(scenario: Scenario): FakeAzure {
  const parsed = validateConfiguration(scenario.config)
  if (!parsed.ok) {
    throw new Error(
      `Configuração do Cenário ${scenario.id} inválida: ${JSON.stringify(parsed.issues)}`
    )
  }
  state.config = parsed.config
  state.azure = createFakeAzure(scenario.azure)
  state.workData = scenario.workData ?? {}
  vi.setSystemTime(new Date(scenario.anchorDate))
  return state.azure
}

function approvedPath(scenarioId: string, screen: string): string {
  return join(APPROVED_DIR, scenarioId, `${screen}.json`)
}

/** Fotografado antes de qualquer teste rodar: o `toMatchFileSnapshot` cria o que falta. */
const approvedBeforeRun = new Set(
  existsSync(APPROVED_DIR)
    ? readdirSync(APPROVED_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) => readdirSync(join(APPROVED_DIR, d.name)).map((file) => `${d.name}/${file}`))
    : []
)

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterAll(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('catálogo de Cenários', () => {
  it('IDs únicos, em kebab-case', () => {
    const ids = SCENARIOS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  // RN-CFG-01 a 03: a Configuração do Cenário passa no mesmo schema do app.
  it.each(SCENARIOS.map((s) => [s.id, s] as const))('%s: Configuração válida', (_id, scenario) => {
    const result = validateConfiguration(scenario.config)
    expect(result.ok ? [] : result.issues).toEqual([])
  })

  it('todo Cenário tem resultado aprovado para toda tela, e não sobra aprovado órfão', () => {
    // Com -u, os aprovados que faltam estão sendo criados agora.
    const updating = expect.getState().snapshotState?.snapshotUpdateState === 'all'
    const expected = new Set(
      SCENARIOS.flatMap((s) => Object.keys(SCREENS).map((screen) => `${s.id}/${screen}.json`))
    )
    const missing = [...expected].filter((file) => !approvedBeforeRun.has(file))
    const orphan = [...approvedBeforeRun].filter(
      (file) => !expected.has(file) && !file.endsWith('/pedido-ia.json')
    )
    if (!updating) expect(missing, 'rode npm run test:regression -- -u e revise o diff').toEqual([])
    expect(orphan).toEqual([])
  })

  it('as telas em foco de cada Cenário existem', () => {
    const known = new Set([...Object.keys(SCREENS), 'pedido-ia'])
    const unknown = SCENARIOS.flatMap((s) => s.telas.filter((t) => !known.has(t)))
    expect(unknown).toEqual([])
  })

  it('todo canal de IPC que lê o Azure é coberto por uma tela da regressão', async () => {
    const { readFileSync } = await import('fs')
    const channels = AZURE_HANDLER_FILES.flatMap((file) => {
      const source = readFileSync(join(__dirname, '../../src/main/ipc', file), 'utf8')
      return [...source.matchAll(/handle\('([A-Za-z]+)'/g)].map((m) => m[1])
    })
    expect(channels.filter((channel) => !(channel in COVERED_HANDLERS))).toEqual([])
  })
})

describe.each(SCENARIOS.map((s) => [s.id, s] as const))('Cenário %s', (id, scenario) => {
  it.each(Object.keys(SCREENS))('%s', async (screen) => {
    const azure = activate(scenario)
    const result = await SCREENS[screen](scenario)
    // Rota que o Azure fictício não conhece e que o serviço engoliu ainda é defeito.
    expect(azure.errors).toEqual([])
    await expect(stableJson(result)).toMatchFileSnapshot(approvedPath(id, screen))
  })

  it('pedido-ia', async () => {
    const azure = activate(scenario)
    const result = await sprintGoalRequests(scenario)
    expect(azure.errors).toEqual([])
    const file = approvedPath(id, 'pedido-ia')
    if (result === null) {
      expect(approvedBeforeRun.has(`${id}/pedido-ia.json`), 'aprovado sem item de Planning').toBe(
        false
      )
      return
    }
    if (expect.getState().snapshotState?.snapshotUpdateState !== 'all') {
      expect(approvedBeforeRun.has(`${id}/pedido-ia.json`), 'pedido sem aprovado').toBe(true)
    }
    await expect(stableJson(result)).toMatchFileSnapshot(file)
  })
})
