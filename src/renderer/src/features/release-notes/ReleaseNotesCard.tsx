import { Button, Card, Flex, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { RELEASE_NOTES, releaseEntry } from '@shared/release-notes'
import { t } from '../../i18n'
import { tRich } from '../../i18n/rich'
import { Mono, ReleaseItemRow } from './parts'
import { formatReleaseDate, RELEASE_ROUTE, versionLabel } from './screens'

const { Title, Text } = Typography

/**
 * Bloco "Novidades da vX.Y.Z" da Home (`RN-HOM-04`): as novidades da versão
 * instalada, sempre à vista, para quem fechou o modal sem ler.
 */
export function ReleaseNotesCard({ version }: { version: string }): React.JSX.Element | null {
  const navigate = useNavigate()
  const entry = releaseEntry(RELEASE_NOTES, version)
  // Versão de desenvolvimento sem entrada: o bloco some, a Home segue.
  if (!entry) return null

  return (
    <section aria-labelledby="home-release-notes">
      <Card>
        <Flex align="baseline" justify="space-between" gap={8} wrap style={{ marginBottom: 4 }}>
          <Title id="home-release-notes" level={2} style={{ margin: 0, fontSize: 15 }}>
            {tRich('releaseNotes.cardTitle', {
              version: <Mono>{versionLabel(entry.version)}</Mono>
            })}{' '}
            <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>
              · <Mono>{formatReleaseDate(entry.date)}</Mono>
            </Text>
          </Title>
          <Button
            type="link"
            onClick={() => navigate(RELEASE_ROUTE)}
            style={{ padding: 0, fontSize: 13 }}
          >
            {t('releaseNotes.allNotes')}
          </Button>
        </Flex>
        {entry.items.map((item, i) => (
          <ReleaseItemRow key={item.title} item={item} first={i === 0} />
        ))}
      </Card>
    </section>
  )
}
