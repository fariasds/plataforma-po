import { Flex, Select, Tag } from 'antd'
import { sprintIteration, type UnifiedSprint } from '@shared/azure'
import { useConfiguration } from '../ipc/useAzure'
import { useIsDemo } from '../ipc/useProfile'
import { MONO_FONT, productColors } from '../theme'
import type { Selection } from '../ipc/useAzure'
import { HelpTip } from './HelpTip'
import { ProductFilter } from './ProductFilter'

interface Props {
  /** Vinda de `useSelection('review')` na tela. */
  selection: Selection
  sprints?: UnifiedSprint[]
  selectedSprintKey?: string
  onSprintChange?: (key: string) => void
}

export function DashboardFilters({
  selection,
  sprints,
  selectedSprintKey,
  onSprintChange
}: Props): React.JSX.Element {
  const config = useConfiguration()
  const selectedSprint = sprints?.find((s) => s.key === selectedSprintKey)
  const isDemo = useIsDemo()

  return (
    <Flex align="center" gap={12} wrap>
      <ProductFilter
        options={selection.options}
        value={selection.value}
        onChange={selection.onChange}
      />

      {sprints && onSprintChange && (
        <Select
          style={{ minWidth: 240 }}
          value={selectedSprintKey}
          onChange={onSprintChange}
          options={sprints.map((sprint) => ({ value: sprint.key, label: sprint.label }))}
        />
      )}

      {/* Na demonstração as datas andam com o calendário e não batem com as do Cenário. */}
      {sprints && isDemo && <HelpTip rule="RN-GLB-16" />}

      {/* Each product numbers its sprints its own way, so every name is shown
          side by side instead of buried in the option label. */}
      {selectedSprint &&
        config.products.map((product) => {
          const iteration = sprintIteration(selectedSprint, product.id)
          if (!iteration) return null
          const colors = productColors(product.color)
          return (
            <Tag
              key={product.id}
              style={{
                fontFamily: MONO_FONT,
                fontWeight: 500,
                marginInlineEnd: 0,
                background: colors.softBg,
                color: colors.softText,
                borderColor: colors.softBorder
              }}
            >
              {iteration.name}
            </Tag>
          )
        })}
    </Flex>
  )
}
