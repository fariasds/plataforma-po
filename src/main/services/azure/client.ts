import { AsyncLocalStorage } from 'async_hooks'
import { AppError } from '@shared/errors'
import { ORGANIZATION_PATTERN } from '@shared/config/schema'
import { demoAzure } from '../../demo/demo-profile'
import type { FakeAzure } from '../../demo/fake-azure'
import { getActiveConfig } from '../../profile/config-loader'
import { getActiveProfile } from '../../profile/profile-store'
import { requirePat } from '../../security/pat-store'
import { assertAllowedAzureUrl, assertReadOnlyRequest } from '../../security/network-guard'
import { rememberSecret } from '../../security/redact'

/**
 * Organização de uma checagem de PAT em andamento. Ao criar um Perfil, o token é
 * testado contra a organização digitada, que ainda não está em Configuração
 * nenhuma. Fica presa à chamada assíncrona: uma requisição de dashboard que corra
 * em paralelo continua indo para a organização em uso.
 */
const pendingOrganization = new AsyncLocalStorage<string>()

/**
 * Único ponto que decide a organização: URLs montadas aqui, a fronteira de rede
 * (RN-SEC-18) e os links externos (RN-SEC-21) leem daqui. Vem da Configuração em
 * uso; sem ela, nada sai.
 */
export function azureOrganization(): string {
  const pending = pendingOrganization.getStore()
  if (pending) return pending
  const organization = getActiveConfig()?.organization
  if (!organization) {
    throw new AppError(
      'PROFILE_MISSING',
      'Não há Configuração em uso, então não sei com qual organização do Azure falar.'
    )
  }
  return organization
}

/**
 * RN-SEC-27: o único ponto que desvia um pedido para o Azure fictício. Quem
 * decide é o **tipo** do Perfil ativo, lido do disco a cada pedido; nem a
 * organização nem nada que venha da janela entra na conta. Fora da
 * demonstração, devolve `null` e o pedido segue para o `guardedFetch`.
 */
function demoFor(): FakeAzure | null {
  const profile = getActiveProfile()
  return profile?.kind === 'demo' && profile.scenario ? demoAzure(profile.scenario) : null
}

/**
 * Organização para os links externos (RN-SEC-21). Na demonstração é `null`: a
 * organização é fictícia, e um link para ela abriria a de outra pessoa.
 */
export function externalLinkOrganization(): string | null {
  return getActiveProfile()?.kind === 'demo' ? null : azureOrganization()
}

function authHeaderFor(pat: string): string {
  // Todo PAT que monta um cabeçalho passa a ser apagado de log e erro (RN-SEC-19).
  rememberSecret(pat)
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
}

/**
 * O único `fetch` do processo principal (RN-SEC-18): nada sai sem passar pela
 * checagem de host, organização e método. O teste de segurança conta as chamadas.
 */
async function guardedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  assertReadOnlyRequest(init.method, assertAllowedAzureUrl(url, azureOrganization()))
  return fetch(url, init)
}

/**
 * Azure DevOps answers an invalid PAT with 401/403 — but also with 203 plus a
 * sign-in page, which is not an error status and would otherwise slip through.
 */
function isUnauthorized(status: number): boolean {
  return status === 401 || status === 403 || status === 203
}

async function request(path: string, pat: string, init?: RequestInit): Promise<Response> {
  const url = `https://dev.azure.com/${azureOrganization()}${path}`

  let response: Response
  try {
    response = await guardedFetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: authHeaderFor(pat),
        'Content-Type': 'application/json'
      }
    })
  } catch (cause) {
    if (cause instanceof AppError) throw cause
    throw new AppError(
      'AZURE_UNREACHABLE',
      'Não consegui falar com o Azure DevOps. Verifique sua conexão e tente de novo.',
      { cause }
    )
  }

  if (isUnauthorized(response.status)) {
    throw new AppError(
      'AZURE_UNAUTHORIZED',
      'O Azure DevOps recusou o token. Confira se ele é válido, não expirou e tem escopo de leitura.'
    )
  }

  if (!response.ok) {
    throw new AppError(
      'AZURE_REQUEST_FAILED',
      `Azure DevOps respondeu ${response.status} ${response.statusText} em ${path}.`
    )
  }

  return response
}

