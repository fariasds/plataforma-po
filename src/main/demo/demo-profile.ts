import { AppError } from '@shared/errors'
import { createFakeAzure, type FakeAzure } from './fake-azure'
import { SCENARIOS } from './scenarios'
import type { AzureState, Scenario } from './types'

/**
 * O que o Perfil de demonstração (RN-GLB-15) precisa dos Cenários: qual Cenário
 * usar, o deslocamento das datas (RN-GLB-16) e o Azure fictício já deslocado.
 *
 * Continua lógica pura, como o resto de `demo/`: quem grava a pasta do Perfil é o
 * `profile-store`, e quem decide desviar o pedido para cá é só o `client.ts`
 * (RN-SEC-27).
 */

/** O Cenário do Perfil de demonstração. Escolher outro pela tela está fora da v1. */
export const DEMO_SCENARIO_ID = 'vitrine'

export function demoScenario(id: string): Scenario {
  const scenario = SCENARIOS.find((s) => s.id === id)
  if (!scenario) {
    throw new AppError('PROFILE_INVALID', `O Cenário de demonstração "${id}" não existe.`)
  }
  return scenario
}

// ─── RN-GLB-16: datas que andam com o calendário ─────────────────────────────

const DAY_MS = 86_400_000
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})(?=T|$)/

/** Dias desde 01/01/1970 de uma data `AAAA-MM-DD`, sem fuso no meio. */
function dayNumber(ymd: string): number {
  const [year, month, day] = ymd.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

/** A segunda-feira da semana do dia. 01/01/1970 foi uma quinta. */
function mondayOf(day: number): number {
  const weekday = (day + 4) % 7 // 0 = domingo
  return day - ((weekday + 6) % 7)
}

function localYmd(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Quantas semanas inteiras levam a semana da data de referência até a semana de
 * `today`. Negativo quando hoje é antes da referência.
 */
export function shiftWeeks(anchorDate: string, today: Date): number {
  const from = mondayOf(dayNumber(anchorDate.slice(0, 10)))
  const to = mondayOf(dayNumber(localYmd(today)))
  return Math.round((to - from) / 7)
}

/**
 * Desloca a parte de data de um texto `AAAA-MM-DD…` e mantém o resto (hora,
 * `Z`) como está: o horário de cada mudança é o mesmo, com ou sem fuso. O
 * `9999-01-01` do Azure, "revisão ainda em vigor", não é data e não anda.
 */
export function shiftDate(value: string, days: number): string {
  const match = DATE_PREFIX.exec(value)
  if (!match || match[1] === '9999' || days === 0) return value
  const shifted = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3] + days))
  return shifted.toISOString().slice(0, 10) + value.slice(10)
}

function shiftDeep(value: unknown, days: number): unknown {
  if (typeof value === 'string') return shiftDate(value, days)
  if (Array.isArray(value)) return value.map((entry) => shiftDeep(entry, days))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, shiftDeep(entry, days)])
    )
  }
  return value
}

/**
 * Todo texto com forma de data no estado do Azure anda `weeks` semanas:
 * iterações, criação, histórico, prazo. Nome, caminho e título não começam por
 * `AAAA-MM-DD` e ficam como estão.
 */
export function shiftAzureState(state: AzureState, weeks: number): AzureState {
  return weeks === 0 ? state : (shiftDeep(state, weeks * 7) as AzureState)
}

// ─── O Azure fictício da demonstração ────────────────────────────────────────

let shifted: { key: string; state: AzureState } | null = null

/**
 * Azure fictício do Cenário, com as datas na semana de `now`. O estado deslocado
 * fica guardado até a semana virar; o Azure fictício é novo a cada pedido, para
 * as listas de chamadas e de erros não crescerem enquanto o app fica aberto.
 */
export function demoAzure(scenarioId: string, now: Date = new Date()): FakeAzure {
  const scenario = demoScenario(scenarioId)
  const weeks = shiftWeeks(scenario.anchorDate, now)
  const key = `${scenario.id}:${weeks}`
  if (shifted?.key !== key) {
    shifted = { key, state: shiftAzureState(scenario.azure, weeks) }
  }
  return createFakeAzure(shifted.state)
}
