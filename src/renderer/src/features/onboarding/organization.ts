import { ORGANIZATION_PATTERN } from '@shared/config/schema'

export type OrganizationInput =
  { ok: true; organization: string; fromUrl: boolean } | { ok: false; message: string }

/** `<org>.visualstudio.com` é o endereço antigo da mesma nuvem. */
const LEGACY_HOST = /^([A-Za-z0-9][A-Za-z0-9-]*)\.visualstudio\.com$/i

function parseUrl(text: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`
  try {
    return new URL(withScheme)
  } catch {
    return null
  }
}

/**
 * Lê o que o PO digitou no campo da organização.
 *
 * RN-CFG-04: a Configuração guarda só o nome. Quem cola a URL do navegador não
 * errou de propósito — o app extrai o nome e diz por quê, em vez de recusar.
 * Endereço de outro servidor é recusado: o PAT só vai para `dev.azure.com`.
 */
export function parseOrganizationInput(raw: string): OrganizationInput {
  const text = raw.trim()
  if (!text) return { ok: false, message: 'Informe a organização.' }
  if (ORGANIZATION_PATTERN.test(text)) return { ok: true, organization: text, fromUrl: false }

  const looksLikeAddress = /[./:@]/.test(text)
  const url = looksLikeAddress ? parseUrl(text) : null
  if (url) {
    const host = url.hostname.toLowerCase()
    let candidate: string | undefined
    if (host === 'dev.azure.com') {
      candidate = url.pathname.split('/').filter(Boolean)[0] ?? ''
    } else {
      candidate = LEGACY_HOST.exec(host)?.[1]
    }
    if (candidate === undefined) {
      return {
        ok: false,
        message:
          'O app só fala com o Azure DevOps na nuvem (dev.azure.com). Informe o nome da organização, não o endereço de outro servidor.'
      }
    }
    if (ORGANIZATION_PATTERN.test(candidate)) {
      return { ok: true, organization: candidate, fromUrl: true }
    }
  }

  return {
    ok: false,
    message:
      'Use só o nome da organização (o que vem depois de "dev.azure.com/"): letras, números e hífen.'
  }
}
