import { Button, Flex, Tag, Typography, theme } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ReleaseNoteItem, ReleaseNoteType } from '@shared/release-notes'
import { t } from '../../i18n'
import { accentTones, MONO_FONT, STATUS } from '../../theme'
import { SCREEN_ROUTE, screenLabel } from './screens'

const { Text, Paragraph } = Typography

/**
 * Etiqueta do tipo. "Novo" usa o tom do destaque, porque chama para algo que dá
 * para experimentar; melhoria e correção ficam em neutro. Nenhuma é situação.
 */
export function ReleaseTypeTag({ type }: { type: ReleaseNoteType }): React.JSX.Element {
  const { token } = theme.useToken()
  const tones = accentTones(token.colorPrimary)
  const isNew = type === 'new'
  return (
    <Tag
      bordered={false}
      style={{
        marginInlineEnd: 0,
        flex: 'none',
        fontWeight: 600,
        color: isNew ? tones.softText : STATUS.neutral.text,
        background: isNew ? tones.soft : STATUS.neutral.bg
      }}
    >
      {t(`releaseNotes.types.${type}`)}
    </Tag>
  )
}

export function Mono({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <span style={{ fontFamily: MONO_FONT }}>{children}</span>
}

/** Uma novidade em linha: etiqueta, título, explicação e o link para a tela. */
export function ReleaseItemRow({
  item,
  first,
  mark = (text) => text
}: {
  item: ReleaseNoteItem
  first?: boolean
  /** Realce da busca no histórico. */
  mark?: (text: string) => React.ReactNode
}): React.JSX.Element {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const screen = item.screen
  return (
    <Flex
      gap={12}
      style={{
        padding: '12px 0',
        borderTop: first ? undefined : `1px solid ${token.colorBorderSecondary}`
      }}
    >
      <ReleaseTypeTag type={item.type} />
      <Flex vertical gap={2} style={{ minWidth: 0 }}>
        <Text strong>{mark(item.title)}</Text>
        <Paragraph type="secondary" style={{ margin: 0, lineHeight: 1.5, maxWidth: '72ch' }}>
          {mark(item.text)}
        </Paragraph>
        {screen && (
          <Button
            type="link"
            icon={<ArrowRightOutlined />}
            iconPlacement="end"
            onClick={() => navigate(SCREEN_ROUTE[screen])}
            style={{ alignSelf: 'flex-start', padding: 0, height: 'auto', marginTop: 4 }}
          >
            {t('releaseNotes.open', { screen: screenLabel(screen) })}
          </Button>
        )}
      </Flex>
    </Flex>
  )
}