/** GET on the Azure DevOps API using the stored PAT. */
export async function fetchAzure<T>(path: string): Promise<T> {
  const demo = demoFor()
  if (demo) return demo.fetchAzure<T>(path)
  const response = await request(path, requirePat())
  return response.json() as Promise<T>
}

/** POST on the Azure DevOps API using the stored PAT. */
export async function postAzure<T>(path: string, body: unknown): Promise<T> {
  const demo = demoFor()
  if (demo) return demo.postAzure<T>(path, body)
  const response = await request(path, requirePat(), {
    method: 'POST',
    body: JSON.stringify(body)
  })
  return response.json() as Promise<T>
}

/**
 * Avatares já buscados, por URL. O time é pequeno e as imagens são minúsculas —
 * sem o cache, cada carregamento de tela refaria as mesmas requisições.
 */
const avatarCache = new Map<string, string | null>()

/**
 * Esvazia o cache de fotos.
 *
 * Obrigatório ao trocar o PAT: o cache guarda também as **falhas**, e um token
 * novo com mais escopo continuaria recebendo o `null` do token antigo — a foto
 * nunca voltaria a ser tentada.
 */
export function clearAvatarCache(): void {
  avatarCache.clear()
}

/**
 * Busca a foto de uma pessoa e devolve como data URI.
 *
 * O endpoint de avatar do Azure exige autenticação, então a imagem não pode ser
 * carregada direto por uma tag `<img>` no renderer — ela é buscada aqui, com o
 * PAT, e atravessa o IPC já embutida.
 *
 * Devolve `null` em qualquer falha: se o PAT não tiver escopo para ler perfis, a
 * tela cai para as iniciais em vez de quebrar.
 */
/**
 * Endpoint **documentado** da Graph API, no host `vssps`. É o que o escopo
 * "Graph (Read)" do PAT concede — a URL que vem no work item aponta para outra
 * rota, em `dev.azure.com`, que recusa autenticação por PAT.
 *
 * Devolve a imagem em JSON, com o conteúdo em base64.
 */
async function fetchAvatarFromGraph(descriptor: string): Promise<string | null> {
  const url =
    `https://vssps.dev.azure.com/${azureOrganization()}/_apis/graph/subjects/` +
    `${encodeURIComponent(descriptor)}/avatars?size=medium&api-version=7.1-preview.1`

  try {
    const response = await guardedFetch(url, {
      headers: { Authorization: authHeaderFor(requirePat()), Accept: 'application/json' }
    })
    if (!response.ok) {
      console.error(`[avatar] graph ${response.status} ${response.statusText} — ${descriptor}`)
      return null
    }
    const body = (await response.json()) as { value?: string }
    return body.value ? `data:image/png;base64,${body.value}` : null
  } catch (error) {
    console.error(`[avatar] graph falhou — ${descriptor}`, error)
    return null
  }
}

async function fetchViaGraphApi(linkUrl: string): Promise<string | null> {
  const descriptor = linkUrl.split('/').pop()
  if (!descriptor) return null
  return fetchAvatarFromGraph(descriptor)
}

/**
 * Foto quando o *descriptor* já é conhecido, em vez da URL que o work item traz.
 *
 * É o caso do diretório: lá a pessoa é encontrada por email, e o link de avatar
 * do registro termina em `/avatars` — o descriptor está no meio da URL, não no
 * fim, então a extração usada para o work item não serviria.
 *
 * Divide o mesmo cache: descriptor e URL nunca colidem como chave.
 */
