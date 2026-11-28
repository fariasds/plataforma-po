import { useCallback, useEffect } from 'react'
import { Button, Flex, Tooltip, Typography } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useIsFetching, useQueryClient, type Query } from '@tanstack/react-query'
import { t } from '../i18n'
import { MONO_FONT } from '../theme'

const { Text } = Typography

/**
 * As consultas que leem o Azure. Dados de trabalho, Perfil e Configuração ficam
 * de fora: são locais e já estão em dia (RN-GLB-19).
 */
const AZURE_QUERY_ROOTS = new Set([
  'sprints',
  'planning',
  'planning-item',
  'daily',
  'sprint-delivery',
  'bug-analysis',
  'team-performance',
  // O retrato do fluxo do PO: atualizar é ler o Azure de novo (RN-FLX-02).
  'flow-snapshot'
])

function isAzureQuery(query: Query): boolean {
  return AZURE_QUERY_ROOTS.has(String(query.queryKey[0]))
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Busca de novo, no Azure, o que a tela aberta mostra (RN-GLB-19). Fica no
 * cabeçalho das telas que leem o Azure; F5 faz o mesmo.
 */
export function RefreshButton(): React.JSX.Element {
  const queryClient = useQueryClient()
  // Re-renderiza quando uma busca começa ou termina, e é aí que a hora muda.
  const fetching = useIsFetching({ predicate: isAzureQuery }) > 0

  const updatedAt = queryClient
    .getQueryCache()
    .findAll({ predicate: isAzureQuery, type: 'active' })
    .reduce((latest, query) => Math.max(latest, query.state.dataUpdatedAt), 0)

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ predicate: isAzureQuery })
  }, [queryClient])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'F5' || event.ctrlKey || event.altKey || event.metaKey) return
      event.preventDefault()
      refresh()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [refresh])

  return (
    <Flex align="center" gap={12}>
      <Text type="secondary" style={{ fontSize: 12.5 }} aria-live="polite">
        {fetching ? (
          t('refresh.fetching')
        ) : updatedAt > 0 ? (
          <>
            {t('refresh.updatedAt')}{' '}
            <span style={{ fontFamily: MONO_FONT }}>{formatTime(updatedAt)}</span>
          </>
        ) : null}
      </Text>
      <Tooltip title={t('refresh.hint')}>
        <Button icon={<ReloadOutlined spin={fetching} />} onClick={refresh} disabled={fetching}>
          {fetching ? t('refresh.buttonBusy') : t('refresh.button')}
        </Button>
      </Tooltip>
    </Flex>
  )
}
