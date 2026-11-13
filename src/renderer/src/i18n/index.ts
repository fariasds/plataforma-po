/**
 * Ponto único de idioma da interface: o `locale`, os textos e a formatação de
 * data e número saem daqui.
 *
 * O app só existe em PT-BR. Para traduzir: escreva um arquivo com a forma de
 * `Translation`, registre-o em `TRANSLATIONS` e troque `LOCALE`.
 */
import { ptBR } from './pt-BR'

export { default as antdLocale } from 'antd/locale/pt_BR'

export const LOCALE = 'pt-BR'

/** A forma do dicionário, com os textos soltos: é o que uma tradução precisa preencher. */
type Shape<T> = { readonly [K in keyof T]: T[K] extends string ? string : Shape<T[K]> }
export type Translation = Shape<typeof ptBR>

const TRANSLATIONS: Record<typeof LOCALE, Translation> = { 'pt-BR': ptBR }
const messages = TRANSLATIONS[LOCALE]

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>
}[keyof T & string]

/** Toda chave de texto, como caminho com pontos: `daily.timeline.fits`. */
export type MessageKey = Leaves<typeof ptBR>

/** Base de um plural: a chave sem o `.one` / `.other`. */
export type PluralKey = MessageKey extends infer K
  ? K extends `${infer Base}.other`
    ? Base
    : never
  : never

type MessageAt<T, K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Head extends keyof T
    ? MessageAt<T[Head], Rest>
    : never
  : K extends keyof T
    ? T[K]
    : never

type VarNames<S> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | VarNames<Rest> : never

/** As variáveis que o texto da chave pede; chave sem variável não aceita o argumento. */
export type VarArgs<K extends MessageKey, Value> = [VarNames<MessageAt<typeof ptBR, K>>] extends [
  never
]
  ? []
  : [vars: Record<VarNames<MessageAt<typeof ptBR, K>>, Value>]

/** O texto cru da chave, ainda com `{variáveis}` e marcações. */
export function template(key: string): string {
  let node: unknown = messages
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part]
  return node as string
}

function fill(text: string, vars: Record<string, string | number> | undefined): string {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  )
}

/** Texto da interface. Chave e variáveis são conferidas na compilação. */
export function t<K extends MessageKey>(key: K, ...args: VarArgs<K, string | number>): string {
  return fill(template(key), args[0])
}

/**
 * Singular ou plural conforme `count`, que entra no texto como `{count}`.
 *
 * A regra é a que a interface sempre usou — só 1 é singular — e não a de
 * `Intl.PluralRules`, que em português trata 0 como singular ("0 item").
 */
export function tPlural(
  key: PluralKey,
  count: number,
  vars?: Record<string, string | number>
): string {
  return fill(template(`${key}.${count === 1 ? 'one' : 'other'}`), { count, ...vars })
}

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
})
const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' })
const listFormat = new Intl.ListFormat(LOCALE, { style: 'long', type: 'conjunction' })
const collator = new Intl.Collator(LOCALE)

/** "02/10/2026 17:32", no fuso da máquina. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  return `${dateFormat.format(date)} ${timeFormat.format(date)}`
}

/** Número com as casas decimais pedidas, sem separador de milhar. */
export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: false
  }).format(value)
}

/** "8h" ou "7,5h": a casa decimal só aparece quando a hora não é cheia. */
export function formatHours(hours: number): string {
  return `${formatNumber(hours, hours % 1 === 0 ? 0 : 1)}h`
}

export function formatPercent(value: number): string {
  return `${formatNumber(value)}%`
}

/** "A, B e C". */
export function formatList(items: readonly string[]): string {
  return listFormat.format(items)
}

/** Ordem alfabética do idioma, para `sort`. */
export function compareText(a: string, b: string): number {
  return collator.compare(a, b)
}
