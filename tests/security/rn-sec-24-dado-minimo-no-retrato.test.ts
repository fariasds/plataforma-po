import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { flowKeys, type FlowSnapshot } from '@shared/flow-snapshot'
import { IPC_CHANNELS } from '@shared/ipc'
import { createFakeAzure, type FakeAzure } from '../../src/main/demo/fake-azure'
import { fluxoDoPo } from '../../src/main/demo/scenarios/fluxo-do-po'
import type { FakeWorkItem } from '../../src/main/demo/types'

// RN-SEC-24, ampliada ao retrato do fluxo do PO (RN-FLX-01, ADR 0011): o retrato
// vai para a IA do PO pelo servidor MCP. Só os campos permitidos entram, em texto
// puro e redigidos, e a janela recebe só as contagens. Dados fictícios: organização
// `contoso`, o Cenário `fluxo-do-po`.

const state = vi.hoisted(() => ({
  config: null as Configuration | null,
  azure: null as FakeAzure | null,
  written: new Map<string, unknown>()
}))

vi.mock('../../src/main/profile/config-loader', () => ({ getActiveConfig: () => state.config }))
vi.mock('../../src/main/profile/profile-store', () => ({
  requireActiveProfile: () => ({ id: 'contoso', name: 'Contoso', dir: '' })
}))
vi.mock('../../src/main/profile/work-data', () => ({
  writeWorkData: (_profile: string, key: string, value: unknown) => state.written.set(key, value)
}))
vi.mock('../../src/main/services/azure/client', () => ({
  fetchAzure: (path: string) => state.azure!.fetchAzure(path),
  postAzure: (path: string, body: unknown) => state.azure!.postAzure(path, body)
}))

const { rememberSecret, REDACTED } = await import('../../src/main/security/redact')
const { refreshFlowSnapshot } = await import('../../src/main/services/azure/flow-snapshot')

// Tokens falsos montados em tempo de execução: o arquivo não tem forma de token,
// e o hook de pre-commit (RN-SEC-28) não o barra.
const SECRETS: Array<[string, string]> = [
  ['PAT clássico do Azure', 'q'.repeat(26) + '2'.repeat(26)],
  ['PAT novo do Azure', 'A'.repeat(76) + 'AZDO' + 'B1c2'],
  ['token do GitHub', 'gh' + 'p_' + 'X'.repeat(36)],
  ['token granular do GitHub', 'github' + '_pat_' + 'Y'.repeat(62)],
  ['cabeçalho Basic', 'Basic ' + Buffer.from(':segredo-de-teste-contoso').toString('base64')]
]
/** O PAT do Perfil ativo não tem forma conhecida: só a rede do valor conhecido o pega. */
const PROFILE_PAT = ['contoso', 'perfil', 'Z'.repeat(20)].join('-')

/** O que nunca pode sair do Azure para o retrato. */
const PRIVATE = {
  'System.AssignedTo': { displayName: 'Ana Souza', uniqueName: 'ana@contoso.example' },
  'System.History': 'conversa interna com a Fabrikam',
  'Microsoft.VSTS.Scheduling.Effort': 13
}

/** O Cenário, com segredo e campo privado em todo item que o retrato lê. */
function activate(secret: string): void {
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  state.config = parsed.config
  const workItems: FakeWorkItem[] = fluxoDoPo.azure.workItems.map((item) => ({
    ...item,
    fields: {
      ...item.fields,
      ...PRIVATE,
      'System.Title': `${String(item.fields['System.Title'])} ${secret}`,
      'System.Description':
        `<p>Use ${secret} no teste.</p><script>alert(1)</script>` +
        '<a href="https://evil.example/doc">anexo</a><img src="https://evil.example/p.png">'
    }
  }))
  state.azure = createFakeAzure({ ...fluxoDoPo.azure, workItems })
  state.written.clear()
}

async function snapshotOf(
  productId: string
): Promise<{ summary: unknown; snapshot: FlowSnapshot }> {
  const summary = await refreshFlowSnapshot(productId)
  const snapshot = state.written.get(flowKeys.snapshot(productId)) as FlowSnapshot
  return { summary, snapshot }
}

