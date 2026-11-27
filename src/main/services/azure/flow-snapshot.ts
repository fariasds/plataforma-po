import { htmlToText, plain } from '@shared/ai'
import type { WiqlResponse } from '@shared/azure'
import type { Product } from '@shared/config/schema'
import { AppError } from '@shared/errors'
import {
  SNAPSHOT_TITLE_CHARS,
  flowKeys,
  linkedFeatureIds,
  relationTargetId,
  snapshotDescriptionBudget,
  summarizeSnapshot,
  windowStartDate,
  type FlowSnapshot,
  type FlowSnapshotSummary,
  type SnapshotBug,
  type SnapshotFeature,
  type SnapshotFeedback,
  type SnapshotItem
} from '@shared/flow-snapshot'
import { requireActiveProfile } from '../../profile/profile-store'
import { writeWorkData } from '../../profile/work-data'
import { redact } from '../../security/redact'
import { buildScopeClauses } from './bug-analysis'
import { fetchAzure, postAzure } from './client'
import { fetchDescriptions } from './descriptions'
import { activeProduct, requireActiveConfig, type ResolvedProduct } from './scope'

/**
 * O retrato do Azure para o fluxo do PO (RN-FLX-01, ADR 0011): as Features do
 * Produto, os filhos delas, os feedbacks e os bugs, gravados nos Dados de
 * trabalho com a data em que foram lidos. O servidor MCP lê esse arquivo; ele não
 * fala com o Azure (RN-SEC-34).
 *
 * Tudo aqui é leitura: um WIQL por coleção e leituras em lote (RN-SEC-20).
 */

interface RawItem {
  id: number
  fields: Record<string, unknown>
  relations?: Array<{ rel?: unknown; url?: unknown }>
}

/** O Azure aceita até 200 IDs por leitura em lote. */
const CHUNK = 200

const ITEM_FIELDS = [
  'System.Id',
  'System.Title',
  'System.State',
  'System.WorkItemType',
  'System.Parent'
]
const BUG_FIELDS = [...ITEM_FIELDS, 'System.CreatedDate', 'Microsoft.VSTS.Common.ClosedDate']

const CHILD_LINK = 'System.LinkTypes.Hierarchy-Forward'
const RELATED_LINK = 'System.LinkTypes.Related'

/** Literal de texto do WIQL: o valor vem da Configuração, que a IA do PO edita. */
function wiqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function wiqlList(values: readonly string[]): string {
  return values.map(wiqlText).join(', ')
}

function chunks<T>(all: readonly T[]): T[][] {
  const result: T[][] = []
  for (let i = 0; i < all.length; i += CHUNK) result.push(all.slice(i, i + CHUNK))
  return result
}

async function queryIds(project: string, where: string): Promise<number[]> {
  const query = `SELECT [System.Id] FROM WorkItems WHERE ${where} ORDER BY [System.Id] ASC`
  const { workItems } = await postAzure<WiqlResponse>(
    `/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`,
    { query }
  )
  return workItems.map((w) => w.id)
}

/** Leitura em lote. Com `fields = null`, vêm todos os campos e os vínculos. */
async function readItems(
  ids: readonly number[],
  fields: readonly string[] | null,
  project: string | null
): Promise<RawItem[]> {
  const base = project ? `/${encodeURIComponent(project)}` : ''
  const select = fields
    ? `fields=${fields.join(',')}&errorPolicy=omit`
    : '$expand=relations&errorPolicy=omit'
  const pages = await Promise.all(
    chunks(ids).map((chunk) =>
      fetchAzure<{ value: Array<RawItem | null> }>(
        `${base}/_apis/wit/workitems?ids=${chunk.join(',')}&${select}&api-version=7.1`
      )
    )
  )
  // Com `errorPolicy=omit`, item apagado ou sem acesso vem como `null`.
  return pages.flatMap((page) => page.value.filter((item): item is RawItem => item !== null))
}

