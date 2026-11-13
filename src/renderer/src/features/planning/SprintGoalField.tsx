import { useState } from 'react'
import { Alert, Button, Flex, Input, Modal, Table, Tag, Typography } from 'antd'
import { CopyOutlined, SnippetsOutlined } from '@ant-design/icons'
import {
  MAX_GOAL_CHARS,
  MAX_PASTED_CHARS,
  parsePastedGoal,
  type PastedGoal,
  type SprintGoalItem,
  type SprintGoalRequest
} from '@shared/ai'
import type { UnifiedSprint } from '@shared/azure'
import { HelpTip } from '../../components/HelpTip'
import { t, tPlural } from '../../i18n'
import { useBuildSprintGoalRequest } from '../../ipc/useAi'
import { MONO_FONT, NEUTRA, STATUS } from '../../theme'

const { Paragraph, Text } = Typography

interface Props {
  selectionId: string
  sprint: UnifiedSprint
  /** Itens marcados, na ordem da tabela. Só os IDs vão para o main. */
  itemIds: number[]
  value: string
  /** A cada tecla: mantém a prévia do resumo em dia. */
  onChange: (text: string) => void
  /** Ao sair do campo ou aceitar um rascunho: grava nos Dados de trabalho. */
  onCommit: (text: string) => void
}

/**
 * Objetivo da sprint (RN-PLN-20), escrito à mão ou a partir da resposta da IA do
 * PO (RN-PLN-21, ADR 0007). O app não fala com IA: monta o pedido, o PO o copia
 * para a IA dele e cola a resposta de volta. O pedido passa por uma prévia
 * (RN-SEC-24) e a resposta colada é rascunho até o PO aceitar (RN-SEC-26).
 */
