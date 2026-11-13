import { useState } from 'react'
import { Button, Flex, Modal, Switch, Typography } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import type { UnifiedSprint } from '@shared/azure'
import type { PlanningItem } from '@shared/dashboards'
import { HelpTip } from '../../components/HelpTip'
import { useLinkOrganization } from '../../components/useWorkItemHref'
import { formatDateTime, t } from '../../i18n'
import { useConfiguration } from '../../ipc/useAzure'
import { STATUS } from '../../theme'
import { buildPlanningSummary, summaryToHtml, summaryToMarkdown } from './planning-summary'
import { planningKeys, useCapacity, useStoredValues } from './planning-work-data'
import { SprintGoalField } from './SprintGoalField'

const { Text } = Typography

interface Props {
  onClose: () => void
  /** ID do Produto ou Grupo: chave do objetivo guardado e escopo do pedido à IA. */
  selectionId: string
  sprint: UnifiedSprint
  selectionName: string
  sprintLabel: string
  products: Array<{ id: string; name: string }>
  isGroup: boolean
  items: PlanningItem[]
  uncheckedIds: ReadonlySet<number>
  manualIds: ReadonlySet<number>
  effort: { frontend: boolean; backend: boolean; qa: boolean }
}

/**
 * Prévia e cópia do resumo da sprint (RN-PLN-18, RN-PLN-19). A prévia é o mesmo
 * HTML que vai para a área de transferência: o PO valida exatamente o que cola.
 */
export function ShareSummaryModal({
  onClose,
  selectionId,
  sprint,
  selectionName,
  sprintLabel,
  products,
  isGroup,
  items,
  uncheckedIds,
  manualIds,
  effort
}: Props): React.JSX.Element {
  const { storyPoints } = useConfiguration()
  const organization = useLinkOrganization()
  const { config, productiveHours } = useCapacity()
  const [generatedAt] = useState(() => formatDateTime(new Date().toISOString()))
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [showUnchecked, setShowUnchecked] = useState(false)

  // O objetivo mora nos Dados de trabalho (RN-PLN-20). Enquanto o PO digita, vale o
  // rascunho local; o disco só recebe ao sair do campo ou aceitar um texto da IA.
  const storedGoal = useStoredValues<string>([planningKeys.goal(selectionId, sprint.key)])
  const [goalDraft, setGoalDraft] = useState<string | null>(null)
  const goal = goalDraft ?? storedGoal.values[0] ?? ''
  const checkedIds = items.filter((item) => !uncheckedIds.has(item.id)).map((item) => item.id)
  const uncheckedCount = items.length - checkedIds.length

  // Sem memo: metade das entradas é recriada a cada render da tela, e montar o resumo é barato.
  const summary = buildPlanningSummary({
    selectionName,
    sprintLabel,
    products,
    isGroup,
    items,
    uncheckedIds,
    manualIds,
    effort,
    organization,
    generatedAt,
    capacity: config,
    productiveHoursPerDay: productiveHours,
    storyPoints,
    goal,
    showUnchecked
  })
  const html = summaryToHtml(summary)

  async function copy(): Promise<void> {
    try {
      // As duas formas vão juntas: Loop e Teams colam a formatada; editor de texto, o Markdown.
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([summaryToMarkdown(summary)], { type: 'text/plain' })
        })
      ])
      setResult('copied')
    } catch {
      setResult('failed')
    }
  }

  const feedback = {
    idle: <Text type="secondary">{t('planning.summary.pasteHint')}</Text>,
    copied: <Text style={{ color: STATUS.ok.text }}>{t('planning.summary.copied')}</Text>,
    failed: <Text type="danger">{t('planning.summary.copyFailed')}</Text>
  }[result]

  return (
    <Modal
      open
      width={880}
      onCancel={onClose}
      title={
        <Flex align="center" gap={8}>
          {t('planning.summary.modalTitle')}
          <HelpTip rule="RN-PLN-18" />
        </Flex>
      }
      footer={
        <Flex align="center" justify="space-between" gap={12} wrap>
          {feedback}
          <Flex gap={8}>
            <Button onClick={onClose}>{t('planning.summary.close')}</Button>
            <Button type="primary" icon={<CopyOutlined />} onClick={copy}>
              {t('planning.summary.copy')}
            </Button>
          </Flex>
        </Flex>
      }
    >
      <SprintGoalField
        selectionId={selectionId}
        sprint={sprint}
        itemIds={checkedIds}
        value={goal}
        onChange={setGoalDraft}
        onCommit={(text) => storedGoal.save([text.trim() || null])}
      />
      <Flex align="center" gap={10} style={{ marginBottom: 12 }}>
        <Switch
          checked={showUnchecked && uncheckedCount > 0}
          disabled={uncheckedCount === 0}
          onChange={setShowUnchecked}
        />
        <Flex vertical>
          <Text>{t('planning.summary.showUnchecked', { count: uncheckedCount })}</Text>
          <Text type="secondary" style={{ fontSize: 12.5 }}>
            {t('planning.summary.showUncheckedHint')}
          </Text>
        </Flex>
      </Flex>
      <div className="planning-summary-preview" dangerouslySetInnerHTML={{ __html: html }} />
    </Modal>
  )
}
