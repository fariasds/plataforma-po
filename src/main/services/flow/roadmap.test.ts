import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { flowKeys } from '@shared/flow-snapshot'

// ADR 0017, RN-RDM-02: a janela grava o roadmap.json da pasta de trabalho; o plano do
// rascunho adotado troca de chave, e arquivo que não valida não é sobrescrito. Dados
// fictícios: o Cenário `fluxo-do-po`, numa cópia temporária da pasta de trabalho dele.

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
const { linkDraftFeature } = await import('./reconcile')
const { createRoadmapMilestone, updateRoadmap } = await import('./roadmap')

const FIXTURE = resolve(__dirname, '../../../../tests/regression/pastas/fluxo-do-po/loja')

let root = ''
let profileId = ''

function roadmap(): { features: Record<string, unknown>; milestones: unknown[] } {
  return JSON.parse(readFileSync(join(root, 'roadmap.json'), 'utf8'))
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

describe('updateRoadmap', () => {
  it('o rascunho adotado leva o plano para a chave do Azure (RN-RDM-02)', () => {
    linkDraftFeature('loja', 'retirada-loja', 4120)
    updateRoadmap('loja', { kind: 'archive', key: '#4120', archived: false })
    const file = roadmap()
    expect(file.features['pasta:retirada-loja']).toBeUndefined()
    expect(file.features['#4120']).toMatchObject({ archived: false })
  })

  it('recusa Feature que o quadro não conhece e chave com caminho', () => {
    expect(() => updateRoadmap('loja', { kind: 'archive', key: '#999', archived: true })).toThrow(
      expect.objectContaining({ code: 'ROADMAP_STALE' })
    )
    expect(() =>
      updateRoadmap('loja', { kind: 'archive', key: 'pasta:../../x', archived: true })
    ).toThrow(expect.objectContaining({ code: 'ROADMAP_INVALID' }))
  })

  it('arquivo que não valida não é sobrescrito', () => {
    writeFileSync(join(root, 'roadmap.json'), '{"version": 2}')
    expect(() => updateRoadmap('loja', { kind: 'archive', key: '#4088', archived: true })).toThrow(
      expect.objectContaining({ code: 'ROADMAP_INVALID' })
    )
    expect(readFileSync(join(root, 'roadmap.json'), 'utf8')).toBe('{"version": 2}')
  })

  it('o marco vai para toda pasta disponível (RN-RDM-21)', () => {
    expect(createRoadmapMilestone(' Revisão ')).toBe(1)
    expect(roadmap().milestones).toHaveLength(2)
  })
})
