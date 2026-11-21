import { Alert, Button, Card, Flex, Typography } from 'antd'
import { removedFromDiff } from '@shared/config/import'
import type { ProposalState } from '@shared/ipc'
import { ConfigDiff } from '../../components/ConfigDiff'
import { useApplyProposal, useDiscardProposal } from '../../ipc/useProfile'
import { formatDateTime, formatList, t, tPlural } from '../../i18n'
import { IssueList } from '../onboarding/IssueList'

const { Paragraph, Text } = Typography

/**
 * A proposta da IA do PO, para revisar (RN-CFG-12). É a mesma diferença do
 * Importar (RN-CFG-09); aplicar grava pelo mesmo caminho, e descartar só apaga a
 * proposta.
 */
export function ProposalCard({
  proposal,
  onApplied
}: {
  proposal: ProposalState
  onApplied: () => void
}): React.JSX.Element {
  const apply = useApplyProposal()
  const discard = useDiscardProposal()
  const busy = apply.isPending || discard.isPending

  const removed = proposal.ok ? removedFromDiff(proposal.diff) : null
  const removedNames = removed ? [...removed.products, ...removed.groups, ...removed.squads] : []
  const refused = apply.data && !apply.data.saved ? apply.data.issues : null
  const failure = apply.error ?? discard.error

  return (
    <Card title={t('proposal.title')}>
      <Flex vertical gap={14}>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t('proposal.intro', { when: formatDateTime(proposal.updatedAt) })}
        </Paragraph>

        {proposal.ok ? (
          <>
            {proposal.kind === 'template' && (
              <Alert type="info" showIcon title={t('settings.import.templateNote')} />
            )}
            <Text strong>{t('settings.import.changes')}</Text>
            <ConfigDiff diff={proposal.diff} />
            {removedNames.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title={tPlural('settings.import.orphans', removedNames.length, {
                  ids: formatList(removedNames)
                })}
              />
            )}
          </>
        ) : (
          <Alert
            type="error"
            showIcon
            title={t('proposal.invalid')}
            description={<IssueList issues={proposal.issues} />}
          />
        )}

        {refused && (
          <Alert
            type="error"
            showIcon
            title={t('proposal.invalid')}
            description={<IssueList issues={refused} />}
          />
        )}
        {failure && <Alert type="error" showIcon title={failure.message} />}

        <Flex gap={8} justify="flex-end">
          <Button disabled={busy} loading={discard.isPending} onClick={() => discard.mutate()}>
            {t('proposal.discard')}
          </Button>
          <Button
            type="primary"
            danger={removedNames.length > 0}
            disabled={!proposal.ok || busy}
            loading={apply.isPending}
            onClick={() =>
              apply.mutate(undefined, {
                onSuccess: (result) => {
                  if (result.saved) onApplied()
                }
              })
            }
          >
            {t('settings.import.apply')}
          </Button>
        </Flex>
      </Flex>
    </Card>
  )
}
