import { existsSync, readdirSync } from 'fs'
import { basename, join } from 'path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { UnifiedSprint } from '@shared/azure'
import type { Configuration } from '@shared/config/schema'
import type { AnticipatedShare, ManualPlanningItem, PlanningItem } from '@shared/dashboards'
import { createCalendar } from '@shared/calendar'
import { validateConfiguration } from '@shared/config/validate'
import { sprintMoment } from '@shared/home'
import { flowKeys } from '@shared/flow-snapshot'
import { planningKeys } from '@shared/planning-keys'
import type { CapacityConfig } from '../../src/renderer/src/features/planning/planning-rules'
import { isAggregateSelection, squadOfSelection } from '@shared/squads'
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
  workData: {} as Record<string, unknown>,
  scenarioId: '',
  anchor: 0
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
// A pasta de trabalho fictícia do Cenário, por Produto: tests/regression/pastas/<cenário>/<produto>.
vi.mock('../../src/main/profile/work-folders', async () => {
  const { existsSync: exists } = await import('fs')
  const { join: joinPath } = await import('path')
  return {
    getWorkFolder: (_profileId: string, productId: string) => {
      const dir = joinPath(__dirname, 'pastas', state.scenarioId, productId)
      return exists(dir) ? dir : null
    }
  }
})
// Num checkout, a data dos arquivos é a do clone: o "parada há N dias" (RN-FLX-11)
// sai de uma tabela fixa, pelo nome da pasta da Feature.
vi.mock('../../src/main/flow/file-times', () => ({
  lastModified: (dir: string) => {
    const days = FOLDER_AGE_DAYS[basename(dir)]
    return days === undefined ? null : state.anchor - days * 24 * 60 * 60 * 1000
  }
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
const organization = await import('../../src/main/services/azure/organization')
const { buildFlowSnapshot } = await import('../../src/main/services/azure/flow-snapshot')
const { getFlowBoard } = await import('../../src/main/services/flow/board')
const { getCatalogView } = await import('../../src/main/services/flow/catalog')
const { getOpportunities } = await import('../../src/main/services/flow/opportunities')
const { previewCatalogAbsorb } = await import('../../src/main/services/flow/absorb')
const { buildSprintGoalRequest } = await import('../../src/main/services/ai/sprint-goal')
const { resolveScope } = await import('../../src/main/services/azure/scope')
const { buildPlanningSummary, summaryToMarkdown } =
  await import('../../src/renderer/src/features/planning/planning-summary')
const { buildPlanningRows, resolveCapacity, resolveSquadCapacity } =
  await import('../../src/renderer/src/features/planning/planning-rules')

const APPROVED_DIR = join(__dirname, 'aprovados')

/** Há quantos dias cada pasta de Feature das pastas fictícias foi alterada pela última vez. */
const FOLDER_AGE_DAYS: Record<string, number> = {
  'pagamento-pix': 3,
  'cupom-categoria': 1,
  'retirada-loja': 10,
  'troca-sem-nota': 60,
  'avaliacao-foto': 45,
  'lista-presentes': 2,
  'frete-gratis': 90,
  'adhoc-troca-gateway': 200
}

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

/** Squad em que a tela abre a seleção; `null` sem Squads (RN-GLB-17). */
function squadOf(selectionId: string): string | null {
  return squadOfSelection(state.config!, selectionId)
}

/** As sprints que a tela vê: as da Squad da seleção, como na aba aberta. */
function sprintsFor(
  selectionId: string,
  limit: number,
  preferFuture = false
): Promise<UnifiedSprint[]> {
  return getUnifiedSprints(limit, preferFuture, squadOf(selectionId))
}

async function planningSprint(selectionId: string): Promise<UnifiedSprint | undefined> {
  return (await sprintsFor(selectionId, PLANNABLE_SPRINTS, true))[0]
}

/** A capacidade que o painel mostra para a seleção (RN-PLN-16, RN-PLN-22). */
function capacityFor(scenario: Scenario, selectionId: string): CapacityConfig {
  const config = state.config!
  const stored = (key: string): object | null =>
    (scenario.workData?.[key] as object | undefined) ?? null
  const squadId = squadOf(selectionId)
  if (squadId === null) {
    return resolveCapacity(config.capacityDefaults, stored(planningKeys.capacity) ?? {})
  }
  return resolveSquadCapacity(
    config.capacityDefaults,
    config.squads.find((s) => s.id === squadId)?.capacityDefaults,
    stored(planningKeys.squadCapacity(squadId)),
    stored(planningKeys.capacity)
  )
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
  'sprint-unificada': async () => {
    const all = {
      revisao: await getUnifiedSprints(HISTORY_SPRINTS),
      planejamento: await getUnifiedSprints(PLANNABLE_SPRINTS, true)
    }
    const squads = state.config!.squads
    if (squads.length === 0) return all
    // Cada aba de Squad tem a própria lista (RN-GLB-17).
    const porSquad: Record<string, unknown> = {}
    for (const squad of squads) {
      porSquad[squad.id] = {
        revisao: await getUnifiedSprints(HISTORY_SPRINTS, false, squad.id),
        planejamento: await getUnifiedSprints(PLANNABLE_SPRINTS, true, squad.id)
      }
    }
    return { ...all, porSquad }
  },

  // A tela abre na sprint mais recente e o PO costuma olhar a anterior: as duas entram.
  entregas: async (scenario) => {
    return perSelection(scenario, async (selectionId) => {
      const sprints = (await sprintsFor(selectionId, DELIVERY_SPRINTS)).slice(0, 2)
      const bySprint: Record<string, unknown> = {}
      for (const sprint of sprints) {
        bySprint[sprint.key] = await getSprintDeliveryData(selectionId, sprint)
      }
      return bySprint
    })
  },

  bugs: async (scenario) => {
    if ((await getUnifiedSprints(HISTORY_SPRINTS)).length === 0) return null
    return perSelection(scenario, async (selectionId) => {
      const sprints = await sprintsFor(selectionId, HISTORY_SPRINTS)
      return sprints.length === 0 ? null : getBugAnalysisData(selectionId, sprints, sprints[0])
    })
  },

  desempenho: async (scenario) => {
    if ((await getUnifiedSprints(HISTORY_SPRINTS)).length === 0) return null
    return perSelection(scenario, async (selectionId) => {
      const sprints = await sprintsFor(selectionId, HISTORY_SPRINTS)
      return sprints.length === 0 ? null : getTeamPerformanceData(selectionId, sprints)
    })
  },

  daily: async (scenario) => {
    if ((await getUnifiedSprints(1)).length === 0) return null
    return perSelection(scenario, async (selectionId) => {
      const [sprint] = await sprintsFor(selectionId, 1)
      return sprint ? getDailyData(selectionId, sprint) : null
    })
  },

  planning: async (scenario) => {
    if ((await getUnifiedSprints(PLANNABLE_SPRINTS, true)).length === 0) return null
    const config = state.config!
    return perSelection(scenario, async (selectionId) => {
      const sprint = await planningSprint(selectionId)
      if (!sprint) return null
      const { products } = resolveScope(selectionId, config)
      const manual = manualItems(scenario, selectionId, sprint)
      // O que o PO puxou de sprint anterior é buscado de novo pelo ID (RN-PLN-10) e
      // o percentual é reaplicado sobre os pontos de agora (RN-PLN-09).
      const remanescentes = await Promise.all(manual.map((item) => getPlanningItem(item.id)))
      const anticipations = products.flatMap((product) => {
        const stored = scenario.workData?.[planningKeys.anticipated(product.id, sprint.key)]
        return Array.isArray(stored) ? (stored as AnticipatedShare[]) : []
      })
      // As linhas como a tela monta: remanescentes relidos e antecipados descontados (RN-PLN-24).
      const items = buildPlanningRows(
        (await getPlanningData(selectionId, sprint)).items,
        manual,
        anticipations,
        new Map(remanescentes.map((item) => [item.id, item]))
      )
      const isGroup = isAggregateSelection(config, selectionId)
      const squad = config.squads.find((s) => s.id === selectionId)
      const selectionName =
        config.groups.find((g) => g.id === selectionId)?.name ??
        (squad ? `Squad ${squad.name}` : undefined) ??
        products[0]?.name ??
        selectionId
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
        capacity: capacityFor(scenario, selectionId),
        productiveHoursPerDay: config.calendar.productiveHoursPerDay,
        storyPoints: config.storyPoints,
        goal: typeof goal === 'string' ? goal : undefined,
        showUnchecked: true
      })

      return {
        sprint: sprint.key,
        dados: await getPlanningData(selectionId, sprint),
        remanescentes,
        resumo: summaryToMarkdown(summary)
      }
    })
  },

  descoberta: async (scenario) => {
    const result: Record<string, unknown> = { projetos: await organization.listProjects() }
    for (const { name } of scenario.azure.projects) {
      const details = await organization.getProcessDetails(name)
      result[name] = {
        times: await organization.listTeams(name),
        areas: await organization.getAreaTree(name),
        processo: details,
        sugestao: organization.suggestProcessProfile(details),
        campos: await organization.listFields(name)
      }
    }
    return result
  },

  // O retrato é por Produto, não por seleção: é o que a IA do PO lê (RN-FLX-01).
  retrato: async () => {
    const result: Record<string, unknown> = {}
    for (const product of state.config!.products) {
      result[product.id] = await buildFlowSnapshot(product.id)
    }
    return result
  },

  // O quadro do fluxo do PO: o retrato que a janela gravaria mais a pasta de
  // trabalho do Produto (RN-FLX-05 a RN-FLX-11).
  fluxo: async () => {
    const result: Record<string, unknown> = {}
    for (const product of state.config!.products) {
      state.workData[flowKeys.snapshot(product.id)] = await buildFlowSnapshot(product.id)
      result[product.id] = getFlowBoard(product.id)
    }
    return result
  },

  // As oportunidades de cada Produto e o encaixe de cada uma (RN-FLX-14 a 16, RN-FLX-25).
  oportunidades: async () => {
    const result: Record<string, unknown> = {}
    for (const product of state.config!.products) {
      state.workData[flowKeys.snapshot(product.id)] = await buildFlowSnapshot(product.id)
      result[product.id] = getOpportunities(product.id)
    }
    return result
  },

  // O catálogo de regras de cada Produto e o que a absorção da wiki mudaria (RN-CAT-01 a 06).
  catalogo: async () => {
    const result: Record<string, unknown> = {}
    for (const product of state.config!.products) {
      const view = getCatalogView(product.id)
      result[product.id] = {
        catalogo: view,
        absorcao:
          view.source?.kind === 'wiki' && view.workFolder === 'ok'
            ? await previewCatalogAbsorb(product.id)
            : null
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
    const calendar = createCalendar(state.config!.calendar)
    // A Home não tem abas: o momento é o da Sprint unificada de todos os Produtos,
    // mesmo com Squads (RN-GLB-17).
    const [sprint] = await getUnifiedSprints(1, false, null)
    return { sprint: sprint?.key ?? null, momento: sprintMoment(sprint, calendar, new Date()) }
  }
}

/**
 * O pedido que o PO copia para a IA (RN-SEC-24) também é resultado aprovado: um
 * campo a mais no pedido aparece no diff. Só existe para Cenário com item de
 * Planning marcado.
 */
async function sprintGoalRequests(scenario: Scenario): Promise<Record<string, unknown> | null> {
  const result: Record<string, unknown> = {}
  for (const selectionId of scenario.selections) {
    const sprint = await planningSprint(selectionId)
    if (!sprint) continue
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
  refreshFlowSnapshot: 'retrato',
  getFlowBoard: 'fluxo',
  getOpportunities: 'oportunidades',
  getCatalog: 'catalogo',
  previewCatalogAbsorb: 'catalogo',
  buildSprintGoalRequest: 'pedido-ia'
}

/** Arquivos de handler cujos canais falam com o Azure. */
const AZURE_HANDLER_FILES = [
  'azure-handlers.ts',
  'organization-handlers.ts',
  'flow-handlers.ts',
  'ai-handlers.ts'
]

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
  state.workData = { ...(scenario.workData ?? {}) }
  state.scenarioId = scenario.id
  state.anchor = new Date(scenario.anchorDate).getTime()
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
