import { execFileSync } from 'child_process'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { isAbsolute, relative, resolve } from 'path'
import { app } from 'electron'
import type { UnifiedSprint } from '@shared/azure'
import type { Configuration } from '@shared/config/schema'
import { AppError } from '@shared/errors'
import { getBugAnalysisData } from '../services/azure/bug-analysis'
import { getDailyData } from '../services/azure/daily'
import { getPlanningData } from '../services/azure/planning'
import { getSprintDeliveryData } from '../services/azure/sprint-delivery'
import { getTeamPerformanceData } from '../services/azure/team-performance'
import { requireActiveConfig } from '../services/azure/scope'
import { getUnifiedSprints } from '../services/azure/unified-sprints'

/**
 * Referência (golden master) dos dashboards: chama os serviços do main com o PAT
 * e os dados reais e grava cada resultado em JSON. A paridade compara uma captura
 * da versão nova com esta — por isso toda mudança de assinatura de serviço
 * precisa ser refletida aqui.
 */

const SPRINT_FETCH_LIMIT = 8
const CLOSED_SPRINTS = 3
/**
 * Janela de histórico ancorada na sprint alvo, e não em "hoje": assim a mesma
 * sprint recapturada semanas depois recebe a mesma lista. 8 buscadas = atual +
 * 3 alvo + 4 anteriores, o que garante 5 para a mais antiga das três.
 */
const HISTORY_WINDOW = 5

/**
 * Com `PO_SNAPSHOT_SPRINTS`, a captura busca todas as sprints até esta
 * quantidade e escolhe as do manifest pela chave — por mais antigas que estejam.
 */
const ALL_SPRINTS_LIMIT = 1000

interface Selections {
  /** Telas de Review: todos os Produtos e Grupos. */
  history: string[]
  /** Planning e Daily: só Produtos com sprint, e Grupos formados só por eles. */
  daily: string[]
}

function selectionsOf(config: Configuration): Selections {
  const sprintIds = new Set(config.products.filter((p) => p.cadence === 'sprints').map((p) => p.id))
  return {
    history: [...config.products.map((p) => p.id), ...config.groups.map((g) => g.id)],
    daily: [
      ...sprintIds,
      ...config.groups.filter((g) => g.products.every((id) => sprintIds.has(id))).map((g) => g.id)
    ]
  }
}

/**
 * Campos cujo valor depende do relógio no momento da captura, e não só da
 * sprint. A paridade os ignora; `[*]` percorre cada elemento de um array.
 */
const DATE_DEPENDENT_FIELDS: Record<string, string[]> = {
  // O dia corrente é "hoje" preso à janela da sprint; consumo e risco derivam dele.
  daily: ['currentDay', 'remainingDays', 'items[*].consumedDays', 'items[*].risk'],
  // A visão mensal cobre os 10 meses até o mês corrente; os ativos são o estado de agora.
  'bug-analysis': ['monthStats', 'activeBugsByState', 'activeBugsCount', 'activeBugItems'],
  // Visões mensais relativas ao mês corrente; períodos em aberto terminam em "agora".
  'team-performance': [
    'slaMonthStats',
    'reworkMonthSlots',
    'bugStateMonthSlots',
    'bugStateSprintSlots',
    'devFocusMonthSlots',
    'devFocusSprintSlots'
  ]
}

interface CallError {
  file: string
  code: string
  message: string
}

/** As sprints a capturar: as de Review e a de Planning/Daily. */
interface Targets {
  closed: UnifiedSprint[]
  latest: UnifiedSprint | undefined
}

interface Call {
  service: string
  filter: string
  sprintKey: string
  run: () => Promise<unknown>
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Sem acento e só com caracteres seguros: o nome vira parte do caminho do arquivo. */
function safeSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_.-]/g, '-')
}

/** Chaves ordenadas em todos os níveis, para o diff entre capturas mostrar só valor. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])])
    )
  }
  return value
}

/** Resolve o arquivo e recusa qualquer caminho que escape da pasta de saída. */
function insideOutDir(root: string, name: string): string {
  const file = resolve(root, name)
  const rel = relative(root, file)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`[snapshot] caminho fora da pasta de saída: ${name}`)
  }
  return file
}

async function writeJson(root: string, name: string, data: unknown): Promise<void> {
  const file = insideOutDir(root, name)
  await writeFile(file, JSON.stringify(sortKeys(data), null, 2) + '\n', 'utf8')
}

function gitSha(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: app.getAppPath(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return 'desconhecido'
  }
}

function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) return { code: error.code, message: error.message }
  return { code: 'UNEXPECTED', message: error instanceof Error ? error.message : String(error) }
}

function lastClosedSprints(sprints: UnifiedSprint[]): Targets {
  const today = todayKey()
  const closed = sprints.filter((s) => s.finishDate.slice(0, 10) < today).slice(0, CLOSED_SPRINTS)
  return { closed, latest: closed[0] }
}

interface ManifestFile {
  files?: unknown
  errors?: unknown
}

/** `serviço__seleção__sprint.json` → serviço e sprint. */
function parseFileName(name: string): { service: string; sprintKey: string } | null {
  // O nome do serviço nunca tem "__"; a seleção pode ter "_" (IDs aceitam).
  const match = /^(.+?)__.+__(\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2})\.json$/.exec(name)
  return match ? { service: match[1], sprintKey: match[2] } : null
}

