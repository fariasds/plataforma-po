import { Button, Collapse, Flex, Modal, Typography, theme } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { highlightOf, type ReleaseEntry, type ReleaseNoteItem } from '@shared/release-notes'
import { t } from '../../i18n'
import { accentTones } from '../../theme'
import { Mono, ReleaseTypeTag } from './parts'
import { formatReleaseDate, RELEASE_ROUTE, SCREEN_ROUTE, versionLabel } from './screens'

const { Title, Text, Paragraph } = Typography

function ItemList({ items }: { items: ReleaseNoteItem[] }): React.JSX.Element {
  return (
    <Flex vertical gap={8} component="ul" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((item) => (
        <Flex key={item.title} component="li" gap={10} align="baseline">
          <ReleaseTypeTag type={item.type} />
          <Text type="secondary" style={{ lineHeight: 1.45 }}>
            <Text strong>{t('releaseNotes.modal.itemTitle', { title: item.title })}</Text>{' '}
            {item.text}
          </Text>
        </Flex>
      ))}
    </Flex>
  )
}

/**
 * Modal de novidades (`RN-HOM-04`, quadro C do desenho). Abre uma vez por versão;
 * fechar por qualquer caminho — botão, Esc ou fora — marca a versão como vista.
 * Quem pulou versões vê as anteriores recolhidas embaixo da mais nova.
 */
export function ReleaseNotesModal({
  entries,
  onClose
}: {
  /** Da mais nova para a mais antiga; a primeira é a do destaque. */
  entries: ReleaseEntry[]
  onClose: () => void
}): React.JSX.Element {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const tones = accentTones(token.colorPrimary)
  const [top, ...earlier] = entries
  // Sem destaque na mais nova (o destaque era de uma anterior), o título é a versão.
  const highlight = highlightOf(top)
  const others = top.items.filter((item) => item !== highlight)
  const screen = highlight?.screen

  const closeAndGo = (route?: string): void => {
    onClose()
    if (route) navigate(route)
  }

  return (
    <Modal
      open
      width={560}
      onCancel={() => closeAndGo()}
      aria-labelledby="release-notes-title"
      footer={
        <Flex gap={10} align="center" justify="flex-end" wrap>
          <Button
            type="link"
            onClick={() => closeAndGo(RELEASE_ROUTE)}
            style={{ marginInlineEnd: 'auto', padding: 0 }}
          >
            {t('releaseNotes.modal.allNotes')}
          </Button>
          <Button onClick={() => closeAndGo()}>{t('releaseNotes.modal.notNow')}</Button>
          {screen ? (
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              iconPlacement="end"
              onClick={() => closeAndGo(SCREEN_ROUTE[screen])}
            >
              {t(`releaseNotes.modal.try.${screen}`)}
            </Button>
          ) : (
            <Button type="primary" onClick={() => closeAndGo()}>
              {t('releaseNotes.modal.gotIt')}
            </Button>
          )}
        </Flex>
      }
    >
      <Flex vertical gap={14} style={{ paddingTop: 4 }}>
        <Flex gap={10} align="center">
          <Text
            style={{
              fontSize: 12.5,
              color: tones.softText,
              background: tones.soft,
              padding: '2px 10px',
              borderRadius: 999
            }}
          >
            <Mono>{versionLabel(top.version)}</Mono>
          </Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            <Mono>{formatReleaseDate(top.date)}</Mono>
          </Text>
        </Flex>
        <Title
          id="release-notes-title"
          level={2}
          style={{ margin: 0, fontSize: 22, letterSpacing: '-0.01em', textWrap: 'balance' }}
        >
          {highlight?.title ??
            t('releaseNotes.modal.title', { version: versionLabel(top.version) })}
        </Title>
        {highlight && (
          <Paragraph style={{ margin: 0, lineHeight: 1.55 }}>
            {highlight.details ?? highlight.text}
          </Paragraph>
        )}
        {others.length > 0 && <ItemList items={others} />}
        {earlier.length > 0 && (
          <Collapse
            ghost
            size="small"
            style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, borderRadius: 0 }}
            items={[
              {
                key: 'earlier',
                label: t('releaseNotes.modal.earlier', {
                  versions: earlier.map((entry) => versionLabel(entry.version)).join(', ')
                }),
                children: (
                  <Flex vertical gap={14}>
                    {earlier.map((entry) => (
                      <Flex key={entry.version} vertical gap={6}>
                        <Text type="secondary" style={{ fontSize: 12.5 }}>
                          <Mono>
                            {versionLabel(entry.version)} · {formatReleaseDate(entry.date)}
                          </Mono>
                        </Text>
                        <ItemList items={entry.items} />
                      </Flex>
                    ))}
                  </Flex>
                )
              }
            ]}
          />
        )}
      </Flex>
    </Modal>
  )
}
