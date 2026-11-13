import { Typography } from 'antd'
import type { DailyItem } from '@shared/dashboards'
import { formatNumber, t, tPlural } from '../../i18n'
import { NEUTRA } from '../../theme'
import { HOLIDAY, TODAY_MARKER, useRiskColors } from './constants'

const { Text } = Typography

interface Props {
  item: DailyItem
  sprintDays: number
  currentDay: number
  /** Dia em que a régua marca a virada de semana. */
  weekBreakDay: number
  /** Casas da régua que caem em feriado. */
  holidayDays: number[]
}

/**
 * Até onde a barra pode terminar para o rótulo ainda caber ao lado dela. Passando
 * disso o texto vai para baixo da barra — antes, ele era empurrado para fora da
 * área visível e aparecia cortado.
 */
const LABEL_BESIDE_LIMIT = 62

/** Altura da faixa, com espaço reservado para o rótulo que desce. */
const TRACK_HEIGHT = 50

/** Converte um dia da sprint em posição percentual na faixa. */
function pct(day: number, sprintDays: number): number {
  return ((day - 1) / sprintDays) * 100
}

/**
 * Uma barra na linha do tempo da sprint.
 *
 * Iniciados começam no dia real em que entraram em desenvolvimento; não
 * iniciados são desenhados a partir de hoje, como projeção — é isso que faz o
 * item que já não cabe aparecer furando a borda direita.
 */
export function TimelineBar({
  item,
  sprintDays,
  currentDay,
  weekBreakDay,
  holidayDays
}: Props): React.JSX.Element {
  const riskColors = useRiskColors()
  const colors = riskColors[item.risk]

  const startDay = item.status === 'not-started' ? currentDay : (item.startDay ?? currentDay)
  const left = pct(startDay, sprintDays)

  /*
    O comprimento vem do **span de calendário** — de onde começou até onde a
    projeção termina — e não da estimativa em dias de trabalho. A diferença
    aparece quando o item atravessa um feriado: são os mesmos dias de trabalho,
    mas ocupando uma casa a mais na régua.

    Sem estimativa, a barra mostra apenas o que já foi consumido.
  */
  const estimateWidth =
    item.estimateDays === null
      ? (item.consumedDays ?? 0)
      : item.projectedEndDay !== null
        ? Math.max(item.projectedEndDay - startDay + 1, 0.4)
        : Math.max(item.estimateDays, 0.4)
  const width = Math.min((estimateWidth / sprintDays) * 100, 100 - left)

  const consumedRatio =
    item.consumedDays === null || item.estimateDays === null
      ? item.consumedDays === null
        ? 0
        : 1
      : Math.min(item.consumedDays / item.estimateDays, 1)

  // Excedente: o que passou da estimativa, desenhado além dela.
  const overDays =
    item.consumedDays !== null && item.estimateDays !== null
      ? Math.max(item.consumedDays - item.estimateDays, 0)
      : 0
  const overWidth = (overDays / sprintDays) * 100

  const overflowsSprint = item.projectedEndDay !== null && item.projectedEndDay > sprintDays
  const barEnd = Math.min(left + width + overWidth, 100)
  const fitsBeside = barEnd <= LABEL_BESIDE_LIMIT

  return (
    <div style={{ position: 'relative', height: TRACK_HEIGHT }}>
      {/* Grade de dias */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${sprintDays}, 1fr)`
        }}
      >
        {Array.from({ length: sprintDays }, (_, i) => (
          <span
            key={i}
            style={{
              // Hachura, e não preenchimento: a coluna morta precisa se ler por
              // trás da barra sem competir com a cor de risco dela.
              background: holidayDays.includes(i + 1) ? HOLIDAY.stripe : undefined,
              borderLeft:
                i === 0
                  ? 'none'
                  : i === weekBreakDay
                    ? `2px solid ${NEUTRA[300]}`
                    : `1px dashed ${NEUTRA[200]}`
            }}
          />
        ))}
      </div>

      {/* Marca do dia de hoje */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${pct(currentDay, sprintDays)}%`,
          width: 2,
          background: TODAY_MARKER,
          opacity: 0.55,
          zIndex: 3
        }}
      />

      {/* Barra */}
      <div
        style={{
          position: 'absolute',
          top: 13,
          left: `${left}%`,
          width: `${width}%`,
          height: 18,
          // Ponta reta quando a projeção fura a sprint: canto arredondado lê como
          // "terminou aqui", que é exatamente a leitura errada.
          borderRadius: overflowsSprint ? '5px 0 0 5px' : 5,
          display: 'flex',
          overflow: 'hidden',
          zIndex: 2
        }}
      >
        <div style={{ width: `${consumedRatio * 100}%`, background: colors.consumed }} />
        <div style={{ width: `${(1 - consumedRatio) * 100}%`, background: colors.remaining }} />
      </div>

      {/* Excedente além da estimativa */}
      {overWidth > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 13,
            left: `${left + width}%`,
            width: `${Math.min(overWidth, 100 - left - width)}%`,
            height: 18,
            borderRadius: '0 5px 5px 0',
            background: riskColors['over-estimate'].consumed,
            zIndex: 2
          }}
        />
      )}

      {/*
        Seta escapando pela direita: a barra é cortada na borda da sprint, e sem
        um sinal de continuação um item que estoura fica idêntico a um que fecha
        no último dia. A ponta ocupa o respiro reservado à direita da faixa.
      */}
      {overflowsSprint && (
        <div
          style={{
            position: 'absolute',
            top: 13,
            right: -11,
            width: 0,
            height: 0,
            borderTop: '9px solid transparent',
            borderBottom: '9px solid transparent',
            borderLeft: `11px solid ${colors.consumed}`,
            zIndex: 4
          }}
        />
      )}

      {/*
        Rótulo à direita da barra quando cabe; abaixo dela quando não cabe.
        Sempre sobre o fundo branco da linha, na cor do risco — assim não é
        preciso calcular contraste contra barras de cores diferentes.
      */}
      <Text
        style={
          fitsBeside
            ? {
                position: 'absolute',
                top: 15,
                left: `calc(${barEnd}% + 8px)`,
                fontSize: 10.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                color: colors.label,
                zIndex: 3
              }
            : {
                position: 'absolute',
                bottom: 1,
                right: 0,
                fontSize: 10.5,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                color: colors.label,
                zIndex: 3
              }
        }
      >
        {describe(item, sprintDays)}
      </Text>
    </div>
  )
}