function text(fields: Record<string, unknown>, ref: string): string {
  const value = fields[ref]
  return typeof value === 'string' ? value : ''
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function dateOrNull(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/** Título que pode ir para a IA: redigido como os logs (RN-SEC-19) e numa linha só. */
function safeTitle(raw: unknown): string {
  return plain(redact(String(raw ?? '')), SNAPSHOT_TITLE_CHARS)
}

/** Descrição em texto puro, redigida depois da conversão do HTML (RN-SEC-24). */
function safeDescription(html: unknown, budget: number): string {
  return redact(htmlToText(html, budget))
}

function toItem(raw: RawItem): SnapshotItem {
  return {
    id: raw.id,
    type: text(raw.fields, 'System.WorkItemType'),
    title: safeTitle(raw.fields['System.Title']),
    state: plain(text(raw.fields, 'System.State'), 60),
    parentId: numberOrNull(raw.fields['System.Parent'])
  }
}

function linked(raw: RawItem, rel: string): number[] {
  return (raw.relations ?? [])
    .filter((relation) => relation.rel === rel)
    .flatMap((relation) => relationTargetId(relation.url) ?? [])
}

/** "Abertos ou fechados na janela", e nunca os removidos (RN-FLX-01). */
function liveOrRecent(product: ResolvedProduct, windowStart: string): string {
  const { terminalStates, removedStates } = product.processProfile
  const clauses = [
    `([System.State] NOT IN (${wiqlList(terminalStates)}) OR [Microsoft.VSTS.Common.StateChangeDate] >= ${wiqlText(windowStart)})`
  ]
  if (removedStates.length > 0) {
    clauses.push(`[System.State] NOT IN (${wiqlList(removedStates)})`)
  }
  return clauses.map((c) => `AND ${c}`).join(' ')
}

async function readFeatures(
  product: ResolvedProduct,
  poFlow: Product['poFlow'],
  windowStart: string
): Promise<{ features: SnapshotFeature[]; raw: RawItem[] }> {
  const ids = await queryIds(
    product.project,
    `[System.WorkItemType] = ${wiqlText(poFlow.featureType)} ${buildScopeClauses(product)} ${liveOrRecent(product, windowStart)}`
  )
  // Com os vínculos vêm todos os campos: o de prioridade ausente no projeto não
  // derruba a leitura, como derrubaria pedido por nome (o Azure recusa com 400).
  const raw = await readItems(ids, null, product.project)
  const features = raw.map((item) => ({
    ...toItem(item),
    priority: poFlow.priorityField ? numberOrNull(item.fields[poFlow.priorityField]) : null,
    createdDate: text(item.fields, 'System.CreatedDate'),
    stateChangeDate: dateOrNull(item.fields['Microsoft.VSTS.Common.StateChangeDate']),
    childIds: linked(item, CHILD_LINK)
  }))
  return { features, raw }
}

async function readChildren(features: readonly SnapshotFeature[]): Promise<SnapshotItem[]> {
  const ids = [...new Set(features.flatMap((f) => f.childIds))]
  if (ids.length === 0) return []
  // Filho pode morar em outro projeto: a leitura é pela organização.
  const raw = await readItems(ids, ITEM_FIELDS, null)
  return raw.map(toItem).sort((a, b) => a.id - b.id)
}

interface RawFeedback {
  item: SnapshotItem
  html: unknown
  related: number[]
}

async function readFeedbacks(
  product: ResolvedProduct,
  feedback: NonNullable<Product['poFlow']['feedback']>
): Promise<RawFeedback[]> {
  // Área própria do feedback, ou as do Produto (RN-CFG-14).
  const scope = buildScopeClauses(
    feedback.areaPaths.length > 0
      ? { ...product, areaPaths: feedback.areaPaths, excludedAreaPaths: [] }
      : product
  )
  const ids = await queryIds(
    product.project,
    `[System.WorkItemType] = ${wiqlText(feedback.type)} ${scope} AND [System.State] IN (${wiqlList(feedback.states)})`
  )
  if (ids.length === 0) return []
  const needsRelations = feedback.link === 'related'
  const raw = await readItems(
    ids,
    needsRelations ? null : [...ITEM_FIELDS, 'System.Description'],
    product.project
  )
  return raw.map((item) => ({
    item: toItem(item),
    html: item.fields['System.Description'],
    related: needsRelations ? linked(item, RELATED_LINK) : []
  }))
}

interface RawBug {
  item: SnapshotItem
  createdDate: string
  closedDate: string | null
  open: boolean
}

async function readBugs(product: ResolvedProduct, windowStart: string): Promise<RawBug[]> {
  const { bugType, terminalStates } = product.processProfile
  const ids = await queryIds(
    product.project,
    `[System.WorkItemType] = ${wiqlText(bugType)} ${buildScopeClauses(product)} ${liveOrRecent(product, windowStart)}`
  )
  if (ids.length === 0) return []
  const terminal = new Set(terminalStates.map((s) => s.toLowerCase()))
  const raw = await readItems(ids, BUG_FIELDS, product.project)
  return raw.map((item) => ({
    item: toItem(item),
    createdDate: text(item.fields, 'System.CreatedDate'),
    closedDate: dateOrNull(item.fields['Microsoft.VSTS.Common.ClosedDate']),
    open: !terminal.has(text(item.fields, 'System.State').toLowerCase())
  }))
}

/** Lê o Azure e monta o retrato de um Produto. Não grava nada. */
export async function buildFlowSnapshot(
  productId: string,
  now = new Date()
): Promise<FlowSnapshot> {
  const product = activeProduct(productId)
  const config = requireActiveConfig()
  const poFlow = config.products.find((p) => p.id === product.id)!.poFlow
  const windowStart = windowStartDate(now)

  const [{ features }, rawFeedbacks, rawBugs] = await Promise.all([
    readFeatures(product, poFlow, windowStart),
    poFlow.feedback ? readFeedbacks(product, poFlow.feedback) : Promise.resolve(null),
    readBugs(product, windowStart)
  ])
  const children = await readChildren(features)

  // A descrição vai só no que ainda vai ser trabalhado: feedback e bug aberto.
  const openBugs = rawBugs.filter((bug) => bug.open)
  const budget = snapshotDescriptionBudget((rawFeedbacks?.length ?? 0) + openBugs.length)
  const bugDescriptions = openBugs.length
    ? await fetchDescriptions(openBugs.map((bug) => bug.item.id))
    : new Map<number, string>()

  const feedbacks: SnapshotFeedback[] | null =
    rawFeedbacks === null
      ? null
      : rawFeedbacks.map(({ item, html, related }) => ({
          ...item,
          description: safeDescription(html, budget),
          featureIds: linkedFeatureIds(
            { id: item.id, parentId: item.parentId, related },
            features,
            poFlow.feedback!.link
          )
        }))

  const bugs: SnapshotBug[] = rawBugs.map(({ item, createdDate, closedDate, open }) => ({
    ...item,
    createdDate,
    closedDate,
    open,
    description: open ? safeDescription(bugDescriptions.get(item.id), budget) : ''
  }))

  return {
    version: 1,
    productId: product.id,
    takenAt: now.toISOString(),
    windowStart,
    priorityField: poFlow.priorityField,
    features,
    children,
    feedbacks,
    bugs
  }
}

/**
 * Tira o retrato de um Produto e grava nos Dados de trabalho (RN-FLX-02). A janela
 * recebe só o resumo: a descrição não atravessa para ela (RN-SEC-24).
 */
export async function refreshFlowSnapshot(productId: string): Promise<FlowSnapshotSummary> {
  if (typeof productId !== 'string') {
    throw new AppError('SELECTION_UNKNOWN', 'Informe o ID de um Produto da Configuração em uso.')
  }
  const profile = requireActiveProfile()
  const snapshot = await buildFlowSnapshot(productId)
  writeWorkData(profile.id, flowKeys.snapshot(snapshot.productId), snapshot)
  return summarizeSnapshot(snapshot)
}
