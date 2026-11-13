import { workItemUrl } from '@shared/azure'
import { useConfiguration } from '../ipc/useAzure'
import { useIsDemo } from '../ipc/useProfile'

/**
 * Link do work item no Azure DevOps, ou `undefined` no Perfil de demonstração:
 * a organização é fictícia, e o link abriria a de outra pessoa (RN-SEC-27). Sem
 * `href`, o ID aparece como texto.
 */
export function useWorkItemHref(): (id: number) => string | undefined {
  const { organization } = useConfiguration()
  const isDemo = useIsDemo()
  return (id) => (isDemo ? undefined : workItemUrl(organization, id))
}

/** A organização para o resumo do Planning; `null` na demonstração, que sai sem link. */
export function useLinkOrganization(): string | null {
  const { organization } = useConfiguration()
  return useIsDemo() ? null : organization
}
