import { Popover, Typography } from 'antd'
import { QuestionOutlined } from '@ant-design/icons'
import { helpRule, type HelpRuleId } from '../help/rules'
import { t } from '../i18n'
import { NEUTRA } from '../theme'

const { Text, Paragraph } = Typography

/**
 * Botão de ajuda de um indicador ou gráfico.
 *
 * Recebe o ID da regra de negócio e busca o texto por `help/rules.ts` — assim o
 * componente não carrega conteúdo, e o mesmo identificador liga tela, código e
 * documentação.
 */
export function HelpTip({ rule }: { rule: HelpRuleId }): React.JSX.Element {
  const { title, text } = helpRule(rule)

  return (
    <Popover
      trigger={['hover', 'click']}
      placement="topRight"
      title={title}
      content={
        <div style={{ maxWidth: 320 }}>
          <Paragraph style={{ marginBottom: 8 }}>{text}</Paragraph>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('help.ruleLabel', { rule })}
          </Text>
        </div>
      }
    >
      <button
        type="button"
        aria-label={t('help.ariaLabel', { title })}
        style={{
          font: 'inherit',
          width: 22,
          height: 22,
          flex: 'none',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          border: `1px solid ${NEUTRA[200]}`,
          background: '#FFFFFF',
          color: NEUTRA[500],
          fontSize: 11,
          fontWeight: 600,
          cursor: 'help'
        }}
      >
        <QuestionOutlined />
      </button>
    </Popover>
  )
}
