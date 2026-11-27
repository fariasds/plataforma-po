import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { flowKeys } from '@shared/flow-snapshot'

// RN-FLX-12, RN-FLX-13: o clique do PO grava o ID na pasta de trabalho, e só um ID
// que o main encontrou. Dados fictícios: o Cenário `fluxo-do-po`, numa cópia
// temporária da pasta de trabalho dele.

const state = vi.hoisted(() => ({ config: null as Configuration | null }))

vi.mock(
  'electron',
  async () => (await import('../../../../tests/helpers/electron-mock')).electronMock
)
vi.mock('../../profile/config-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../profile/config-loader')>()),
  getActiveConfig: () => state.config
}))

const mock = await import('../../../../tests/helpers/electron-mock')
const { fluxoDoPo } = await import('../../demo/scenarios/fluxo-do-po')
const { createFakeAzure } = await import('../../demo/fake-azure')
const store = await import('../../profile/profile-store')
const workData = await import('../../profile/work-data')
const folders = await import('../../profile/work-folders')

vi.mock('../azure/client', () => ({
  fetchAzure: (path: string) => fake.fetchAzure(path),
  postAzure: (path: string, body: unknown) => fake.postAzure(path, body)
}))
const fake = createFakeAzure(fluxoDoPo.azure)

const { buildFlowSnapshot } = await import('../azure/flow-snapshot')
const { linkDraftFeature, linkPlannedPbi } = await import('./reconcile')

const FIXTURE = resolve(__dirname, '../../../../tests/regression/pastas/fluxo-do-po/loja')

let root = ''
let profileId = ''

function plan(): string {
  return readFileSync(join(root, 'features/pagamento-pix/plano-pbis.md'), 'utf8')
}

beforeEach(async () => {
  mock.resetElectronMock()
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  state.config = parsed.config
  profileId = store.createProfile({ name: 'Contoso', organization: 'contoso' }).id
  root = mkdtempSync(join(tmpdir(), 'pasta-do-po-'))
  cpSync(FIXTURE, root, { recursive: true })
  folders.setWorkFolder(profileId, 'loja', root)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(fluxoDoPo.anchorDate))
  workData.writeWorkData(profileId, flowKeys.snapshot('loja'), await buildFlowSnapshot('loja'))
  vi.useRealTimers()
})

describe('linkPlannedPbi', () => {
  it('grava o ID do candidato igual e deixa o resto da linha', () => {
    const board = linkPlannedPbi('loja', 'pagamento-pix', 'P3', 4213)
    expect(plan()).toContain('Azure: #4213 · Status: Planejado · Arquivo: —')
    const pix = board.features.find((f) => f.slug === 'pagamento-pix')!
    expect(pix.reconciliation.pbis.map((r) => r.pbi)).toEqual(['P4'])
  })

  it('grava o candidato parecido, depois do clique do PO', () => {
    linkPlannedPbi('loja', 'pagamento-pix', 'P4', 4214)
    expect(plan()).toContain('Azure: #4214 · Status: Planejado')
  })

  it('preserva o CRLF do arquivo do PO', () => {
    const file = join(root, 'features/pagamento-pix/plano-pbis.md')
    writeFileSync(file, plan().replace(/\n/g, '\r\n'))
    linkPlannedPbi('loja', 'pagamento-pix', 'P3', 4213)
    expect(plan()).toContain('Azure: #4213 · Status: Planejado · Arquivo: —\r\n')
    expect(plan().replace(/\r\n/g, '')).not.toContain('\n')
  })

  it.each([
    ['ID que não é candidato', 'pagamento-pix', 'P3', 4214],
    ['PBI que já tem ID', 'pagamento-pix', 'P1', 4211],
    ['pasta que o quadro não conhece', '../pagamento-pix', 'P3', 4213],
    ['ID inválido', 'pagamento-pix', 'P3', -1]
  ])('recusa %s, sem mexer no arquivo', (_case, slug, pbi, id) => {
    const before = plan()
    expect(() => linkPlannedPbi('loja', slug, pbi, id)).toThrow(
      expect.objectContaining({ code: 'RECONCILE_STALE' })
    )
    expect(plan()).toBe(before)
  })
})

describe('linkDraftFeature', () => {
  it('troca "#a criar" pelo ID da Feature que tem o mesmo título', () => {
    const board = linkDraftFeature('loja', 'retirada-loja', 4120)
    expect(readFileSync(join(root, 'features/retirada-loja/README.md'), 'utf8')).toContain(
      'Feature: #4120'
    )
    expect(board.features.find((f) => f.slug === 'retirada-loja')?.featureId).toBe(4120)
  })

  it('recusa Feature que não é candidata', () => {
    expect(() => linkDraftFeature('loja', 'retirada-loja', 4102)).toThrow(
      expect.objectContaining({ code: 'RECONCILE_STALE' })
    )
  })
})