export function SprintGoalField({
  selectionId,
  sprint,
  itemIds,
  value,
  onChange,
  onCommit
}: Props): React.JSX.Element {
  const build = useBuildSprintGoalRequest()
  const [confirming, setConfirming] = useState<SprintGoalRequest | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [pasted, setPasted] = useState('')
  const [draft, setDraft] = useState<PastedGoal | null>(null)

  function askPreview(): void {
    setCopyFailed(false)
    build.mutate({ selectionId, sprint, itemIds }, { onSuccess: setConfirming })
  }

  async function copyRequest(): Promise<void> {
    if (!confirming) return
    try {
      // O que vai para a área de transferência é o texto que a prévia mostrou.
      await navigator.clipboard.writeText(confirming.text)
      setConfirming(null)
      setPasting(true)
    } catch {
      setCopyFailed(true)
    }
  }

  function readPasted(): void {
    const parsed = parsePastedGoal(pasted)
    setDraft(parsed.text ? parsed : null)
  }

  function accept(text: string): void {
    onChange(text)
    onCommit(text)
    setDraft(null)
    setPasted('')
    setPasting(false)
  }

  function discard(): void {
    setDraft(null)
    setPasted('')
  }

  const columns = [
    {
      title: t('common.id'),
      dataIndex: 'id',
      width: 90,
      render: (id: number) => <Text style={{ fontFamily: MONO_FONT }}>#{id}</Text>
    },
    { title: t('common.title'), dataIndex: 'title' },
    { title: t('common.product'), dataIndex: 'product', width: 150 },
    { title: t('planning.goal.state'), dataIndex: 'state', width: 130 },
    {
      title: t('planning.goal.priority'),
      dataIndex: 'priority',
      width: 100,
      render: (priority: number | null) => priority ?? '—'
    },
    {
      title: t('planning.goal.description'),
      dataIndex: 'description',
      width: 150,
      render: (description: string) => (
        <Text type="secondary">
          {description
            ? t('planning.goal.descriptionChars', { count: description.length })
            : t('planning.goal.noDescription')}
        </Text>
      )
    }
  ]

  return (
    <Flex vertical gap={8} style={{ marginBottom: 16 }}>
      <Text strong>{t('planning.goal.title')}</Text>
      <Input.TextArea
        value={value}
        maxLength={MAX_GOAL_CHARS}
        autoSize={{ minRows: 2, maxRows: 12 }}
        placeholder={t('planning.goal.placeholder')}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onCommit(value)}
      />

      <Flex align="center" gap={8} wrap>
        <Button
          icon={<CopyOutlined />}
          loading={build.isPending}
          disabled={itemIds.length === 0}
          onClick={askPreview}
        >
          {t('planning.goal.copyRequest')}
        </Button>
        <Button icon={<SnippetsOutlined />} onClick={() => setPasting((open) => !open)}>
          {t('planning.goal.pasteAnswer')}
        </Button>
        <HelpTip rule="RN-SEC-24" />
        {itemIds.length === 0 && <Text type="secondary">{t('planning.goal.noItems')}</Text>}
      </Flex>

      {build.error && <Alert type="error" showIcon title={build.error.message} />}

      {pasting && !draft && (
        <Flex vertical gap={8}>
          <Input.TextArea
            value={pasted}
            maxLength={MAX_PASTED_CHARS}
            autoSize={{ minRows: 4, maxRows: 12 }}
            placeholder={t('planning.goal.pastePlaceholder')}
            onChange={(event) => setPasted(event.target.value)}
          />
          <Flex gap={8}>
            <Button type="primary" disabled={pasted.trim() === ''} onClick={readPasted}>
              {t('planning.goal.readAnswer')}
            </Button>
            <Button type="text" onClick={() => setPasting(false)}>
              {t('planning.goal.cancel')}
            </Button>
          </Flex>
        </Flex>
      )}

      {draft && (
        <Flex
          vertical
          gap={8}
          style={{ padding: 12, borderRadius: 8, border: `1px solid ${NEUTRA[200]}` }}
        >
          <Flex align="center" gap={8} wrap>
            <Tag
              variant="filled"
              style={{
                marginInlineEnd: 0,
                background: STATUS.warning.bg,
                color: STATUS.warning.text
              }}
            >
              {t('planning.goal.draftLabel')}
            </Tag>
            {!draft.structured && (
              <Text type="secondary" style={{ fontSize: 12.5 }}>
                {t('planning.goal.draftFreeForm')}
              </Text>
            )}
          </Flex>
          <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{draft.text}</Paragraph>
          <Flex gap={8} wrap>
            <Button type="primary" onClick={() => accept(draft.text)}>
              {t('planning.goal.useDraft')}
            </Button>
            <Button type="text" onClick={discard}>
              {t('planning.goal.discard')}
            </Button>
          </Flex>
        </Flex>
      )}

      {confirming && (
        <Modal
          open
          width={960}
          title={t('planning.goal.previewTitle')}
          okText={t('planning.goal.copy')}
          cancelText={t('planning.goal.cancel')}
          okButtonProps={{ disabled: confirming.items.length === 0, icon: <CopyOutlined /> }}
          onOk={() => void copyRequest()}
          onCancel={() => setConfirming(null)}
        >
          <Flex vertical gap={10}>
            <Text type="secondary">
              {tPlural('planning.goal.previewIntro', confirming.items.length)}{' '}
              {t('planning.goal.previewHint')}
            </Text>
            <Alert type="info" showIcon title={t('planning.goal.previewDestination')} />
            {confirming.missingIds.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title={tPlural('planning.goal.previewMissing', confirming.missingIds.length)}
              />
            )}
            {copyFailed && <Alert type="error" showIcon title={t('planning.goal.copyFailed')} />}
            <Table<SprintGoalItem>
              size="small"
              rowKey="id"
              pagination={false}
              scroll={{ y: 360 }}
              columns={columns}
              dataSource={confirming.items}
              expandable={{
                rowExpandable: (item) => item.description !== '',
                expandedRowRender: (item) => (
                  <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12.5 }}>
                    {item.description}
                  </Paragraph>
                )
              }}
            />
          </Flex>
        </Modal>
      )}
    </Flex>
  )
}
