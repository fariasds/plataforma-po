import { existsSync, readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IpcApi } from '@shared/ipc'
import { IPC_CHANNELS } from '@shared/ipc'
import { getUserDataDir, resetElectronMock } from '../helpers/electron-mock'
import { fixtureResponse } from '../fixtures/azure/responses'

// RN-SEC-27: o Perfil de demonstração é servido pelo Azure fictício, sem rede e
// sem PAT. Quem decide o desvio é o tipo do Perfil ativo, lido no main; nem a
// organização nem a janela entram na conta. Valores fictícios.

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)

// `requirePat` espionado sem mudar o comportamento: o caminho de demonstração
// nunca pode chamá-lo.
vi.mock('../../src/main/security/pat-store', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/main/security/pat-store')>()
  return { ...real, requirePat: vi.fn(real.requirePat) }
})

// Os handlers são registrados num mapa, para chamar o `savePat` de verdade.
const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('../../src/main/ipc/registry', () => ({
  handle: (method: string, handler: (...args: unknown[]) => unknown) =>
    handlers.set(method, handler)
}))

const profiles = await import('../../src/main/profile/profile-store')
const { reloadProfileState, resetConfigLoader } =
  await import('../../src/main/profile/config-loader')
const patStore = await import('../../src/main/security/pat-store')
const client = await import('../../src/main/services/azure/client')
const { openExternalIfAllowed } = await import('../../src/main/security/network-guard')
const { registerPatHandlers } = await import('../../src/main/ipc/pat-handlers')
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
const { buildPlanningSummary, summaryToMarkdown } =
  await import('../../src/renderer/src/features/planning/planning-summary')

registerPatHandlers()

const ROOT = resolve(__dirname, '../..')
const FAKE_PAT = ['FAKE', 'contoso', 'R'.repeat(24)].join('-')
const SELECTIONS = ['digital', 'loja', 'app']

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
  fixtureResponse('projects')
)
const requirePat = vi.mocked(patStore.requirePat)

function secrets(): string[] {
  const dir = join(getUserDataDir(), 'segredos')
  return existsSync(dir) ? readdirSync(dir) : []
}

function startDemo(): void {
  profiles.startDemoProfile()
  client.clearAvatarCache()
  clearUserProfileCache()
  reloadProfileState()
}

/** Um Perfil com Azure de verdade, na mesma organização fictícia da demonstração. */
function startRealContoso(): void {
  profiles.createProfile({ name: 'Contoso real', organization: 'contoso' })
  patStore.savePat(FAKE_PAT)
  reloadProfileState()
}

/** Toda tela do app, como na regressão: cada uma lê o Azure pelo `client.ts`. */
async function runEveryScreen(): Promise<void> {
  const history = await getUnifiedSprints(12)
  const [current] = await getUnifiedSprints(5, true)
  expect(history.length).toBeGreaterThan(0)
  for (const selectionId of SELECTIONS) {
    await getSprintDeliveryData(selectionId, history[0])
    await getBugAnalysisData(selectionId, history, history[0])
    await getTeamPerformanceData(selectionId, history)
    await getDailyData(selectionId, history[0])
    const planning = await getPlanningData(selectionId, current)
    const ids = planning.items.map((item) => item.id)
    if (ids.length > 0) {
      await getPlanningItem(ids[0])
      await buildSprintGoalRequest(selectionId, current, ids)
    }
  }
  clearUserProfileCache()
  expect(await getCurrentUser()).toMatchObject({ displayName: 'Ana Souza', avatar: null })
  await discovery.listProjects()
  await discovery.listTeams('Contoso')
  await discovery.getAreaTree('Contoso')
  await discovery.getProcessDetails('Contoso')
  await discovery.listFields('Contoso')
}

