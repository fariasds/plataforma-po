// ─── Story Points → Horas ────────────────────────────────────────────────────

/**
 * Tabela de conversão como está na Configuração (`storyPoints`): a chave é a
 * quantidade de pontos, em texto, e o valor são as horas.
 */
export type StoryPointsTable = Record<string, number>

interface Anchor {
  sp: number
  hours: number
}

// A mesma tabela é consultada a cada item da tela; ordenar uma vez só basta.
const anchorCache = new WeakMap<StoryPointsTable, Anchor[]>()

function anchorsOf(table: StoryPointsTable): Anchor[] {
  let anchors = anchorCache.get(table)
  if (!anchors) {
    anchors = Object.entries(table)
      .map(([sp, hours]) => ({ sp: Number(sp), hours }))
      .sort((a, b) => a.sp - b.sp)
    anchorCache.set(table, anchors)
  }
  return anchors
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * Converte pontos de complexidade em horas (RN-GLB-12, RN-GLB-13).
 *
 * Ponto que está na tabela vem direto dela. Fora dela — fracionário, entre duas
 * entradas ou acima da maior —, interpola entre as âncoras vizinhas ou extrapola
 * pela inclinação do último trecho, em vez de cair para zero: o rateio de itens
 * remanescentes gera pontos fora da escala (8 pontos a 50% = 4).
 */
export function spToHours(
  sp: number | null | undefined,
  table: StoryPointsTable
): number {
  if (!sp || sp <= 0) return 0

  const anchors = anchorsOf(table)
  const exact = anchors.find((a) => a.sp === sp)
  if (exact) return exact.hours

  const first = anchors[0]
  if (sp < first.sp) return round1(sp * (first.hours / first.sp))

  for (let i = 0; i < anchors.length - 1; i++) {
    const lower = anchors[i]
    const upper = anchors[i + 1]
    if (sp > lower.sp && sp < upper.sp) {
      const ratio = (sp - lower.sp) / (upper.sp - lower.sp)
      return round1(lower.hours + ratio * (upper.hours - lower.hours))
    }
  }

  // O schema exige ao menos duas entradas (RN-CFG-01), então há um último trecho.
  const last = anchors[anchors.length - 1]
  const prev = anchors[anchors.length - 2]
  const slope = (last.hours - prev.hours) / (last.sp - prev.sp)
  return round1(last.hours + (sp - last.sp) * slope)
}
