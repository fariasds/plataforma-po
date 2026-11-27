import { Flex, Tag, Typography, theme } from 'antd'
import type { BoardFeature } from '@shared/flow-board'
import { t, tPlural } from '../../i18n'
import { MONO_FONT, NEUTRA, STATUS } from '../../theme'
import { idsToConfirm } from './board-view'

const { Text } = Typography

/** Etiqueta de atenção: âmbar é "precisa de olhar" (design system, `STATUS.warning`). */
function WarningTag({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <Tag
      variant="filled"
      style={{ marginInlineEnd: 0, background: STATUS.warning.bg, color: STATUS.warning.text }}
    >
      {children}
    </Tag>
  )
}

/** Uma Feature no funil. É um botão: abre a Feature. */
export function FeatureCard({
  feature,
  onOpen
}: {
  feature: BoardFeature
  onOpen: () => void
}): React.JSX.Element {
  const { token } = theme.useToken()
  const pendencies = feature.pendencies.length
  const toConfirm = idsToConfirm(feature)
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        font: 'inherit',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        background: token.colorBgContainer,
        border: `1px solid ${NEUTRA[200]}`,
        borderRadius: 12,
        cursor: 'pointer',
        color: NEUTRA[800]
      }}
    >
      <Flex align="center" gap={6} wrap>
        {feature.featureId !== null ? (
          <Text style={{ fontFamily: MONO_FONT, fontSize: 12, color: NEUTRA[500] }}>
            #{feature.featureId}
          </Text>
        ) : (
          <Tag style={{ marginInlineEnd: 0 }}>{t('flow.card.draft')}</Tag>
        )}
      </Flex>
      <Text strong style={{ fontSize: 13, lineHeight: 1.35 }}>
        {feature.title}
      </Text>
      <Flex gap={4} wrap>
        {pendencies > 0 && <WarningTag>{tPlural('flow.card.pendencies', pendencies)}</WarningTag>}
        {toConfirm > 0 && (
          // Confirmar é ação do PO, não situação: vai no destaque, não numa cor de STATUS.
          <Tag
            variant="filled"
            style={{
              marginInlineEnd: 0,
              background: token.colorPrimaryBg,
              color: token.colorPrimaryText
            }}
          >
            {tPlural('flow.card.toConfirm', toConfirm)}
          </Tag>
        )}
        {feature.stale && (
          <WarningTag>{t('flow.card.stale', { days: feature.staleDays ?? 0 })}</WarningTag>
        )}
        {feature.divergences.length > 0 && <WarningTag>{t('flow.card.divergence')}</WarningTag>}
      </Flex>
      {feature.plan && feature.plan.active > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('flow.card.written', { written: feature.plan.written, active: feature.plan.active })}
        </Text>
      )}
    </button>
  )
}