describe('RN-SEC-27: Perfil de demonstração sem rede e sem PAT', () => {
  beforeEach(() => {
    resetElectronMock()
    resetConfigLoader()
    fetchMock.mockClear()
    requirePat.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    resetConfigLoader()
    vi.unstubAllGlobals()
  })

  it('com a demonstração ativa, toda tela roda sem fetch e sem ler o PAT', async () => {
    startDemo()
    expect(reloadProfileState()).toMatchObject({ status: 'ready', profile: { kind: 'demo' } })

    await runEveryScreen()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(requirePat).not.toHaveBeenCalled()
    expect(secrets()).toEqual([])
  })

  it('a demonstração não pede PAT, não tem PAT e recusa gravar um', async () => {
    startDemo()
    expect(reloadProfileState().status).toBe('ready')
    expect(patStore.hasPat()).toBe(false)

    // Pelo handler da janela: recusado antes de o token ser testado no Azure.
    const savePat = handlers.get('savePat')!
    await expect(Promise.resolve().then(() => savePat(FAKE_PAT))).rejects.toMatchObject({
      code: 'PROFILE_INVALID'
    })
    expect(fetchMock).not.toHaveBeenCalled()

    // E direto no cofre, com e sem o ID do Perfil.
    const { id } = profiles.requireActiveProfile()
    expect(() => patStore.savePat(FAKE_PAT)).toThrow(/demonstração/)
    expect(() => patStore.savePat(FAKE_PAT, id)).toThrow(/demonstração/)
    expect(secrets()).toEqual([])
    expect(patStore.hasPat()).toBe(false)
  })

  it('um Perfil real com organização contoso vai para o Azure de verdade', async () => {
    startRealContoso()

    await client.fetchAzure('/_apis/projects?api-version=7.1')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://dev.azure.com/contoso/_apis/projects?api-version=7.1'
    )
    expect(requirePat).toHaveBeenCalled()
  })

  it('cada pedido vai pelo caminho do Perfil ativo no momento, nas duas trocas', async () => {
    startDemo()
    await client.fetchAzure('/_apis/projects?api-version=7.1&$top=100&$skip=0')
    expect(fetchMock).not.toHaveBeenCalled()

    // Demonstração → real.
    startRealContoso()
    await client.fetchAzure('/_apis/projects?api-version=7.1')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Real → demonstração: a mesma, que continuou na lista de Perfis.
    startDemo()
    expect(profiles.listProfiles().map((p) => p.kind ?? 'azure')).toEqual(['demo', 'azure'])
    expect(reloadProfileState().hasAzureProfile).toBe(true)
    await client.fetchAzure('/_apis/projects?api-version=7.1&$top=100&$skip=0')
    expect(await client.fetchAzureAvatar('https://dev.azure.com/contoso/_apis/x/y')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Demonstração → real de novo, pela saída da faixa: o mesmo Perfil, sem criar outro.
    profiles.leaveDemoProfile()
    expect(reloadProfileState().profile).toMatchObject({ kind: 'azure', name: 'Contoso real' })
    expect(profiles.listProfiles()).toHaveLength(2)
    await client.fetchAzure('/_apis/projects?api-version=7.1')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sem Perfil real, sair da demonstração é recusado, e nada vai para a rede', () => {
    startDemo()
    expect(reloadProfileState().hasAzureProfile).toBe(false)
    expect(() => profiles.leaveDemoProfile()).toThrow(/Perfil com o seu Azure/)
    expect(profiles.requireActiveProfile().kind).toBe('demo')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('nenhum método da IpcApi recebe parâmetro que escolha o caminho dos dados', () => {
    const source = readFileSync(join(ROOT, 'src/shared/ipc.ts'), 'utf8')
    // CRLF ou LF: o checkout pode ter qualquer um, e o corte errado leria a
    // `IpcSubscriptions` junto.
    const api = source.split('export interface IpcApi {')[1].split(/\r?\n\}\r?\n/)[0]
    const signatures = [...api.matchAll(/^\s{2}(\w+)\(([^)]*)\)/gm)].map(([, name, params]) => ({
      name,
      params
    }))
    // O contrato inteiro foi lido, senão a checagem abaixo passaria à toa.
    expect(signatures.map((s) => s.name).sort()).toEqual(Object.keys(IPC_CHANNELS).sort())

    const choosesPath = /demo|fake|fict|scenario|cen[aá]rio|kind|source|origem|mock|offline/i
    expect(signatures.filter((s) => choosesPath.test(s.params))).toEqual([])
    const demoMethods: (keyof IpcApi)[] = ['startDemo', 'restoreDemo', 'leaveDemo']
    for (const method of demoMethods) {
      expect(signatures.find((s) => s.name === method)?.params.trim()).toBe('')
    }
  })

  it('na demonstração, nenhum link externo é gerado nem aberto', () => {
    startDemo()
    const open = vi.fn()
    const url = 'https://dev.azure.com/contoso/_workitems/edit/10601'
    expect(client.externalLinkOrganization()).toBeNull()
    expect(openExternalIfAllowed(url, client.externalLinkOrganization(), open)).toBe(false)
    expect(open).not.toHaveBeenCalled()

    // O resumo do Planning, que vira Markdown com link por item, sai sem link.
    const summary = buildPlanningSummary({
      organization: null,
      selectionName: 'Loja Online',
      sprintLabel: 'Sprint 6',
      generatedAt: '(data)',
      products: [{ id: 'loja', name: 'Loja Online' }],
      isGroup: false,
      items: [
        {
          id: 10601,
          title: 'Checkout em uma etapa',
          type: 'Product Backlog Item',
          state: 'Committed',
          product: 'loja',
          storyPoints: 5,
          assignee: null
        }
      ] as never,
      uncheckedIds: new Set(),
      manualIds: new Set(),
      effort: { frontend: false, backend: false, qa: false },
      capacity: {
        frontDevs: 2,
        backDevs: 2,
        sprintDays: 10,
        frontBugPercent: 20,
        backBugPercent: 20
      } as never,
      productiveHoursPerDay: 6,
      storyPoints: { '1': 2, '2': 4, '3': 8, '5': 16 },
      showUnchecked: true
    })
    const markdown = summaryToMarkdown(summary)
    expect(markdown).toContain('10601')
    expect(markdown).not.toMatch(/https?:\/\//)

    // Fora da demonstração, o mesmo link abre.
    startRealContoso()
    expect(openExternalIfAllowed(url, client.externalLinkOrganization(), open)).toBe(true)
  })
})
