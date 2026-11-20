import { INSTALLER_BASENAME, PUBLIC_REPOSITORY } from './app-info'

/**
 * Aviso de versão nova (RN-GLB-18). Lógica pura: comparar versões, montar os
 * endereços da Release e ler a resposta do GitHub (RN-SEC-33).
 */

/** Só `maior.menor.correção`: sem pré-lançamento, sem metadado, sem espaço. */
const VERSION = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/

export type Version = readonly [number, number, number]

export function parseVersion(text: string): Version | null {
  const match = VERSION.exec(text)
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null
}

/** Parte por parte, como número: `1.10.0` é mais nova que `1.9.3`. */
export function isNewerVersion(candidate: string, installed: string): boolean {
  const a = parseVersion(candidate)
  const b = parseVersion(installed)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

export const RELEASE_CHECK_URL = `https://api.github.com/repos/${PUBLIC_REPOSITORY}/releases/latest`

export function installerFileName(version: string): string {
  return `${INSTALLER_BASENAME}-${version}-setup.exe`
}

/** O que a janela pode pedir para abrir. Ela nunca manda a URL (RN-SEC-21). */
export type UpdateLink = 'release' | 'installer'

export function releaseLinkUrl(link: UpdateLink, version: string): string {
  const base = `https://github.com/${PUBLIC_REPOSITORY}/releases`
  return link === 'installer'
    ? `${base}/download/v${version}/${installerFileName(version)}`
    : `${base}/tag/v${version}`
}

export type UpdateCheck =
  /** Há versão mais nova publicada. `hasInstaller`: o `.exe` dela está anexado. */
  | { status: 'available'; installed: string; latest: string; hasInstaller: boolean }
  | { status: 'up-to-date'; installed: string }
  /** Não consultou ou não deu para saber: sem rede, demonstração, resposta estranha. */
  | { status: 'unknown'; installed: string }

/**
 * Lê a resposta de `releases/latest`. Só o número da versão e a lista de nomes
 * de arquivo importam; link nenhum da resposta é usado. Fora do formato, `null`.
 */
export function readLatestRelease(
  body: unknown
): { version: string; hasInstaller: boolean } | null {
  if (typeof body !== 'object' || body === null) return null
  const { tag_name: tag, assets, draft, prerelease } = body as Record<string, unknown>
  if (draft === true || prerelease === true) return null
  if (typeof tag !== 'string' || !tag.startsWith('v')) return null
  const version = tag.slice(1)
  if (!parseVersion(version)) return null
  const names = Array.isArray(assets)
    ? assets.map((asset) => (asset as { name?: unknown } | null)?.name)
    : []
  return { version, hasInstaller: names.includes(installerFileName(version)) }
}

export function toUpdateCheck(
  installed: string,
  latest: { version: string; hasInstaller: boolean } | null
): UpdateCheck {
  if (!latest) return { status: 'unknown', installed }
  if (!isNewerVersion(latest.version, installed)) return { status: 'up-to-date', installed }
  return {
    status: 'available',
    installed,
    latest: latest.version,
    hasInstaller: latest.hasInstaller
  }
}
