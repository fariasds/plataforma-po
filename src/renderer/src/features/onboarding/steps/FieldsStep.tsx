import { Form, Input, Select, Typography } from 'antd'
import type { Configuration } from '@shared/config/schema'
import type { DiscoveredField } from '@shared/discovery'
import { ErrorState } from '../../../components/ErrorState'
import { compareText, t } from '../../../i18n'
import { useDiscoveredFields } from '../useDiscovery'
import type { StepProps } from './types'

const { Paragraph } = Typography

type FieldKey = keyof Configuration['customFields']

const NUMERIC = new Set(['integer', 'double', 'picklistInteger', 'picklistDouble'])
const TEXT = new Set(['string', 'plainText', 'picklistString'])

/** Cada campo liga um indicador; sem ele, o indicador mostra um estado vazio explicando. */
const MAPPINGS: { key: FieldKey; numeric: boolean }[] = [
  { key: 'reworkCount', numeric: true },
  { key: 'effortFrontend', numeric: true },
  { key: 'effortBackend', numeric: true },
  { key: 'effortQa', numeric: true },
  { key: 'criticality', numeric: false }
]

function fieldOptions(
  fields: DiscoveredField[],
  numeric: boolean
): { value: string; label: string }[] {
  const accepted = numeric ? NUMERIC : TEXT
  return fields
    .filter((f) => accepted.has(f.type))
    .map((f) => ({ value: f.referenceName, label: `${f.name} (${f.referenceName})` }))
}

export function FieldsStep({ draft, update }: StepProps): React.JSX.Element {
  const results = useDiscoveredFields(draft.projects)
  const failure = results.find((r) => r.error)?.error
  const loading = results.some((r) => r.isPending)

  const byRef = new Map<string, DiscoveredField>()
  for (const field of results.flatMap((r) => r.data ?? [])) byRef.set(field.referenceName, field)
  const fields = [...byRef.values()].sort((a, b) => compareText(a.name, b.name))

  const set = (key: FieldKey, value: string | string[] | null): void =>
    update((d) => ({ ...d, customFields: { ...d.customFields, [key]: value } }))

  return (
    <>
      <Paragraph type="secondary">{t('onboarding.fields.intro')}</Paragraph>

      {failure && <ErrorState title={t('onboarding.fields.listFailed')} error={failure} />}

      <Form layout="vertical" component="div">
        {MAPPINGS.map((mapping) => {
          const current = draft.customFields[mapping.key]
          const multiple = mapping.key === 'criticality'
          return (
            <Form.Item
              key={mapping.key}
              label={t(`onboarding.fields.mappings.${mapping.key}.label`)}
              extra={t(`onboarding.fields.mappings.${mapping.key}.hint`)}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={loading}
                mode={multiple ? 'multiple' : undefined}
                placeholder={t('onboarding.fields.notUsedPlaceholder')}
                options={fieldOptions(fields, mapping.numeric)}
                value={
                  multiple
                    ? current === null
                      ? []
                      : ([] as string[]).concat(current)
                    : ((current as string | null) ?? undefined)
                }
                onChange={(value?: string | string[]) => {
                  if (Array.isArray(value)) {
                    set(
                      mapping.key,
                      value.length === 0 ? null : value.length === 1 ? value[0] : value
                    )
                  } else {
                    set(mapping.key, value ?? null)
                  }
                }}
              />
            </Form.Item>
          )
        })}

        <Form.Item
          label={t('onboarding.fields.recurrentTagLabel')}
          extra={t('onboarding.fields.recurrentTagHint')}
        >
          <Input
            allowClear
            placeholder={t('onboarding.fields.recurrentTagPlaceholder')}
            value={draft.recurrentBugTag ?? ''}
            onChange={(event) =>
              update((d) => ({ ...d, recurrentBugTag: event.target.value || null }))
            }
          />
        </Form.Item>
      </Form>
    </>
  )
}
