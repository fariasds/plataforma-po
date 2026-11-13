import { Alert, Collapse, Descriptions, Tag, Typography } from 'antd'
import type { Configuration } from '@shared/config/schema'
import { removedIds, validateConfiguration } from '@shared/config/validate'
import { t } from '../../../i18n'
import { tRich } from '../../../i18n/rich'
import { IssueList } from '../IssueList'
import { buildConfiguration, type WizardDraft } from '../draft'

const { Paragraph } = Typography

export function ReviewStep({
  draft,
  previous
}: {
  draft: WizardDraft
  /** A Configuração em uso, para avisar de IDs que sumiriam (RN-CFG-02). */
  previous: Configuration | null
}): React.JSX.Element {
  const built = buildConfiguration(draft)
  const result = validateConfiguration(built)
  const removed =
    result.ok && previous ? removedIds(previous, result.config) : { products: [], groups: [] }
  const lost = [...removed.products, ...removed.groups]

  return (
    <>
      <Paragraph type="secondary">{tRich('onboarding.review.intro')}</Paragraph>

      {!result.ok && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('onboarding.review.fixBeforeSaving')}
          description={<IssueList issues={result.issues} />}
        />
      )}

      {lost.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('onboarding.review.lostTitle', { ids: lost.join(', ') })}
          description={t('onboarding.review.lostText')}
        />
      )}

      <Descriptions
        size="small"
        column={1}
        bordered
        items={[
          { key: 'org', label: t('common.organization'), children: draft.organization },
          {
            key: 'products',
            label: t('common.products'),
            children: built.products.map((p) => (
              <Tag key={p.id} color={p.color}>
                {p.name}
              </Tag>
            ))
          },
          {
            key: 'groups',
            label: t('common.groups'),
            children: built.groups?.length ? built.groups.map((g) => g.name).join(', ') : '—'
          },
          {
            key: 'process',
            label: t('common.processProfiles'),
            children: Object.keys(built.processProfiles).join(', ') || '—'
          },
          {
            key: 'fields',
            label: t('onboarding.review.customFields'),
            children:
              Object.entries(draft.customFields)
                .filter(([, value]) => value !== null)
                .map(([key]) => key)
                .join(', ') || t('onboarding.review.noCustomFields')
          },
          {
            key: 'calendar',
            label: t('onboarding.review.calendar'),
            children: t('onboarding.review.calendarSummary', {
              country: draft.calendar.country ?? t('onboarding.review.noCountry'),
              holidays: draft.calendar.extraHolidays.length,
              hours: draft.calendar.productiveHoursPerDay
            })
          }
        ]}
      />

      <Collapse
        size="small"
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'json',
            label: t('onboarding.review.seeFile'),
            children: (
              <pre style={{ margin: 0, maxHeight: 360, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(built, null, 2)}
              </pre>
            )
          }
        ]}
      />
    </>
  )
}
