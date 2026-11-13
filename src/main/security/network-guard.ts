import { AppError } from '@shared/errors'

/**
 * Fronteira de rede do processo principal (RN-SEC-18, 20 e 21).
 *
 * O PAT viaja no cabeçalho de toda requisição do `client.ts`. Se uma URL vinda de
 * resposta do Azure, de configuração ou de bug apontasse para outro host, o token
 * iria junto — por isso a checagem é por URL já montada, não por caminho.
 */

/**
 * Hosts que recebem o PAT. `vssps` é onde vive a Graph API (diretório e fotos).
 * A foto que o work item traz aponta para `dev.azure.com` (ver `client.ts`), então
 * nenhum outro host da Microsoft é necessário.
 */
const AZURE_API_HOSTS = new Set(['dev.azure.com', 'vssps.dev.azure.com'])

/** Único POST que o app faz: consulta WIQL, que só lê. */
const WIQL_PATH = /\/_apis\/wit\/wiql\/?$/i

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/**
 * `https:`, host exato da lista, sem usuário, senha ou porta, e a organização como
 * primeiro segmento. Host exato porque `dev.azure.com.evil.com` e
 * `evil.com/dev.azure.com` contêm o texto e não são o Azure.
 */
function isOrganizationUrl(url: URL, hosts: Set<string>, organization: string): boolean {
  if (url.protocol !== 'https:') return false
  if (!hosts.has(url.hostname.toLowerCase())) return false
  if (url.username || url.password || url.port) return false
  const firstSegment = decodeURIComponent(url.pathname.split('/')[1] ?? '')
  return firstSegment !== '' && firstSegment.toLowerCase() === organization.toLowerCase()
}

/** RN-SEC-18: recusa qualquer URL que não seja da organização no Azure DevOps. */
export function assertAllowedAzureUrl(raw: string, organization: string): URL {
  const url = parseUrl(raw)
  if (!url || !isOrganizationUrl(url, AZURE_API_HOSTS, organization)) {
    throw new AppError(
      'AZURE_BLOCKED',
      'Requisição bloqueada: o app só fala com a organização configurada no Azure DevOps.'
    )
  }
  return url
}

/** RN-SEC-20: somente leitura. GET em tudo; POST só na consulta WIQL. */
export function assertReadOnlyRequest(method: string | undefined, url: URL): void {
  const verb = (method ?? 'GET').toUpperCase()
  if (verb === 'GET') return
  if (verb === 'POST' && WIQL_PATH.test(url.pathname)) return
  throw new AppError(
    'AZURE_BLOCKED',
    `Requisição bloqueada: o app só lê do Azure DevOps (${verb} não é permitido aqui).`
  )
}

/** RN-SEC-21: links externos só para páginas da organização em `dev.azure.com`. */
export function isAllowedExternalUrl(raw: string, organization: string): boolean {
  const url = parseUrl(raw)
  return url !== null && isOrganizationUrl(url, new Set(['dev.azure.com']), organization)
}

/**
 * Abre no navegador se a URL passar pela RN-SEC-21; senão só registra. Devolve se
 * abriu. Recebe `open` para ser testável sem o `shell` do Electron.
 */
export function openExternalIfAllowed(
  raw: string,
  /** `null` nega tudo: é o Perfil de demonstração, sem organização de verdade (RN-SEC-27). */
  organization: string | null,
  open: (url: string) => unknown
): boolean {
  if (organization === null || !isAllowedExternalUrl(raw, organization)) {
    console.warn(`[segurança] link externo negado (RN-SEC-21): ${raw}`)
    return false
  }
  void open(raw)
  return true
}

/**
 * Defesa em profundidade atrás da CSP: o que a janela pode carregar. Arquivos do
 * pacote, DevTools e URLs locais (`data:`/`blob:`); em dev, também o servidor do
 * Vite, inclusive o websocket do HMR.
 */
export function isAllowedRendererRequest(raw: string, devServerUrl?: string): boolean {
  const url = parseUrl(raw)
  if (!url) return false
  if (['file:', 'devtools:', 'data:', 'blob:'].includes(url.protocol)) return true
  if (!devServerUrl) return false
  const dev = parseUrl(devServerUrl)
  if (!dev) return false
  const sameHostPort = url.hostname === dev.hostname && url.port === dev.port
  return sameHostPort && ['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)
}
