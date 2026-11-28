import { Alert, App, Button, Drawer, Flex, Tag, Typography } from 'antd'
import { CheckCircleFilled, MinusCircleOutlined } from '@ant-design/icons'
import type { BoardFeature } from '@shared/flow-board'
import type { Candidate, MatchKind } from '@shared/flow-reconcile'
import { HelpTip } from '../../components/HelpTip'
import { StateTag } from '../../components/StateTag'
import { useWorkItemHref } from '../../components/useWorkItemHref'
import { t } from '../../i18n'
import { MONO_FONT, NEUTRA, STATUS } from '../../theme'
import { pendenciesByStage } from './board-view'
import { useLinkDraftFeature, useLinkPlannedPbi } from './useFlow'

const { Text, Title } = Typography

function Section({
  title,
  extra,
  children
}: {
  title: string
  extra?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Flex vertical gap={8}>
      <Flex align="center" justify="space-between" gap={8}>
        <Text strong style={{ fontSize: 13 }}>
          {title}
        </Text>
        {extra}
      </Flex>
      {children}
    </Flex>
  )
}

function WorkItemId({ id }: { id: number }): React.JSX.Element {
  const href = useWorkItemHref()(id)
  const label = <span style={{ fontFamily: MONO_FONT }}>#{id}</span>
  return href ? (
    <a href={href} target="_blank" rel="noreferrer">
      {label}
    </a>
  ) : (
    label
  )
}

const MATCH_LABEL: Record<Exclude<MatchKind, 'none'>, 'exact' | 'similar' | 'ambiguous'> = {
  exact: 'exact',
  similar: 'similar',
  ambiguous: 'ambiguous'
}

/** Um item a confirmar: o que o plano diz e o que o app achou no Azure. */
function ReconcileRow({
  label,
  title,
  match,
  candidates,
  pending,
  onConfirm
}: {
  label: string
  title: string
  match: MatchKind
  candidates: Candidate[]
  pending: boolean
  onConfirm: (id: number) => void
}): React.JSX.Element {
  return (
    <Flex
      vertical
      gap={6}
      style={{ padding: '10px 12px', border: `1px solid ${NEUTRA[200]}`, borderRadius: 10 }}
    >
      <Text style={{ fontSize: 13 }}>
        <Text strong style={{ fontFamily: MONO_FONT }}>
          {label}
        </Text>{' '}
        {title}
      </Text>
      {match === 'none' ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('flow.detail.none')}
        </Text>
      ) : (
        <>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t(`flow.detail.${MATCH_LABEL[match]}`)}
          </Text>
          {candidates.map((candidate) => (
            <Flex key={candidate.id} align="center" justify="space-between" gap={8}>
              <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                <WorkItemId id={candidate.id} />
                <Text style={{ fontSize: 13 }} ellipsis={{ tooltip: candidate.title }}>
                  {candidate.title}
                </Text>
                <StateTag state={candidate.state} />
              </Flex>
              <Button
                size="small"
                type="primary"
                loading={pending}
                onClick={() => onConfirm(candidate.id)}
                style={{ flex: 'none' }}
              >
                {t('flow.detail.confirm')}
              </Button>
            </Flex>
          ))}
        </>
      )}
    </Flex>
  )
}

