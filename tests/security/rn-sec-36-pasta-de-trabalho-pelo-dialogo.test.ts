import { mkdirSync, mkdtempSync, readFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, relative } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { IPC_CHANNELS } from '@shared/ipc'
import { fluxoDoPo } from '../../src/main/demo/scenarios/fluxo-do-po'

// RN-SEC-36: a IA do PO vai gravar na pasta de trabalho (ADR 0013). Por isso ela
// só nasce do diálogo do sistema, escolhida pelo PO: nenhum caminho vem da janela,
// e a pasta nunca é a de dados do app, nem fica dentro dela ou a contém. Dados
// fictícios: organização `contoso`, Produto "Loja Online".

type Invoke = (
  event: unknown,
  ...args: unknown[]
) => Promise<{ ok: boolean; data?: unknown; error?: { code: string } }>

const fake = vi.hoisted(() => ({
  handlers: new Map<string, Invoke>(),
  config: null as Configuration | null
}))

vi.mock('electron', async () => ({
  ...(await import('../helpers/electron-mock')).electronMock,
  ipcMain: { handle: (channel: string, handler: Invoke) => fake.handlers.set(channel, handler) },
  BrowserWindow: { getAllWindows: () => [], getFocusedWindow: () => null }
}))
vi.mock('../../src/main/profile/config-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/main/profile/config-loader')>()),
  getActiveConfig: () => fake.config
}))

const mock = await import('../helpers/electron-mock')
const store = await import('../../src/main/profile/profile-store')
const paths = await import('../../src/main/profile/paths')
const { registerProfileHandlers } = await import('../../src/main/ipc/profile-handlers')

registerProfileHandlers()

function call(method: keyof typeof IPC_CHANNELS, ...args: unknown[]): ReturnType<Invoke> {
  const handler = fake.handlers.get(IPC_CHANNELS[method])
  if (!handler) throw new Error(`sem handler: ${method}`)
  return handler({}, ...args)
}

function storedFolders(profileId: string): Record<string, string> {
  const file = paths.workFoldersPath(profileId)
  return existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as { folders: Record<string, string> }).folders
    : {}
}

/** Uma pasta de verdade fora dos dados do app, como Documentos. */
function outsideFolder(): string {
  return mkdtempSync(join(tmpdir(), 'pasta-do-po-'))
}

let profileId = ''

beforeEach(() => {
  mock.resetElectronMock()
  const parsed = validateConfiguration(fluxoDoPo.config)
  if (!parsed.ok) throw new Error('Configuração do Cenário inválida')
  fake.config = parsed.config
  profileId = store.createProfile({ name: 'Contoso', organization: 'contoso' }).id
})

describe('RN-SEC-36: a pasta de trabalho só vem do diálogo do sistema', () => {
  it('o contrato só recebe o ID do Produto; um caminho a mais é ignorado', async () => {
    const chosen = outsideFolder()
    mock.setOpenDialogResult({ canceled: false, filePaths: [chosen] })
    const envelope = await call('chooseWorkFolder', 'loja', 'C:\\Windows')
    expect(envelope.ok).toBe(true)
    expect(storedFolders(profileId)).toEqual({ loja: expect.stringContaining('pasta-do-po-') })
    expect(storedFolders(profileId).loja).not.toMatch(/Windows/)
  })

  it('cancelar não grava nada', async () => {
    const envelope = await call('chooseWorkFolder', 'loja')
    expect(envelope).toEqual({ ok: true, data: null })
    expect(storedFolders(profileId)).toEqual({})
  })

  it.each([
    ['a própria pasta de dados do app', () => mock.getUserDataDir()],
    [
      'uma pasta dentro dela',
      () => {
        const dir = join(mock.getUserDataDir(), 'perfis', 'outra')
        mkdirSync(dir, { recursive: true })
        return dir
      }
    ],
    ['uma pasta que a contém', () => dirname(mock.getUserDataDir())]
  ])('recusa %s', async (_case, folder) => {
    mock.setOpenDialogResult({ canceled: false, filePaths: [folder()] })
    const envelope = await call('chooseWorkFolder', 'loja')
    expect(envelope.ok).toBe(false)
    expect(envelope.error?.code).toBe('WORK_FOLDER_INVALID')
    expect(storedFolders(profileId)).toEqual({})
  })

  it('recusa caminho relativo e pasta que não existe', async () => {
    for (const folder of ['pasta-relativa', join(outsideFolder(), 'nao-existe')]) {
      mock.setOpenDialogResult({ canceled: false, filePaths: [folder] })
      const envelope = await call('chooseWorkFolder', 'loja')
      expect(envelope.error?.code).toBe('WORK_FOLDER_INVALID')
    }
    expect(storedFolders(profileId)).toEqual({})
  })

  it('Produto fora da Configuração é recusado antes de abrir o diálogo', async () => {
    const envelope = await call('chooseWorkFolder', 'nao-existe')
    expect(envelope.error?.code).toBe('SELECTION_UNKNOWN')
    expect(mock.getOpenDialogCalls()).toEqual([])
  })

  it('o arquivo das pastas fica fora de dados/, onde a janela grava', () => {
    const rel = relative(paths.workDataDir(profileId), paths.workFoldersPath(profileId))
    expect(rel.startsWith('..')).toBe(true)
    // A chave dos Dados de trabalho não tem ponto nem barra: não alcança o arquivo.
    const workFolderMethods = Object.keys(IPC_CHANNELS).filter((m) => /WorkFolder/.test(m))
    expect(workFolderMethods.sort()).toEqual([
      'chooseWorkFolder',
      'clearWorkFolder',
      'getWorkFolders'
    ])
  })
})
