import { useState } from 'react'
import type { SelectionOption } from '../ipc/useAzure'
import { t } from '../i18n'
import { NEUTRA, productColors } from '../theme'

/** Cor de Grupo é opcional na Configuração; sem ela, um cinza neutro. */
const GROUP_FALLBACK_COLOR = NEUTRA[600]

interface Props {
  options: SelectionOption[]
  value: string
  onChange: (value: string) => void
}

/**
 * Product switch: a segmented track where every option carries its product's
 * colour as a dot, and the active one turns into a white pill. The dot keeps the
 * colour the team already reads at a glance without painting the whole button —
 * a full colour fill fought with the accent and with work item colours.
 * Ant Design's `Segmented` paints every item the same, so this is hand-rolled.
 */
export function ProductFilter({ options, value, onChange }: Props): React.JSX.Element {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div
      role="group"
      aria-label={t('common.product')}
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        gap: 2,
        padding: 3,
        borderRadius: 12,
        background: NEUTRA[100]
      }}
    >
      {options.map((option) => {
        const color = option.color ?? GROUP_FALLBACK_COLOR
        const isActive = option.id === value
        const isHovered = hovered === option.id

        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.id)}
            onMouseEnter={() => setHovered(option.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              font: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              height: 34,
              padding: '0 14px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              borderRadius: 9,
              border: 0,
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              background: isActive
                ? '#FFFFFF'
                : isHovered
                  ? productColors(color).hoverBg
                  : 'transparent',
              color: isActive ? NEUTRA[800] : NEUTRA[600],
              boxShadow: isActive ? '0 1px 2px rgba(16, 24, 40, 0.12)' : 'none'
            }}
          >
            <span
              aria-hidden="true"
              style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' }}
            />
            {option.name}
          </button>
        )
      })}
    </div>
  )
}
