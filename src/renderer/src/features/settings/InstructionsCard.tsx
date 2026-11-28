import { useState } from 'react'
import { Button, Card, Flex, Modal, Tag, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { InstructionState } from '@shared/flow-prompts'
import { ErrorState } from '../../components/ErrorState'
import { t } from '../../i18n'
import { ipc } from '../../ipc/client'
import { MONO_FONT, NEUTRA } from '../../theme'

const { Paragraph, Text } = Typography

/**
 * As instruções do processo rule-first que a IA do PO recebe pelos prompts do
 * servidor MCP (ADR 0014, RN-FLX-26). A IA propõe um texto novo; o PO lê, aplica ou
 * descarta, e pode voltar ao de fábrica.
 */
export function InstructionsCard(): React.JSX.Element {
  const queryClient = useQueryClient()
  const [reading, setReading] = useState<{ title: string; text: string } | null>(null)
  const instructions = useQuery({
    queryKey: ['instructions'],
    queryFn: () => ipc.getInstructions()
  })
  const change = useMutation({
    mutationFn: ({ action, name }: { action: 'apply' | 'discard' | 'reset'; name: string }) =>
      action === 'apply'
        ? ipc.applyInstructionProposal(name)
        : action === 'discard'
          ? ipc.discardInstructionProposal(name)
          : ipc.resetInstruction(name),
    onSuccess: (data) => queryClient.setQueryData(['instructions'], data)
  })

  const row = (item: InstructionState): React.JSX.Element => (
    <Flex
      key={item.name}
      vertical
      gap={6}
      style={{ padding: '10px 12px', border: `1px solid ${NEUTRA[200]}`, borderRadius: 10 }}
    >
      <Flex align="center" justify="space-between" gap={8} wrap>
        <Flex align="center" gap={8}>
          <Text strong>{item.title}</Text>
          <Text type="secondary" style={{ fontSize: 12, fontFamily: MONO_FONT }}>
            {item.name}
          </Text>
        </Flex>
        <Tag style={{ marginInlineEnd: 0 }}>
          {item.overridden ? t('instructions.own') : t('instructions.default')}
        </Tag>
      </Flex>
      <Flex gap={8} wrap>
        <Button size="small" onClick={() => setReading({ title: item.title, text: item.current })}>
          {t('instructions.read')}
        </Button>
        {item.overridden && (
          <Button
            size="small"
            loading={change.isPending}
            onClick={() => change.mutate({ action: 'reset', name: item.name })}
          >
            {t('instructions.reset')}
          </Button>
        )}
      </Flex>
      {item.proposal !== null && (
        <Flex
          vertical
          gap={6}
          style={{ padding: '8px 10px', background: NEUTRA[75], borderRadius: 8 }}
        >
          <Text style={{ fontSize: 13 }}>{t('instructions.proposal')}</Text>
          <Flex gap={8} wrap>
            <Button
              size="small"
              onClick={() =>
                setReading({
                  title: t('instructions.proposalOf', { title: item.title }),
                  text: item.proposal!
                })
              }
            >
              {t('instructions.read')}
            </Button>
            <Button
              size="small"
              type="primary"
              loading={change.isPending}
              onClick={() => change.mutate({ action: 'apply', name: item.name })}
            >
              {t('instructions.apply')}
            </Button>
            <Button
              size="small"
              loading={change.isPending}
              onClick={() => change.mutate({ action: 'discard', name: item.name })}
            >
              {t('instructions.discard')}
            </Button>
          </Flex>
        </Flex>
      )}
    </Flex>
  )

  return (
    <Card title={t('instructions.title')}>
      <Flex vertical gap={10}>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t('instructions.intro')}
        </Paragraph>
        {instructions.isError && <ErrorState error={instructions.error} />}
        {change.isError && <ErrorState error={change.error} />}
        {(instructions.data ?? []).map(row)}
      </Flex>
      <Modal
        open={reading !== null}
        title={reading?.title}
        footer={null}
        onCancel={() => setReading(null)}
        width={760}
      >
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            fontFamily: MONO_FONT,
            fontSize: 12,
            maxHeight: 520,
            overflow: 'auto',
            margin: 0
          }}
        >
          {reading?.text}
        </pre>
      </Modal>
    </Card>
  )
}
