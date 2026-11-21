import { z } from 'zod'
import { isNewerVersion, parseVersion } from './update'
import data from './release-notes.json'

/**
 * Novidades da versão (`RN-HOM-04`, `RN-HOM-05`). O conteúdo mora em
 * `release-notes.json`, escrito à mão no PR que sobe a versão, em linguagem de
 * quem usa o app — os títulos de PR não servem para isso. O arquivo vai dentro do
 * app: funciona sem rede, na demonstração, e não abre link nenhum (`RN-SEC-21`).
 *
 * A mesma lista monta a seção "Novidades" da Release no GitHub
 * (`scripts/release-notes.mjs`).
 */

export const RELEASE_NOTE_TYPES = ['new', 'improvement', 'fix'] as const
export type ReleaseNoteType = (typeof RELEASE_NOTE_TYPES)[number]

/**
 * Telas para onde uma novidade pode levar. É uma chave, nunca um endereço: o
 * renderer traduz para a rota, e o arquivo não tem como apontar para fora do app.
 */
export const RELEASE_NOTE_SCREENS = [
  'home',
  'planning',
  'daily',
  'sprint-delivery',
  'bug-analysis',
  'settings',
  'connect-ai',
  'security'
] as const
export type ReleaseNoteScreen = (typeof RELEASE_NOTE_SCREENS)[number]

const text = z.string().trim().min(1)

const itemSchema = z
  .object({
    type: z.enum(RELEASE_NOTE_TYPES),
    title: text.max(80),
    /** Uma linha: é o que aparece no bloco da Home e no histórico. */
    text: text.max(240),
    /** O destaque da versão abre o modal (`RN-HOM-04`). Um por versão, no máximo. */
    highlight: z.boolean().optional(),
    /** Parágrafo mais longo, só do destaque, para o modal. */
    details: text.max(480).optional(),
    screen: z.enum(RELEASE_NOTE_SCREENS).optional()
  })
  .strict()

const entrySchema = z
  .object({
    version: z.string().refine((v) => parseVersion(v) !== null, 'versão no formato 1.2.3'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data no formato AAAA-MM-DD'),
    items: z.array(itemSchema).min(1)
  })
  .strict()
  .refine((entry) => entry.items.filter((item) => item.highlight).length <= 1, {
    message: 'no máximo um destaque por versão'
  })
  .refine((entry) => entry.items.every((item) => !item.details || item.highlight), {
    message: '"details" só no destaque'
  })

export const releaseNotesSchema = z
  .array(entrySchema)
  .refine(
    (list) =>
      list.every((entry, i) => i === 0 || isNewerVersion(list[i - 1].version, entry.version)),
    { message: 'versões da mais nova para a mais antiga, sem repetir' }
  )

export type ReleaseNoteItem = z.infer<typeof itemSchema>
export type ReleaseEntry = z.infer<typeof entrySchema>

/**
 * A lista embarcada. O teste garante que o arquivo é válido; se mesmo assim não
 * for, a Home segue sem novidades em vez de quebrar.
 */
export const RELEASE_NOTES: readonly ReleaseEntry[] = (() => {
  const parsed = releaseNotesSchema.safeParse(data)
  return parsed.success ? parsed.data : []
})()

export function releaseEntry(
  notes: readonly ReleaseEntry[],
  version: string
): ReleaseEntry | undefined {
  return notes.find((entry) => entry.version === version)
}

export function highlightOf(entry: ReleaseEntry): ReleaseNoteItem | undefined {
  return entry.items.find((item) => item.highlight)
}

// ─── Quando o modal abre (RN-HOM-04) ─────────────────────────────────────────

export interface SeenMemory {
  /** A última versão cujas novidades o PO viu nesta máquina. */
  lastSeen?: string
  /**
   * O app já era usado nesta máquina antes de existir a memória de versão vista:
   * há primeiros passos guardados. Separa quem atualizou de quem acabou de instalar.
   */
  usedBefore: boolean
}

export type ReleaseModalDecision =
  /** Abre com estas versões, da mais nova para a mais antiga. */
  | { open: true; entries: ReleaseEntry[] }
  /** Não abre. `markSeen`: grava a instalada como vista mesmo assim. */
  | { open: false; markSeen: boolean }

/**
 * O modal de novidades abre uma vez por versão (`RN-HOM-04`):
 *
 * - **Instalação nova** (nada guardado): não abre — tudo é novidade, e a Home de
 *   primeiro acesso já ensina o caminho. A instalada passa a ser a vista.
 * - **Quem atualizou** de uma versão anterior à memória de versão vista: só a
 *   instalada conta como nova.
 * - **Quem pulou versões:** todas desde a última vista, até a instalada.
 * - Abre só se alguma dessas versões tem destaque. Versão só de bastidor aparece
 *   no histórico, mas não interrompe o PO.
 */
export function releaseModalDecision(
  notes: readonly ReleaseEntry[],
  installed: string,
  memory: SeenMemory
): ReleaseModalDecision {
  if (memory.lastSeen === installed) return { open: false, markSeen: false }
  if (memory.lastSeen === undefined && !memory.usedBefore) return { open: false, markSeen: true }

  const since = memory.lastSeen
  const entries = notes.filter(
    (entry) =>
      !isNewerVersion(entry.version, installed) &&
      (since === undefined ? entry.version === installed : isNewerVersion(entry.version, since))
  )
  if (!entries.some((entry) => highlightOf(entry))) return { open: false, markSeen: true }
  return { open: true, entries }
}

// ─── Histórico (RN-HOM-05) ───────────────────────────────────────────────────

/** Sem acento e sem caixa: "capacidade" acha "Capacidade", "squad" acha "Squads". */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Filtra o histórico pelo texto e pelo tipo. O texto procura no título e na
 * explicação de cada item, e no número da versão ("1.2" acha a 1.2.0 e a 1.2.1).
 * Versão que fica sem item some.
 */
export function searchReleaseNotes(
  notes: readonly ReleaseEntry[],
  query: string,
  type: ReleaseNoteType | 'all'
): ReleaseEntry[] {
  const q = normalizeSearch(query)
  const versionQuery = /^v?(\d[\d.]*)$/.exec(q)?.[1]
  return notes
    .map((entry) => {
      const versionMatches = versionQuery !== undefined && entry.version.startsWith(versionQuery)
      const items = entry.items.filter(
        (item) =>
          (type === 'all' || item.type === type) &&
          (q === '' ||
            versionMatches ||
            normalizeSearch(`${item.title} ${item.text} ${item.details ?? ''}`).includes(q))
      )
      return { ...entry, items }
    })
    .filter((entry) => entry.items.length > 0)
}