export async function fetchAvatarByDescriptor(descriptor: string): Promise<string | null> {
  // Na demonstração, sem foto: a tela cai para as iniciais (RN-SEC-27).
  if (demoFor()) return null
  const cached = avatarCache.get(descriptor)
  if (cached !== undefined) return cached

  const result = await fetchAvatarFromGraph(descriptor)
  avatarCache.set(descriptor, result)
  return result
}

/**
 * GET no host `vssps`, onde vive a Graph API — fora da base da organização usada
 * por `fetchAzure`. Devolve o token de continuação junto, porque as listagens do
 * diretório vêm paginadas por cabeçalho.
 */
export async function fetchGraph<T>(
  path: string
): Promise<{ body: T; continuation: string | null }> {
  const demo = demoFor()
  if (demo) return demo.fetchGraph<T>(path)
  const url = `https://vssps.dev.azure.com/${azureOrganization()}${path}`

  let response: Response
  try {
    response = await guardedFetch(url, {
      headers: { Authorization: authHeaderFor(requirePat()), Accept: 'application/json' }
    })
  } catch (cause) {
    if (cause instanceof AppError) throw cause
    throw new AppError(
      'AZURE_UNREACHABLE',
      'Não consegui falar com o Azure DevOps. Verifique sua conexão e tente de novo.',
      { cause }
    )
  }

  if (isUnauthorized(response.status)) {
    throw new AppError(
      'AZURE_UNAUTHORIZED',
      'O Azure DevOps recusou o token para ler o diretório. O escopo Graph (Read) é necessário.'
    )
  }

  if (!response.ok) {
    throw new AppError(
      'AZURE_REQUEST_FAILED',
      `Azure DevOps respondeu ${response.status} ${response.statusText} em ${path}.`
    )
  }

  return {
    body: (await response.json()) as T,
    continuation: response.headers.get('x-ms-continuationtoken')
  }
}

/**
 * Última tentativa: a URL que o próprio work item trouxe. Ela vem de resposta do
 * Azure, então passa pela mesma fronteira — um link forjado não leva o PAT junto.
 */
async function fetchViaLinkUrl(url: string): Promise<string | null> {
  try {
    const response = await guardedFetch(url, {
      headers: { Authorization: authHeaderFor(requirePat()) }
    })
    if (!response.ok) {
      console.error(`[avatar] link ${response.status} ${response.statusText} — ${url}`)
      return null
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const mime = response.headers.get('content-type') ?? 'image/png'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (error) {
    console.error(`[avatar] link falhou — ${url}`, error)
    return null
  }
}

export async function fetchAzureAvatar(url: string): Promise<string | null> {
  if (demoFor()) return null
  const cached = avatarCache.get(url)
  if (cached !== undefined) return cached

  const result = (await fetchViaGraphApi(url)) ?? (await fetchViaLinkUrl(url))

  avatarCache.set(url, result)
  return result
}

/**
 * Roda `task` falando com `organization` em vez da organização da Configuração
 * em uso. Serve a quem precisa do Azure antes de haver Configuração válida: a
 * checagem do PAT de um Perfil que ainda vai nascer e a descoberta da T-15.
 */
export async function withOrganization<T>(
  organization: string,
  task: () => Promise<T>
): Promise<T> {
  // Mesma regra da Configuração (RN-CFG-04): nome, nunca URL.
  if (typeof organization !== 'string' || !ORGANIZATION_PATTERN.test(organization.trim())) {
    throw new AppError(
      'PROFILE_INVALID',
      'Informe só o nome da organização (o que vem depois de "dev.azure.com/").'
    )
  }
  return pendingOrganization.run(organization.trim(), task)
}

/**
 * Cheapest authenticated call there is — used to check a PAT before storing it.
 * Takes the token as an argument because at this point nothing is stored yet.
 * `organization` serve ao Perfil que ainda vai nascer; sem ela, vale a em uso.
 */
export async function checkCredentials(pat: string, organization?: string): Promise<void> {
  const check = async (): Promise<void> => {
    await request('/_apis/projects?$top=1&api-version=7.1', pat)
  }
  if (organization === undefined) return check()
  return withOrganization(organization, check)
}
