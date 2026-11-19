import { app } from 'electron'
import {
  readLatestRelease,
  RELEASE_CHECK_URL,
  releaseLinkUrl,
  toUpdateCheck,
  type UpdateCheck,
  type UpdateLink
} from '@shared/update'
import { AppError } from '@shared/errors'
import { getActiveProfile } from '../../profile/profile-store'
import { assertAllowedReleaseCheck, openReleaseLinkIfAllowed } from '../../security/network-guard'

/**
 * Consulta de versão nova (RN-SEC-33, RN-GLB-18). Este arquivo não importa o
 * guardião do PAT nem o cliente do Azure, de propósito: o teste de segurança
 * confere, para a consulta nunca ter como levar o token.
 */

const TIMEOUT_MS = 10_000

/**
 * O único `fetch` deste arquivo, logo depois da checagem do endereço (RN-SEC-33).
 * `redirect: 'error'`: um redirecionamento levaria a consulta a outro host.
 */
async function guardedReleaseFetch(): Promise<Response> {
  const init: RequestInit = {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'plataforma-po-desktop' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  }
  assertAllowedReleaseCheck(RELEASE_CHECK_URL, init.method)
  return fetch(RELEASE_CHECK_URL, init)
}

async function fetchLatestRelease(): Promise<ReturnType<typeof readLatestRelease>> {
  try {
    const response = await guardedReleaseFetch()
    if (!response.ok) {
      console.warn(`[versão] GitHub respondeu ${response.status} ${response.statusText}`)
      return null
    }
    return readLatestRelease(await response.json())
  } catch (error) {
    // Sem rede ou fora do ar: sem aviso, e o app segue (RN-GLB-18).
    console.warn('[versão] consulta falhou:', error instanceof Error ? error.message : error)
    return null
  }
}

/** Uma consulta por abertura do app: o resultado vale enquanto ele estiver aberto. */
let cached: Promise<UpdateCheck> | null = null

export function checkForUpdate(): Promise<UpdateCheck> {
  const installed = app.getVersion()
  // Na demonstração, nada sai para a rede (RN-SEC-27). Não guarda: ao sair dela,
  // a consulta pode rodar.
  if (getActiveProfile()?.kind === 'demo') return Promise.resolve({ status: 'unknown', installed })
  cached ??= fetchLatestRelease().then((latest) => toUpdateCheck(installed, latest))
  return cached
}

/** Só para teste: esquece a consulta guardada. */
export function forgetUpdateCheck(): void {
  cached = null
}

/**
 * Abre no navegador a página ou o instalador da versão nova (RN-SEC-21). A janela
 * escolhe só qual dos dois; o endereço sai da versão que a consulta validou.
 */
export async function openUpdateLink(
  link: UpdateLink,
  open: (url: string) => unknown
): Promise<void> {
  if (link !== 'release' && link !== 'installer') {
    throw new AppError('UPDATE_BLOCKED', 'Link de versão desconhecido.')
  }
  // A demonstração não abre link externo nenhum (RN-SEC-27), nem este.
  const check = cached && getActiveProfile()?.kind !== 'demo' ? await cached : null
  if (check?.status !== 'available' || (link === 'installer' && !check.hasInstaller)) {
    throw new AppError('UPDATE_UNAVAILABLE', 'Não há versão nova conhecida para abrir.')
  }
  if (!openReleaseLinkIfAllowed(releaseLinkUrl(link, check.latest), open)) {
    throw new AppError('UPDATE_BLOCKED', 'O link da versão nova foi bloqueado.')
  }
}
