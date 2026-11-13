import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { IPC_CHANNELS, type IpcApi } from '@shared/ipc'
import { echoAuthorizationError } from '../fixtures/azure/responses'

// RN-SEC-10: nenhum envelope que volta à janela, de sucesso ou de erro, carrega o
// PAT. O pior caso é o servidor que ecoa o cabeçalho Authorization: o status dele
// entra na mensagem do erro, e só a redação impede que a mensagem leve o token.

type Invoke = (event: unknown, ...args: unknown[]) => Promise<unknown>

const fake = vi.hoisted(() => ({ handlers: new Map<string, Invoke>() }))

vi.mock('electron', async () => ({
  ...(await import('../helpers/electron-mock')).electronMock,
  ipcMain: {
    handle: (channel: string, handler: Invoke) => fake.handlers.set(channel, handler)
  }
}))

vi.mock('@shared/azure', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/azure')>()),
  AZURE_ORG: 'contoso'
}))

// Montado em partes e fora das formas de token: se aparecer no envelope, foi o
// valor conhecido que vazou, não uma forma que a regex pegaria por acaso.
const FAKE_PAT = ['FAKE', 'contoso', 'pat', 'Q'.repeat(24)].join('-')
const FORMS = [
  FAKE_PAT,
  Buffer.from(`:${FAKE_PAT}`).toString('base64'),
  Buffer.from(FAKE_PAT).toString('base64')
]

const sprint = {
  key: '2026-01',
  label: 'Sprint 1',
  startDate: '2026-01-05T00:00:00Z',
  finishDate: '2026-01-16T00:00:00Z'
}

// Argumentos plausíveis por canal. Os produtos são fictícios de propósito: o que
// importa é o caminho até o `fetch` e de volta como erro.
const ARGS: { [K in keyof IpcApi]: unknown[] } = {
  hasPat: [],
  savePat: [FAKE_PAT],
  getSprints: [3, false],
  getSprintDelivery: ['loja', sprint],
  getTeamPerformance: ['loja', [sprint]],
  getBugAnalysis: ['loja', [sprint], sprint],
  getPlanning: ['loja', sprint],
  getPlanningItem: [101],
  getDaily: ['loja', sprint],
  getCurrentUser: [],
  // A descoberta roda antes de haver Configuração válida, com o mesmo PAT.
  discoverProjects: [],
  discoverTeams: ['Loja Online'],
  discoverAreas: ['Loja Online'],
  discoverProcess: ['Loja Online'],
  discoverFields: ['Loja Online'],
  // createProfile leva o PAT ao Azure para validá-lo: o eco do erro não pode voltar.
  getProfileState: [],
  createProfile: [{ name: 'Loja Online', organization: 'contoso', pat: FAKE_PAT }],
  importConfig: ['{}'],
  openProfileFolder: [],
  readWorkData: ['planning:loja'],
  writeWorkData: ['planning:loja', { items: [] }],
  // A IA entra para provar que o caminho dela também não devolve o PAT.
  buildSprintGoalRequest: ['loja', sprint, [101]],
  clearPat: [],
  // A demonstração por último: ela troca o Perfil ativo (RN-SEC-27).
  startDemo: [],
  restoreDemo: [],
  leaveDemo: []
}

const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => echoAuthorizationError(init))
const envelopes = new Map<string, unknown>()
// Cópia das chamadas: o Vitest zera o histórico do mock entre um teste e outro.
const sentHeaders: string[] = []

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  const { registerIpcHandlers } = await import('../../src/main/ipc')
  // Desde a T-06 o PAT é guardado por Perfil: sem um ativo, savePat recusa.
  // A organização do Perfil é a mesma do AZURE_ORG simulado acima.
  const profiles = await import('../../src/main/profile/profile-store')
  if (!profiles.getActiveProfile())
    profiles.createProfile({ name: 'Contoso', organization: 'contoso' })
  const patStore = await import('../../src/main/security/pat-store')
  registerIpcHandlers()
  patStore.savePat(FAKE_PAT)

  // clearPat por último: os demais precisam do token guardado.
  for (const [method, args] of Object.entries(ARGS)) {
    const channel = IPC_CHANNELS[method as keyof IpcApi]
    const handler = fake.handlers.get(channel)
    if (!handler) throw new Error(`canal sem handler: ${channel}`)
    envelopes.set(method, await handler({}, ...args))
  }
  for (const [, init] of fetchMock.mock.calls) {
    sentHeaders.push(new Headers(init?.headers).get('authorization') ?? '')
  }
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('RN-SEC-10: nenhum envelope de IPC contém o PAT', () => {
  it('todos os canais do contrato foram chamados', () => {
    expect([...envelopes.keys()].sort()).toEqual(Object.keys(IPC_CHANNELS).sort())
  })

  it('o servidor recebeu o PAT e o ecoou — o cenário de vazamento existiu', () => {
    expect(sentHeaders.length).toBeGreaterThan(0)
    expect(sentHeaders.some((header) => header.includes(FORMS[1]))).toBe(true)
  })

  it.each(Object.keys(ARGS))('%s não devolve o PAT nem o base64 dele', (method) => {
    const serialized = JSON.stringify(envelopes.get(method))
    for (const form of FORMS) expect(serialized).not.toContain(form)
  })

  it('o erro que ecoou o cabeçalho chega redigido, não vazio', () => {
    const envelope = envelopes.get('savePat') as { ok: boolean; error?: { message: string } }
    expect(envelope.ok).toBe(false)
    expect(envelope.error?.message).toContain('[REDACTED]')
  })
})
