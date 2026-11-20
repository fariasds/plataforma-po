import { useState } from 'react'
import { Button, Flex, Popover, Segmented, Tooltip, Typography } from 'antd'
import { DoubleRightOutlined } from '@ant-design/icons'
import type { AnticipatedShare, PlanningItem } from '@shared/dashboards'
import { HelpTip } from '../../components/HelpTip'
import { formatPercent, t } from '../../i18n'
import { MONO_FONT, NEUTRA, STATUS } from '../../theme'
import type { EffortAvailability } from './AddManualItemForm'
import { applyAnticipation, SHARE_PERCENTS, type SharePercent } from './planning-rules'

const { Text } = Typography

function points(value: number | null): string {
  return value === null ? '—' : String(value)
}

interface Props {
  /** O item como veio do Azure, antes de qualquer desconto. */
  item: PlanningItem
  current: AnticipatedShare | undefined
  effort: EffortAvailability
  onSave: (share: AnticipatedShare) => void
  onRemove: () => void
}

/**
 * Marca quanto de um item do Azure o time já fez numa sprint anterior
 * (RN-PLN-23). O painel mostra, antes de salvar, o que fica nesta sprint.
 */
export function AnticipationButton({
  item,
  current,
  effort,
  onSave,
  onRemove
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [front, setFront] = useState<SharePercent>(0)
  const [back, setBack] = useState<SharePercent>(0)

  function toggle(next: boolean): void {
    if (next) {
      setFront((current?.frontendPercent ?? 0) as SharePercent)
      setBack((current?.backendPercent ?? 0) as SharePercent)
    }
    setOpen(next)
  }

  const preview = applyAnticipation(item, front, back)
  const options = SHARE_PERCENTS.map((p) => ({ value: p, label: formatPercent(p) }))
  const label = current ? t('planning.anticipation.edit') : t('planning.anticipation.mark')

  const content = (
    <Flex vertical gap={14} style={{ width: 360 }}>
      <Text type="secondary" style={{ fontSize: 13 }}>
        {t('planning.anticipation.question')}
      </Text>

      {effort.frontend && (
        <Flex vertical gap={6}>
          <Text strong style={{ fontSize: 12.5 }}>
            {t('planning.anticipation.frontDone')}{' '}
            <Text type="secondary" style={{ fontSize: 12.5, fontWeight: 400 }}>
              {t('planning.anticipation.inAzure', { points: points(item.frontend) })}
            </Text>
          </Text>
          <Segmented<SharePercent> block options={options} value={front} onChange={setFront} />
        </Flex>
      )}

      {effort.backend && (
        <Flex vertical gap={6}>
          <Text strong style={{ fontSize: 12.5 }}>
            {t('planning.anticipation.backDone')}{' '}
            <Text type="secondary" style={{ fontSize: 12.5, fontWeight: 400 }}>
              {t('planning.anticipation.inAzure', { points: points(item.backend) })}
            </Text>
          </Text>
          <Segmented<SharePercent> block options={options} value={back} onChange={setBack} />
        </Flex>
      )}

      {effort.qa && (
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          {t('planning.anticipation.qaWhole')}
        </Text>
      )}

      <Flex
        vertical
        gap={2}
        style={{ background: NEUTRA[75], borderRadius: 8, padding: '10px 12px' }}
      >
        <Text style={{ fontSize: 13 }}>
          {t('planning.anticipation.remains')}{' '}
          <Text strong style={{ fontFamily: MONO_FONT, fontSize: 13 }}>
            {[
              effort.frontend && `${t('disciplines.front')} ${points(preview.frontend)}`,
              effort.backend && `${t('disciplines.back')} ${points(preview.backend)}`,
              effort.qa && `${t('disciplines.qa')} ${points(preview.qa)}`
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('planning.anticipation.totalChange', {
            from: points(item.total),
            to: points(preview.total)
          })}
        </Text>
      </Flex>

      <Flex align="center" gap={8}>
        {current && (
          <Button
            type="text"
            danger
            onClick={() => {
              onRemove()
              setOpen(false)
            }}
          >
            {t('planning.anticipation.remove')}
          </Button>
        )}
        <Button style={{ marginInlineStart: 'auto' }} onClick={() => setOpen(false)}>
          {t('actions.cancel')}
        </Button>
        <Button
          type="primary"
          onClick={() => {
            onSave({
              id: item.id,
              product: item.product,
              frontendPercent: front,
              backendPercent: back
            })
            setOpen(false)
          }}
        >
          {t('actions.save')}
        </Button>
      </Flex>
    </Flex>
  )

  return (
    <Popover
      open={open}
      onOpenChange={toggle}
      trigger="click"
      placement="bottomRight"
      title={
        <Flex align="center" gap={8}>
          {t('planning.anticipation.title')}
          <HelpTip rule="RN-PLN-24" />
        </Flex>
      }
      content={content}
    >
      <Tooltip title={label}>
        <Button
          type="text"
          size="small"
          aria-label={label}
          icon={<DoubleRightOutlined />}
          style={current ? { background: STATUS.info.bg, color: STATUS.info.text } : undefined}
        />
      </Tooltip>
    </Popover>
  )
}
