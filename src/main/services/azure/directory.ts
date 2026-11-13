import type { AzureUserProfile } from '@shared/azure'
import { fetchAvatarByDescriptor, fetchAzure, fetchGraph } from './client'

/**
 * Quem é, no Azure DevOps, o dono do PAT (`RN-SEC-16`).
 *
 * Não há login no app: a única identidade que existe é a do token. O próprio
 * Azure diz a quem ele pertence, em `connectionData` — sem email, sem varrer o
 * diretório.
 */

/** Recorte de `ConnectionData.authenticatedUser` que interessa aqui. */
interface ConnectionData {
  authenticatedUser?: {
    id?: string
    providerDisplayName?: string
    customDisplayName?: string
    /** Descriptor da Graph API (`aad.…`, `msa.…`). Nem toda resposta traz. */
    subjectDescriptor?: string
  }
}

/**
 * Perfil já resolvido, inclusive o `null`. `undefined` quer dizer "ainda não
 * buscado". Ver `clearUserProfileCache`.
 */
let cachedProfile: AzureUserProfile | null | undefined

/**
 * Esvazia o cache do perfil. Obrigatório ao trocar o PAT: o token novo pode ser
 * de outra pessoa, e um `null` gravado por falha do token antigo impediria que o
 * perfil voltasse a ser buscado.
 */
export function clearUserProfileCache(): void {
  cachedProfile = undefined
}

/**
 * O avatar é servido pela Graph API, que pede o *subject descriptor*. Quando
 * `connectionData` não o traz, ele é obtido a partir do id (storage key).
 */
async function subjectDescriptorFor(
  user: NonNullable<ConnectionData['authenticatedUser']>
): Promise<string | null> {
  if (user.subjectDescriptor) return user.subjectDescriptor
  if (!user.id) return null

  try {
    const { body } = await fetchGraph<{ value?: string }>(
      `/_apis/graph/descriptors/${encodeURIComponent(user.id)}?api-version=7.1-preview.1`
    )
    return body.value ?? null
  } catch (error) {
    console.error('[directory] descriptor não resolvido', error)
    return null
  }
}

export async function getCurrentUser(): Promise<AzureUserProfile | null> {
  if (cachedProfile !== undefined) return cachedProfile

  const { authenticatedUser: user } = await fetchAzure<ConnectionData>('/_apis/connectionData')

  if (!user?.id) {
    console.warn('[directory] connectionData sem identidade autenticada')
    cachedProfile = null
    return null
  }

  const descriptor = await subjectDescriptorFor(user)

  const profile: AzureUserProfile = {
    displayName: user.customDisplayName || user.providerDisplayName || null,
    // A foto pode faltar sem que o perfil falhe — quem não subiu imagem no Azure
    // continua tendo nome.
    avatar: descriptor ? await fetchAvatarByDescriptor(descriptor) : null
  }

  cachedProfile = profile
  return profile
}