function describe(item: DailyItem, sprintDays: number): string {
  if (item.estimateDays === null) {
    return item.consumedDays === null
      ? t('daily.noEstimate')
      : t('daily.timeline.consumedNoEstimate', { days: item.consumedDays })
  }

  // "em 1 dia" / "em 4 dias" — o singular importa: a frase é lida toda hora.
  const overflowDays = item.projectedEndDay !== null ? item.projectedEndDay - sprintDays : null

  if (item.status === 'not-started') {
    switch (item.risk) {
      case 'over-sprint':
      case 'awaiting-test':
        return overflowDays !== null
          ? tPlural('daily.timeline.notFitOverflow', overflowDays)
          : t('daily.timeline.notFitNeeds', { days: item.estimateDays })
      case 'at-limit':
        return t('daily.timeline.onlyIfToday')
      default:
        return t('daily.timeline.fits', { days: item.estimateDays })
    }
  }

  const consumed = String(item.consumedDays)
  const diff = (item.consumedDays ?? 0) - item.estimateDays
  const overEstimate = t('daily.timeline.overEstimate', {
    days: consumed,
    diff: formatNumber(diff, 1)
  })

  if (item.status === 'done') {
    return diff > 0 ? overEstimate : t('daily.timeline.withinEstimate', { days: consumed })
  }

  switch (item.risk) {
    case 'over-estimate':
      return overEstimate
    case 'over-sprint':
    case 'awaiting-test':
      return overflowDays !== null
        ? tPlural('daily.timeline.overflow', overflowDays)
        : t('daily.timeline.notThisSprint')
    case 'at-limit':
      return t('daily.timeline.closesLastDay')
    default:
      return t('daily.timeline.progress', { consumed, estimate: item.estimateDays })
  }
}
