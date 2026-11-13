import { useState } from 'react'
import { Alert, Button, Flex, InputNumber, Select, Space, Typography } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { ManualPlanningItem } from '@shared/dashboards'
import { formatPercent, t } from '../../i18n'
import { ipc } from '../../ipc/client'

const { Text } = Typography

type Percent = 0 | 25 | 50 | 75 | 100

const PERCENT_OPTIONS: Percent[] = [0, 25, 50, 75, 100]

function applyPercent(value: number | null, percent: number): number | null {
  return value !== null ? Math.round(value * (percent / 100)) : null
}

function computeTotal(
  frontend: number | null,
  backend: number | null,
  qa: number | null
): number | null {
  if (frontend === null && backend === null && qa === null) return null
  return (frontend ?? 0) + (backend ?? 0) + (qa ?? 0)
}

/** Quais campos de esforço a Configuração tem; o que falta não é perguntado. */
export interface EffortAvailability {
  frontend: boolean
  backend: boolean
  qa: boolean
}

interface Props {
  existingIds: number[]
  /** Produtos da seleção: o item precisa ser de um deles para ser guardado. */
  products: Array<{ id: string; name: string }>
  effort: EffortAvailability
  onAdd: (item: ManualPlanningItem) => void
}

/**
 * Pulls a leftover item from a previous sprint into the plan, applying the share
 * of frontend/backend effort still remaining. QA always comes in whole.
 */
export function AddManualItemForm({
  existingIds,
  products,
  effort,
  onAdd
}: Props): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState<number | null>(null)
  const [frontendPct, setFrontendPct] = useState<Percent>(50)
  const [backendPct, setBackendPct] = useState<Percent>(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset(): void {
    setItemId(null)
    setFrontendPct(50)
    setBackendPct(50)
    setError(null)
  }

  async function handleSubmit(): Promise<void> {
    if (itemId === null || itemId <= 0) {
      setError(t('planning.invalidId'))
      return
    }
    if (existingIds.includes(itemId)) {
      setError(t('planning.alreadyListed'))
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await ipc.getPlanningItem(itemId)
      if (!products.some((p) => p.id === data.product)) {
        setError(
          t('planning.outOfSelection', {
            id: data.id,
            products: products.map((p) => p.name).join(', ')
          })
        )
        return
      }
      const frontend = applyPercent(data.frontend, frontendPct)
      const backend = applyPercent(data.backend, backendPct)
      const qa = data.qa // always 100%

      onAdd({
        id: data.id,
        title: data.title,
        state: data.state,
        product: data.product,
        frontend,
        backend,
        qa,
        priority: data.priority,
        total: computeTotal(frontend, backend, qa),
        frontendPercent: frontendPct,
        backendPercent: backendPct
      })

      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('planning.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button type="link" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
        {t('planning.addLeftover')}
      </Button>
    )
  }

  return (
    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
      <Flex align="center" gap={8} wrap>
        <InputNumber
          autoFocus
          min={1}
          placeholder={t('planning.itemIdPlaceholder')}
          value={itemId}
          onChange={setItemId}
          onPressEnter={handleSubmit}
          style={{ width: 140 }}
        />

        {effort.frontend && (
          <Flex align="center" gap={6}>
            <Text type="secondary">{t('disciplines.front')}</Text>
            <Select<Percent>
              value={frontendPct}
              onChange={setFrontendPct}
              style={{ width: 90 }}
              options={PERCENT_OPTIONS.map((p) => ({ value: p, label: formatPercent(p) }))}
            />
          </Flex>
        )}

        {effort.backend && (
          <Flex align="center" gap={6}>
            <Text type="secondary">{t('disciplines.back')}</Text>
            <Select<Percent>
              value={backendPct}
              onChange={setBackendPct}
              style={{ width: 90 }}
              options={PERCENT_OPTIONS.map((p) => ({ value: p, label: formatPercent(p) }))}
            />
          </Flex>
        )}

        {effort.qa && (
          <Flex align="center" gap={6}>
            <Text type="secondary">{t('disciplines.qa')}</Text>
            <Text>{formatPercent(100)}</Text>
          </Flex>
        )}

        <Button type="primary" loading={loading} onClick={handleSubmit}>
          {t('actions.add')}
        </Button>
        <Button
          onClick={() => {
            reset()
            setOpen(false)
          }}
        >
          {t('actions.cancel')}
        </Button>
      </Flex>

      {error && <Alert type="error" showIcon title={error} />}
    </Space>
  )
}
