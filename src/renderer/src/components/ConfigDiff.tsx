import { Flex, Tag, Typography } from 'antd'
import type { ConfigurationDiff, DiffEntry, EntityDiff } from '@shared/config/import'
import { hasChanges } from '@shared/config/import'
import { t } from '../i18n'
import { MONO_FONT, NEUTRA, STATUS } from '../theme'

const { Text } = Typography

type Kind = 'added' | 'changed' | 'removed'

/** Entra é verde, muda é azul e sai é vermelho: sair órfã dados (RN-CFG-02). */
const KIND_STATUS = { added: STATUS.ok, changed: STATUS.info, removed: STATUS.danger } as const

const ENTITIES: { key: keyof Omit<ConfigurationDiff, 'sections'>; label: () => string }[] = [
  { key: 'products', label: () => t('configDiff.product') },
  { key: 'groups', label: () => t('configDiff.group') },
  { key: 'squads', label: () => t('configDiff.squad') },
  { key: 'processProfiles', label: () => t('configDiff.processProfile') }
]

interface Row {
  kind: Kind
  label: string
  entry?: DiffEntry
}

function rowsOf(diff: ConfigurationDiff): Row[] {
  const rows: Row[] = []
  for (const kind of ['added', 'changed', 'removed'] as const) {
    for (const { key, label } of ENTITIES) {
      const list: EntityDiff = diff[key]
      for (const entry of list[kind]) rows.push({ kind, label: label(), entry })
    }
    if (kind === 'changed') {
      for (const section of diff.sections) {
        rows.push({ kind, label: t(`configDiff.sections.${section}`) })
      }
    }
  }
  return rows
}

/**
 * O que uma Configuração que chegou de fora muda na que está em uso (RN-CFG-09).
 * É a mesma lista para o arquivo importado e, depois, para a proposta da IA.
 */
export function ConfigDiff({ diff }: { diff: ConfigurationDiff }): React.JSX.Element {
  if (!hasChanges(diff)) return <Text type="secondary">{t('configDiff.noChanges')}</Text>

  return (
    <Flex
      vertical
      style={{ border: `1px solid ${NEUTRA[200]}`, borderRadius: 8, overflow: 'hidden' }}
    >
      {rowsOf(diff).map((row, index) => {
        const status = KIND_STATUS[row.kind]
        return (
          <Flex
            key={index}
            gap={12}
            align="baseline"
            style={{
              padding: '8px 12px',
              borderTop: index === 0 ? undefined : `1px solid ${NEUTRA[200]}`
            }}
          >
            <Tag
              variant="filled"
              style={{
                background: status.bg,
                color: status.text,
                minWidth: 52,
                textAlign: 'center',
                marginInlineEnd: 0
              }}
            >
              {t(`configDiff.kind.${row.kind}`)}
            </Tag>
            <Flex vertical style={{ minWidth: 0 }}>
              <Text>
                {row.label}
                {row.entry && row.entry.name !== row.entry.id && (
                  <Text strong> {row.entry.name}</Text>
                )}
              </Text>
              {row.entry && (
                <Text type="secondary" style={{ fontFamily: MONO_FONT, fontSize: 12 }}>
                  {row.entry.id}
                </Text>
              )}
            </Flex>
          </Flex>
        )
      })}
    </Flex>
  )
}
