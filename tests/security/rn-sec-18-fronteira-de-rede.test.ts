import { readdirSync, readFileSync } from 'fs'
import { extname, join, relative, resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@shared/errors'
import {
  assertAllowedAzureUrl,
  isAllowedRendererRequest
} from '../../src/main/security/network-guard'
import { fixtureResponse } from '../fixtures/azure/responses'

// RN-SEC-18: o PAT só vai para a organização configurada no Azure DevOps. A
// barreira é o `client.ts` — o `fetch` do Node não passa pelo `session` do
// Electron — e o teste estático garante que não existe outro caminho de saída.

vi.mock('electron', async () => (await import('../helpers/electron-mock')).electronMock)
vi.mock('@shared/azure', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@shared/azure')>()),
  AZURE_ORG: 'contoso'
}))

const ORG = 'contoso'
const ROOT = resolve(__dirname, '../..')
const CLIENT = 'src/main/services/azure/client.ts'
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs'])

/** Toda forma de abrir conexão de rede a partir do Node ou do Electron. */
const NETWORK_CALL =
  /\bfetch\s*\(|\bnet\.request\b|\bhttps?\.request\b|\bhttps?\.get\b|electron\.net\b|\bundici\b|import\s*\{[^}]*\bnet\b[^}]*\}\s*from\s*['"]electron['"]/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return SOURCE_EXTENSIONS.has(extname(entry.name)) ? [full] : []
  })
}

function rejects(url: string): boolean {
  try {
    assertAllowedAzureUrl(url, ORG)
    return false
  } catch (error) {
    return error instanceof AppError && error.code === 'AZURE_BLOCKED'
  }
}

function calledUrls(mock: { mock: { calls: unknown[][] } }): URL[] {
  return mock.mock.calls.map((call) => new URL(String(call[0])))
}

describe('RN-SEC-18: fronteira de rede do main', () => {
  it('aceita a organização em dev.azure.com e vssps.dev.azure.com', () => {
    expect(rejects('https://dev.azure.com/contoso/_apis/projects')).toBe(false)
    expect(rejects('https://dev.azure.com/Contoso/Loja/_apis/wit/wiql')).toBe(false)
    expect(rejects('https://vssps.dev.azure.com/contoso/_apis/graph/users')).toBe(false)
  })

  it.each([
    ['outro host', 'https://evil.com/contoso/_apis/projects'],
    ['host com o nome dentro', 'https://dev.azure.com.evil.com/contoso/_apis'],
    ['nome do host no caminho', 'https://evil.com/dev.azure.com/contoso/_apis'],
    ['subdomínio parecido', 'https://evildev.azure.com/contoso/_apis'],
    ['outra organização', 'https://dev.azure.com/fabrikam/_apis/projects'],
    ['organização como prefixo', 'https://dev.azure.com/contosox/_apis/projects'],
    ['http sem TLS', 'http://dev.azure.com/contoso/_apis/projects'],
    ['usuário embutido', 'https://contoso@evil.com/contoso/_apis'],
    ['credencial antes do host', 'https://dev.azure.com:x@evil.com/contoso'],
    ['porta fora do padrão', 'https://dev.azure.com:8443/contoso/_apis'],
    ['sem organização', 'https://dev.azure.com/'],
    ['não é URL', 'contoso/_apis/projects']
  ])('recusa %s', (_case, url) => {
    expect(rejects(url)).toBe(true)
  })

  it('nenhum arquivo de src/main fora do client.ts abre conexão de rede', () => {
    const offenders = sourceFiles(join(ROOT, 'src/main'))
      .map((file) => relative(ROOT, file).replace(/\\/g, '/'))
      .filter((file) => file !== CLIENT)
      .filter((file) => NETWORK_CALL.test(readFileSync(join(ROOT, file), 'utf8')))
    expect(offenders).toEqual([])
  })

  it('o client.ts tem um único fetch, logo depois da checagem', () => {
    const source = readFileSync(join(ROOT, CLIENT), 'utf8')
    expect(source.match(/\bfetch\s*\(/g) ?? []).toHaveLength(1)
    expect(source).toMatch(
      /assertReadOnlyRequest\(init\.method, assertAllowedAzureUrl\(url, azureOrganization\(\)\)\)\s*return fetch\(url, init\)/
    )
  })

  it('o detector estático reconhece as formas usuais', () => {
    expect(NETWORK_CALL.test('await fetch(url)')).toBe(true)
    expect(NETWORK_CALL.test("import { app, net } from 'electron'")).toBe(true)
    expect(NETWORK_CALL.test('https.request(options)')).toBe(true)
    expect(NETWORK_CALL.test("import { request } from 'undici'")).toBe(true)
    expect(NETWORK_CALL.test('query.refetch()')).toBe(false)
  })
})

describe('RN-SEC-18: o client.ts aplica a fronteira', () => {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    fixtureResponse('projects')
  )

  beforeEach(async () => {
    fetchMock.mockClear()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
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
    vi.restoreAllMocks()
  })

  it('GET na organização sai e devolve a fixture', async () => {
    const { fetchAzure } = await import('../../src/main/services/azure/client')
    const body = await fetchAzure<{ count: number }>('/_apis/projects?api-version=7.1')
    expect(body.count).toBe(1)
    expect(calledUrls(fetchMock).map(String)).toEqual([
      'https://dev.azure.com/contoso/_apis/projects?api-version=7.1'
    ])
  })

  it('caminho que troca o host ou a organização não sai', async () => {
    const { fetchAzure } = await import('../../src/main/services/azure/client')
    await expect(fetchAzure('.evil.com/_apis/projects')).rejects.toMatchObject({
      code: 'AZURE_BLOCKED'
    })
    await expect(fetchAzure('/../fabrikam/_apis/projects')).rejects.toMatchObject({
      code: 'AZURE_BLOCKED'
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('link de avatar vindo da resposta não leva o PAT para outro host', async () => {
    const { fetchAzureAvatar } = await import('../../src/main/services/azure/client')
    fetchMock.mockImplementation(async () => new Response('', { status: 404 }))
    await fetchAzureAvatar('https://evil.com/contoso/_apis/GraphProfile/MemberAvatars/abc')
    const hosts = calledUrls(fetchMock).map((url) => url.host)
    expect(hosts).toEqual(['vssps.dev.azure.com'])
  })
})

describe('RN-SEC-18: a janela não fala com a rede', () => {
  const DEV = 'http://localhost:5173'

  it('aceita arquivos do pacote, DevTools e URLs locais', () => {
    expect(isAllowedRendererRequest('file:///C:/app/out/renderer/index.html')).toBe(true)
    expect(isAllowedRendererRequest('devtools://devtools/bundled/inspector.html')).toBe(true)
    expect(isAllowedRendererRequest('data:image/png;base64,AAAA')).toBe(true)
  })

  it('em dev, aceita só o servidor do Vite, inclusive o websocket', () => {
    expect(isAllowedRendererRequest('http://localhost:5173/src/main.tsx', DEV)).toBe(true)
    expect(isAllowedRendererRequest('ws://localhost:5173/', DEV)).toBe(true)
    expect(isAllowedRendererRequest('http://localhost:5174/', DEV)).toBe(false)
    expect(isAllowedRendererRequest('http://localhost:5173/src/main.tsx')).toBe(false)
  })

  it('recusa qualquer host externo, inclusive o Azure', () => {
    expect(isAllowedRendererRequest('https://dev.azure.com/contoso/_apis/projects', DEV)).toBe(
      false
    )
    expect(isAllowedRendererRequest('https://evil.com/x.js', DEV)).toBe(false)
  })
})