/**
 * As sprints que uma captura anterior usou, lidas dos nomes dos arquivos do
 * manifest (os que deram certo e os que deram erro). Sem isso, a paridade quebra
 * assim que uma sprint nova fecha: "as 3 últimas encerradas" passam a ser outras.
 */
async function sprintsFromManifest(path: string, sprints: UnifiedSprint[]): Promise<Targets> {
  const manifest = JSON.parse(await readFile(path, 'utf8')) as ManifestFile
  const names = [
    ...(Array.isArray(manifest.files) ? manifest.files : []),
    ...(Array.isArray(manifest.errors)
      ? manifest.errors.map((e) => (e as { file?: unknown } | null)?.file)
      : [])
  ].filter((name): name is string => typeof name === 'string')

  const historyKeys = new Set<string>()
  const dailyKeys = new Set<string>()
  for (const name of names) {
    const parsed = parseFileName(name)
    if (!parsed) continue
    const keys = ['planning', 'daily'].includes(parsed.service) ? dailyKeys : historyKeys
    keys.add(parsed.sprintKey)
  }

  const byKey = new Map(sprints.map((s) => [s.key, s]))
  const missing = [...historyKeys, ...dailyKeys].filter((key) => !byKey.has(key))
  if (missing.length > 0) {
    throw new Error(`[snapshot] sprints do manifest que não existem mais: ${missing.join(', ')}`)
  }
  if (dailyKeys.size > 1) {
    throw new Error(`[snapshot] o manifest tem mais de uma sprint de Planning/Daily`)
  }

  // Mais recente primeiro, na ordem em que `getSprints` entrega.
  const closed = sprints.filter((s) => historyKeys.has(s.key))
  const [latestKey] = dailyKeys
  return { closed, latest: latestKey ? byKey.get(latestKey) : undefined }
}

/** A sprint e as anteriores a ela: mais recente primeiro, como a tela recebe de `getSprints`. */
function historyOf(sprints: UnifiedSprint[], sprint: UnifiedSprint): UnifiedSprint[] {
  const start = sprints.indexOf(sprint)
  return sprints.slice(start, start + HISTORY_WINDOW)
}

/** As sprints que alguma chamada usou, na ordem da lista. */
function usedSprints(sprints: UnifiedSprint[], { closed, latest }: Targets): UnifiedSprint[] {
  const used = new Set([
    ...closed.flatMap((s) => historyOf(sprints, s)),
    ...(latest ? [latest] : [])
  ])
  return sprints.filter((s) => used.has(s))
}

function buildCalls(
  sprints: UnifiedSprint[],
  { closed, latest }: Targets,
  selections: Selections
): Call[] {
  const calls: Call[] = []

  for (const sprint of closed) {
    const history = historyOf(sprints, sprint)

    for (const filter of selections.history) {
      calls.push(
        {
          service: 'sprint-delivery',
          filter,
          sprintKey: sprint.key,
          run: () => getSprintDeliveryData(filter, sprint)
        },
        {
          service: 'bug-analysis',
          filter,
          sprintKey: sprint.key,
          run: () => getBugAnalysisData(filter, history, sprint)
        },
        {
          service: 'team-performance',
          filter,
          sprintKey: sprint.key,
          run: () => getTeamPerformanceData(filter, history)
        }
      )
    }
  }

  if (latest) {
    for (const filter of selections.daily) {
      calls.push(
        {
          service: 'planning',
          filter,
          sprintKey: latest.key,
          run: () => getPlanningData(filter, latest)
        },
        { service: 'daily', filter, sprintKey: latest.key, run: () => getDailyData(filter, latest) }
      )
    }
  }

  return calls
}

export async function runSnapshot(outDir: string): Promise<{ root: string; files: string[] }> {
  // Ferramenta de desenvolvimento: o app instalado não pode gravar dados do Azure em disco.
  if (app.isPackaged) throw new Error('[snapshot] indisponível no app empacotado')

  const root = resolve(outDir)
  await mkdir(root, { recursive: true })

  const capturedAt = new Date().toISOString()
  const selections = selectionsOf(requireActiveConfig())
  const manifestPath = process.env.PO_SNAPSHOT_SPRINTS
  const sprints = await getUnifiedSprints(
    manifestPath ? ALL_SPRINTS_LIMIT : SPRINT_FETCH_LIMIT,
    false
  )
  const targets = manifestPath
    ? await sprintsFromManifest(resolve(manifestPath), sprints)
    : lastClosedSprints(sprints)
  const files: string[] = []
  const errors: CallError[] = []

  // Em sequência: o Azure limita requisições, e a ordem fica estável no log.
  for (const call of buildCalls(sprints, targets, selections)) {
    const file = `${call.service}__${safeSegment(call.filter)}__${safeSegment(call.sprintKey)}.json`
    try {
      await writeJson(root, file, await call.run())
      files.push(file)
    } catch (error) {
      errors.push({ file, ...describeError(error) })
    }
  }

  await writeJson(root, 'manifest.json', {
    capturedAt,
    gitSha: gitSha(),
    sprintsSource: manifestPath ? resolve(manifestPath) : 'ultimas-encerradas',
    selections,
    // Com o manifest, a lista vai até o começo do Azure: fica só o que foi usado.
    sprints: (manifestPath ? usedSprints(sprints, targets) : sprints).map((s) => ({
      key: s.key,
      startDate: s.startDate,
      finishDate: s.finishDate
    })),
    files,
    errors,
    dateDependentFields: DATE_DEPENDENT_FIELDS
  })

  return { root, files }
}
