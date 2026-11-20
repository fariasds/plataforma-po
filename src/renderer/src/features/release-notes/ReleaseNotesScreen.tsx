import { useMemo, useState } from 'react'
import { Button, Card, Empty, Flex, Input, Segmented, Tag, Typography, theme } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import {
  normalizeSearch,
  RELEASE_NOTE_TYPES,
  RELEASE_NOTES,
  searchReleaseNotes,
  type ReleaseNoteType
} from '@shared/release-notes'
import { t, tPlural } from '../../i18n'
import { accentTones } from '../../theme'
import { Mono, ReleaseItemRow } from './parts'
import { formatReleaseDate, versionLabel } from './screens'

const { Text } = Typography

type TypeFilter = ReleaseNoteType | 'all'

/**
 * Realça o trecho que bate com a busca, sem diferenciar acento ("analise" acha
 * "Análise"). Em NFC cada letra acentuada é um caractere só e vira um caractere
 * sem acento, então a posição achada no texto normalizado vale no original.
 */
function markMatch(
  text: string,
  query: string,
  tones: ReturnType<typeof accentTones>
): React.ReactNode {
  const q = normalizeSearch(query)
  if (!q) return text
  const original = text.normalize('NFC')
  const index = normalizeSearch(original).indexOf(q)
  if (index < 0) return text
  return (
    <>
      {original.slice(0, index)}
      <mark style={{ background: tones.soft, color: tones.softText, padding: 0, borderRadius: 3 }}>
        {original.slice(index, index + q.length)}
      </mark>
      {original.slice(index + q.length)}
    </>
  )
}

/**
 * Histórico de novidades (`RN-HOM-05`): todas as versões, da mais nova para a mais
 * antiga, com busca por texto ou versão e filtro por tipo. Não está no menu: abre
 * pela etiqueta da versão no cabeçalho da Home, pelo bloco da Home e pelo modal.
 */
export function ReleaseNotesScreen(): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const { token } = theme.useToken()
  const tones = accentTones(token.colorPrimary)
  const mark = (text: string): React.ReactNode => markMatch(text, query, tones)
  const results = useMemo(() => searchReleaseNotes(RELEASE_NOTES, query, type), [query, type])
  const itemCount = results.reduce((sum, entry) => sum + entry.items.length, 0)

  return (
    <Flex vertical gap={20} style={{ maxWidth: 1080 }}>
      <Flex gap={12} align="center" wrap>
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined aria-hidden="true" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('releaseNotes.history.searchPlaceholder')}
          aria-label={t('releaseNotes.history.search')}
          style={{ flex: '1 1 320px' }}
        />
        <Segmented<TypeFilter>
          aria-label={t('releaseNotes.history.typeFilter')}
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: t('releaseNotes.allTypes') },
            ...RELEASE_NOTE_TYPES.map((value) => ({
              value,
              label: t(`releaseNotes.types.${value}`)
            }))
          ]}
        />
        <Text type="secondary" style={{ fontSize: 13 }} aria-live="polite">
          {t('releaseNotes.history.count', {
            items: tPlural('releaseNotes.history.items', itemCount),
            versions: tPlural('releaseNotes.history.versions', results.length)
          })}
        </Text>
      </Flex>

      {results.length === 0 ? (
        <Card>
          <Empty
            description={
              query.trim()
                ? t('releaseNotes.history.empty', { query: query.trim() })
                : t('releaseNotes.history.emptyType')
            }
          >
            {query.trim() && (
              <Button onClick={() => setQuery('')}>{t('releaseNotes.history.clear')}</Button>
            )}
          </Empty>
        </Card>
      ) : (
        results.map((entry) => (
          <Flex
            key={entry.version}
            gap="8px 24px"
            wrap
            component="section"
            aria-label={versionLabel(entry.version)}
          >
            <Flex vertical gap={6} style={{ flex: '0 0 140px', paddingTop: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: 500 }}>
                <Mono>{versionLabel(entry.version)}</Mono>
              </Text>
              <Text type="secondary" style={{ fontSize: 12.5 }}>
                <Mono>{formatReleaseDate(entry.date)}</Mono>
              </Text>
              {entry.version === __APP_VERSION__ && (
                <span>
                  {/* A instalada é a ativa: destaque, não situação. */}
                  <Tag
                    bordered={false}
                    style={{ color: tones.softText, background: tones.soft, fontWeight: 600 }}
                  >
                    {t('releaseNotes.installed')}
                  </Tag>
                </span>
              )}
            </Flex>
            <Card
              style={{ flex: '1 1 420px', minWidth: 0 }}
              styles={{ body: { padding: '4px 22px' } }}
            >
              {entry.items.map((item, i) => (
                <ReleaseItemRow key={item.title} item={item} first={i === 0} mark={mark} />
              ))}
            </Card>
          </Flex>
        ))
      )}
    </Flex>
  )
}
