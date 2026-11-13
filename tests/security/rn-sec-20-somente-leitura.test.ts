import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@shared/errors'
import { assertReadOnlyRequest } from '../../src/main/security/network-guard'
import { fixtureResponse } from '../fixtures/azure/responses'

// RN-SEC-20: o app só lê do Azure. GET em tudo; o único POST é a consulta WIQL,
// que é leitura apesar do verbo. Um PAT com escopo de escrita não vira escrita.

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)
vi.mock('@shared/azure', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/azure')>()),
  AZURE_ORG: 'contoso'
}))

const WIQL = new URL('https://dev.azure.com/contoso/Loja/_apis/wit/wiql?api-version=7.1')
const WORK_ITEM = new URL('https://dev.azure.com/contoso/_apis/wit/workitems/101')

function blocked(method: string | undefined, url: URL): boolean {
  try {
    assertReadOnlyRequest(method, url)
    return false
  } catch (error) {
    return error instanceof AppError && error.code === 'AZURE_BLOCKED'
  }
}

describe('RN-SEC-20: somente leitura', () => {
  it('aceita GET (explícito ou implícito) e POST no WIQL', () => {
    expect(blocked(undefined, WORK_ITEM)).toBe(false)
    expect(blocked('get', WORK_ITEM)).toBe(false)
    expect(blocked('POST', WIQL)).toBe(false)
    expect(blocked('POST', new URL('https://dev.azure.com/contoso/Loja/Time/_apis/wit/wiql'))).toBe(
      false
    )
  })

  it.each([
    ['POST em outro endpoint', 'POST', WORK_ITEM],
    [
      'POST no lote de work items',
      'POST',
      new URL('https://dev.azure.com/contoso/_apis/wit/workitemsbatch')
    ],
    [
      'POST com wiql só na query',
      'POST',
      new URL('https://dev.azure.com/contoso/_apis/wit/workitems?x=/_apis/wit/wiql')
    ],
    ['PATCH', 'PATCH', WORK_ITEM],
    ['PUT', 'PUT', WORK_ITEM],
    ['DELETE', 'DELETE', WORK_ITEM],
    ['PATCH no WIQL', 'PATCH', WIQL]
  ])('recusa %s', (_case, method, url) => {
    expect(blocked(method, url)).toBe(true)
  })
})

describe('RN-SEC-20: o client.ts aplica a regra', () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    fixtureResponse('wiql')
  )

  beforeEach(async () => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    // Desde a T-06 o PAT é guardado por Perfil: sem um ativo, savePat recusa.
    // A organização do Perfil é a mesma do AZURE_ORG simulado acima.
    const profiles = await import('../../src/main/profile/profile-store')
    if (!profiles.getActiveProfile())
      profiles.createProfile({ name: 'Contoso', organization: 'contoso' })
    const patStore = await import('../../src/main/security/pat-store')
    patStore.savePat(['FAKE', 'contoso', 'Q'.repeat(24)].join('-'))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('postAzure no WIQL sai e devolve a fixture', async () => {
    const { postAzure } = await import('../../src/main/services/azure/client')
    const body = await postAzure<{ workItems: unknown[] }>('/Loja/_apis/wit/wiql?api-version=7.1', {
      query: 'SELECT [System.Id] FROM WorkItems'
    })
    expect(body.workItems).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('postAzure em qualquer outro endpoint nem sai', async () => {
    const { postAzure } = await import('../../src/main/services/azure/client')
    await expect(postAzure('/_apis/wit/workitems/$Task?api-version=7.1', [])).rejects.toMatchObject(
      { code: 'AZURE_BLOCKED' }
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