beforeEach(() => activate(''))

describe('RN-SEC-24: o retrato leva só os campos permitidos', () => {
  it('cada coleção tem só as chaves do contrato', async () => {
    const { snapshot } = await snapshotOf('loja')
    const keys = (items: object[]): string[] => [...new Set(items.flatMap(Object.keys))].sort()
    expect(keys(snapshot.features)).toEqual([
      'childIds',
      'createdDate',
      'id',
      'parentId',
      'priority',
      'state',
      'stateChangeDate',
      'title',
      'type'
    ])
    expect(keys(snapshot.children)).toEqual(['id', 'parentId', 'state', 'title', 'type'])
    expect(keys(snapshot.feedbacks!)).toEqual([
      'description',
      'featureIds',
      'id',
      'parentId',
      'state',
      'title',
      'type'
    ])
    expect(keys(snapshot.bugs)).toEqual([
      'closedDate',
      'createdDate',
      'description',
      'id',
      'open',
      'parentId',
      'state',
      'title',
      'type'
    ])
  })

  it('pessoa, histórico e esforço não entram, nem com os vínculos que trazem todos os campos', async () => {
    for (const productId of ['loja', 'app']) {
      const { snapshot } = await snapshotOf(productId)
      expect(JSON.stringify(snapshot)).not.toMatch(/Ana Souza|contoso\.example|Fabrikam|Effort/)
    }
  })

  it('da descrição vai só o texto: sem marcação, script, nem endereço de link ou imagem', async () => {
    const { snapshot } = await snapshotOf('loja')
    const texts = [...snapshot.feedbacks!, ...snapshot.bugs].map((item) => item.description)
    expect(texts.join('\n')).not.toMatch(/<|>|alert|evil\.example/)
    expect(snapshot.feedbacks![0].description).toContain('anexo')
  })

  it('bug fechado não leva descrição', async () => {
    const { snapshot } = await snapshotOf('loja')
    expect(snapshot.bugs.filter((bug) => !bug.open).map((bug) => bug.description)).toEqual([''])
  })

  it('a janela recebe só as contagens e a data, nunca título ou descrição', async () => {
    const { summary } = await snapshotOf('loja')
    expect(Object.keys(summary as object).sort()).toEqual([
      'bugs',
      'children',
      'features',
      'feedbacks',
      'openBugs',
      'productId',
      'takenAt'
    ])
    expect(IPC_CHANNELS.refreshFlowSnapshot).toBe('flow:refresh-snapshot')
  })

  it('a janela manda só o ID do Produto: outra coisa é recusada antes de ler o Azure', async () => {
    for (const id of ['nao-existe', { products: ['loja'] }, 1]) {
      await expect(refreshFlowSnapshot(id as string)).rejects.toMatchObject({
        code: 'SELECTION_UNKNOWN'
      })
    }
    expect(state.azure!.calls).toEqual([])
  })
})

describe('RN-SEC-24: credencial dentro do conteúdo sai redigida do retrato', () => {
  it.each(SECRETS)('%s no título e na descrição', async (_case, secret) => {
    activate(secret)
    for (const productId of ['loja', 'app']) {
      const { snapshot } = await snapshotOf(productId)
      const json = JSON.stringify(snapshot)
      expect(json).not.toContain(secret)
      expect(snapshot.features[0].title).toContain(REDACTED)
      expect(snapshot.feedbacks![0].description).toContain(REDACTED)
    }
  })

  it('o PAT do Perfil ativo sai, cru e em base64, mesmo sem forma conhecida', async () => {
    // É o que o cliente do Azure faz a cada chamada (RN-SEC-19).
    rememberSecret(PROFILE_PAT)
    const encoded = Buffer.from(`:${PROFILE_PAT}`).toString('base64')
    activate(`${PROFILE_PAT} ${encoded}`)
    const json = JSON.stringify((await snapshotOf('loja')).snapshot)
    expect(json).not.toContain(PROFILE_PAT)
    expect(json).not.toContain(encoded)
  })
})