export function FeatureDrawer({
  feature,
  productId,
  onClose
}: {
  feature: BoardFeature | null
  productId: string
  onClose: () => void
}): React.JSX.Element {
  const { message } = App.useApp()
  const linkPbi = useLinkPlannedPbi()
  const linkFeature = useLinkDraftFeature()
  const onLinked = { onSuccess: () => void message.success(t('flow.linked')) }
  const onError = (error: Error): void => void message.error(error.message)

  return (
    <Drawer open={feature !== null} onClose={onClose} size={560} destroyOnHidden title={null}>
      {feature && (
        <Flex vertical gap={20}>
          <Flex vertical gap={6}>
            <Flex align="center" gap={8} wrap>
              {feature.featureId !== null ? (
                <WorkItemId id={feature.featureId} />
              ) : (
                <Tag style={{ marginInlineEnd: 0 }}>{t('flow.card.draft')}</Tag>
              )}
              <Tag style={{ marginInlineEnd: 0 }}>{t(`flow.phases.${feature.phase}`)}</Tag>
              {feature.azureState && <StateTag state={feature.azureState} />}
              <HelpTip rule="RN-FLX-05" />
            </Flex>
            <Title level={4} style={{ margin: 0 }}>
              {feature.title}
            </Title>
            {feature.slug && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('flow.detail.folder')}{' '}
                <span style={{ fontFamily: MONO_FONT }}>
                  {t('flow.detail.folderPath', { slug: feature.slug })}
                </span>
                {feature.staleDays !== null &&
                  ` · ${
                    feature.staleDays === 0
                      ? t('flow.detail.updatedToday')
                      : t('flow.detail.updated', { days: feature.staleDays })
                  }`}
              </Text>
            )}
            {feature.readmePhase && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('flow.detail.readmePhase', {
                  readme: feature.readmePhase,
                  phase: t(`flow.phases.${feature.phase}`)
                })}
              </Text>
            )}
          </Flex>

          {feature.divergences.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={t('flow.detail.divergences')}
              description={feature.divergences.join(' ')}
            />
          )}

          {(feature.reconciliation.pbis.length > 0 || feature.reconciliation.feature) && (
            <Section title={t('flow.detail.reconcile')}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('flow.detail.reconcileHint')}
              </Text>
              {feature.reconciliation.feature && feature.slug && (
                <ReconcileRow
                  label={t('flow.detail.draftFeature')}
                  title={feature.title}
                  match={feature.reconciliation.feature.match}
                  candidates={feature.reconciliation.feature.candidates}
                  pending={linkFeature.isPending}
                  onConfirm={(id) =>
                    linkFeature.mutate(
                      { productId, slug: feature.slug!, id },
                      { ...onLinked, onError }
                    )
                  }
                />
              )}
              {feature.reconciliation.pbis.map((r) => (
                <ReconcileRow
                  key={r.pbi}
                  label={r.pbi}
                  title={r.title}
                  match={r.match}
                  candidates={r.candidates}
                  pending={linkPbi.isPending}
                  onConfirm={(id) =>
                    linkPbi.mutate(
                      { productId, slug: feature.slug!, pbi: r.pbi, id },
                      { ...onLinked, onError }
                    )
                  }
                />
              ))}
            </Section>
          )}

          {feature.checklist && (
            <Section title={t('flow.detail.checklist')}>
              <Flex vertical gap={6}>
                {feature.checklist.map((item) => (
                  <Flex key={item.key} align="center" gap={8}>
                    {item.ok ? (
                      <CheckCircleFilled style={{ color: STATUS.ok.solid }} />
                    ) : (
                      <MinusCircleOutlined style={{ color: STATUS.warning.solid }} />
                    )}
                    <Text style={{ fontSize: 13 }}>{item.label}</Text>
                  </Flex>
                ))}
              </Flex>
            </Section>
          )}

          <Section title={t('flow.detail.pendencies')}>
            {feature.pendencies.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>
                {t('flow.detail.noPendencies')}
              </Text>
            ) : (
              pendenciesByStage(feature).map((group) => (
                <Flex key={group.stage} vertical gap={6}>
                  <Text
                    type="secondary"
                    style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}
                  >
                    {t(`flow.detail.stages.${group.stage}`)}
                  </Text>
                  {group.items.map((pendency, i) => (
                    <Flex
                      key={i}
                      vertical
                      gap={2}
                      style={{
                        padding: '8px 10px',
                        borderLeft: `3px solid ${STATUS.warning.solid}`,
                        background: NEUTRA[75],
                        borderRadius: 6
                      }}
                    >
                      <Text style={{ fontSize: 13 }}>{pendency.message}</Text>
                      {pendency.file && (
                        <Text type="secondary" style={{ fontSize: 11, fontFamily: MONO_FONT }}>
                          {pendency.file}
                          {pendency.line !== undefined &&
                            ` · ${t('flow.detail.line', { line: pendency.line })}`}
                        </Text>
                      )}
                    </Flex>
                  ))}
                </Flex>
              ))
            )}
          </Section>

          {feature.rules.length > 0 && (
            <Section title={t('flow.detail.rules')}>
              <Flex gap={4} wrap>
                {feature.rules.map((rule) => (
                  <Tag key={rule} style={{ marginInlineEnd: 0, fontFamily: MONO_FONT }}>
                    {rule}
                  </Tag>
                ))}
              </Flex>
            </Section>
          )}
        </Flex>
      )}
    </Drawer>
  )
}
