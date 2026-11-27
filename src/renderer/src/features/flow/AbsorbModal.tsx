import { useState } from 'react'
import { Checkbox, Empty, Flex, Modal, Tag, Typography } from 'antd'
import type { AbsorbPageEntry, AbsorbPreview } from '@shared/flow-absorb'
import { t } from '../../i18n'
import { MONO_FONT, NEUTRA, STATUS, type StatusKey } from '../../theme'

const { Text } = Typography

/**
 * A diferença da absorção (RN-CAT-03), no padrão do ConfigDiff: entra em verde, muda
 * em azul, sai em vermelho. Página em conflito só entra com o PO marcando a da wiki.
 */
const STATUS_TONE: Record<AbsorbPageEntry['status'], StatusKey> = {
  new: 'ok',
  changed: 'info',
  unchanged: 'neutral',
  'local-changed': 'neutral',
  conflict: 'warning',
  'removed-in-wiki': 'neutral'
}

const RULE_CHANGES = ['added', 'changed', 'removed'] as const

function RuleList({
  label,
  ids
}: {
  label: 'added' | 'changed' | 'removed'
  ids: string[]
}): React.JSX.Element | null {
  if (ids.length === 0) return null
  const tone = label === 'added' ? STATUS.ok : label === 'changed' ? STATUS.info : STATUS.danger
  return (
    <Text style={{ fontSize: 12, color: tone.text, fontFamily: MONO_FONT }}>
      {t(`catalog.preview.${label}`, { ids: ids.join(', ') })}
    </Text>
  )
}

export function AbsorbModal({
  preview,
  pending,
  onCancel,
  onConfirm
}: {
  preview: AbsorbPreview | null
  pending: boolean
  onCancel: () => void
  onConfirm: (useWiki: string[]) => void
}): React.JSX.Element {
  const [useWiki, setUseWiki] = useState<Set<string>>(new Set())
  const changes = (preview?.pages ?? []).filter((p) => p.status !== 'unchanged')

  return (
    <Modal
      open={preview !== null}
      title={t('catalog.preview.title')}
      okText={t('catalog.preview.confirm')}
      onOk={() => onConfirm([...useWiki])}
      onCancel={onCancel}
      confirmLoading={pending}
      width={640}
      destroyOnHidden
      afterClose={() => setUseWiki(new Set())}
    >
      <Flex vertical gap={12}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {t('catalog.preview.hint')}
        </Text>
        {changes.length === 0 && (preview?.localOnly.length ?? 0) === 0 ? (
          <Empty description={t('catalog.preview.nothing')} />
        ) : (
          changes.map((page) => {
            const tone = STATUS[STATUS_TONE[page.status]]
            return (
              <Flex
                key={page.path}
                vertical
                gap={4}
                style={{
                  padding: '8px 10px',
                  border: `1px solid ${NEUTRA[200]}`,
                  borderRadius: 10
                }}
              >
                <Flex align="center" justify="space-between" gap={8}>
                  <Text strong style={{ fontSize: 13 }}>
                    {page.file}
                  </Text>
                  <Tag
                    variant="filled"
                    style={{ marginInlineEnd: 0, background: tone.bg, color: tone.text }}
                  >
                    {t(`catalog.preview.status.${page.status}`)}
                  </Tag>
                </Flex>
                {RULE_CHANGES.map((kind) => (
                  <RuleList key={kind} label={kind} ids={page.rules[kind]} />
                ))}
                {page.status === 'conflict' && (
                  <Checkbox
                    checked={useWiki.has(page.path)}
                    onChange={(event) => {
                      const next = new Set(useWiki)
                      if (event.target.checked) next.add(page.path)
                      else next.delete(page.path)
                      setUseWiki(next)
                    }}
                  >
                    {t('catalog.preview.useWiki')}
                  </Checkbox>
                )}
              </Flex>
            )
          })
        )}
        {(preview?.localOnly.length ?? 0) > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('catalog.preview.localOnly', { files: preview!.localOnly.join(', ') })}
          </Text>
        )}
      </Flex>
    </Modal>
  )
}
