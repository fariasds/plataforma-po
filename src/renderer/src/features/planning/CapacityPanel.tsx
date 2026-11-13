import { Card, Col, Flex, InputNumber, Progress, Row, Tag, Typography } from 'antd'
import { HelpTip } from '../../components/HelpTip'
import { formatHours, t } from '../../i18n'
import { STATUS } from '../../theme'
import { capacityHours, capacityRatio, capacityStatus } from './planning-rules'
import { useCapacity } from './planning-work-data'

const { Text } = Typography

function CapacityIndicator({
  label,
  allocated,
  capacity
}: {
  label: string
  allocated: number
  capacity: number
}): React.JSX.Element {
  const ratio = capacityRatio(allocated, capacity)
  const status = capacityStatus(ratio)

  const tone = { ok: STATUS.ok, warning: STATUS.warning, over: STATUS.danger }[status]
  const statusLabel = {
    ok: t('planning.capacityWithin'),
    warning: t('planning.capacityAtLimit'),
    over: t('planning.capacityOver')
  }[status]

  return (
    <Flex vertical gap={8}>
      <Flex align="baseline" justify="space-between" gap={12} wrap>
        <Text strong>{label}</Text>
        <Text type="secondary">
          <Text strong>{formatHours(allocated)}</Text> / {formatHours(capacity)}
        </Text>
      </Flex>
      <Progress
        percent={Math.min(ratio * 100, 100)}
        strokeColor={tone.solid}
        showInfo={false}
        size={{ height: 12 }}
      />
      <div>
        <Tag
          variant="filled"
          style={{ background: tone.bg, color: tone.text, fontWeight: 600, marginInlineEnd: 0 }}
        >
          {statusLabel} · {Math.round(ratio * 100)}%
        </Tag>
      </div>
    </Flex>
  )
}

interface Props {
  allocatedFrontHours: number
  allocatedBackHours: number
  /** Sem o campo de esforço na Configuração, a disciplina não tem o que medir. */
  showFront: boolean
  showBack: boolean
}

export function CapacityPanel({
  allocatedFrontHours,
  allocatedBackHours,
  showFront,
  showBack
}: Props): React.JSX.Element {
  const { config, productiveHours, update } = useCapacity()

  const { frontend: frontCapacity, backend: backCapacity } = capacityHours(config, productiveHours)

  return (
    <Card title={t('planning.capacityTitle')} extra={<HelpTip rule="RN-PLN-15" />}>
      <Flex vertical gap={20}>
        <Row gutter={[16, 20]}>
          {showFront && (
            <>
              <Col flex="1 1 140px">
                <Text type="secondary">{t('planning.frontDevs')}</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={20}
                  step={0.5}
                  value={config.frontDevs}
                  onChange={(value) => update({ frontDevs: value ?? 0 })}
                />
              </Col>
              <Col flex="1 1 140px">
                <Text type="secondary">{t('planning.frontBugPercent')}</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  suffix="%"
                  value={config.frontBugPercent}
                  onChange={(value) => update({ frontBugPercent: value ?? 0 })}
                />
              </Col>
            </>
          )}
          {showBack && (
            <>
              <Col flex="1 1 140px">
                <Text type="secondary">{t('planning.backDevs')}</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={20}
                  step={0.5}
                  value={config.backDevs}
                  onChange={(value) => update({ backDevs: value ?? 0 })}
                />
              </Col>
              <Col flex="1 1 140px">
                <Text type="secondary">{t('planning.backBugPercent')}</Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  suffix="%"
                  value={config.backBugPercent}
                  onChange={(value) => update({ backBugPercent: value ?? 0 })}
                />
              </Col>
            </>
          )}
          <Col flex="1 1 140px">
            <Text type="secondary">{t('planning.sprintDays')}</Text>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={30}
              value={config.sprintDays}
              onChange={(value) => update({ sprintDays: value ?? 1 })}
            />
          </Col>
        </Row>
        <Row gutter={[16, 20]}>
          {showFront && (
            <Col xs={24} md={showBack ? 12 : 24}>
              <CapacityIndicator
                label={t('disciplines.frontend')}
                allocated={allocatedFrontHours}
                capacity={frontCapacity}
              />
            </Col>
          )}
          {showBack && (
            <Col xs={24} md={showFront ? 12 : 24}>
              <CapacityIndicator
                label={t('disciplines.backend')}
                allocated={allocatedBackHours}
                capacity={backCapacity}
              />
            </Col>
          )}
        </Row>
      </Flex>
    </Card>
  )
}
