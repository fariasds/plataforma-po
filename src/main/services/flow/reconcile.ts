import { readFileSync } from 'fs'
import { join } from 'path'
import { AppError } from '@shared/errors'
import { ARTIFACT_FILES } from '@shared/flow-artifacts'
import type { FlowBoard } from '@shared/flow-board'
import { setPlanAzureId, setReadmeFeatureId, type TitleMatch } from '@shared/flow-reconcile'
import { writeFileAtomic } from '../../profile/atomic-write'
import { requireActiveProfile } from '../../profile/profile-store'
import { getWorkFolder } from '../../profile/work-folders'
import { getFlowBoard } from './board'
import { FEATURES_DIR } from '../../flow/feature-folders'

/**
 * O clique do PO que confirma o ID do Azure (RN-FLX-12, RN-FLX-13). A janela manda
 * o Produto, a pasta da Feature, o PBI e o ID; o main refaz o quadro e só grava se
 * o ID ainda for um dos candidatos que ele mesmo encontrou. Assim a janela não grava
 * um ID qualquer, e um plano que mudou no meio do caminho não é sobrescrito.
 */

const STALE = 'O plano ou o retrato mudou desde que a tela foi aberta. Atualize e confirme de novo.'

function assertId(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new AppError('RECONCILE_STALE', 'ID do Azure inválido.')
  }
  return value as number
}

function confirmed(match: TitleMatch | null | undefined, id: number): void {
  if (!match || !match.candidates.some((candidate) => candidate.id === id)) {
    throw new AppError('RECONCILE_STALE', STALE)
  }
}

/** A pasta da Feature, só se o quadro a conhece: o `slug` nunca vira caminho sozinho. */
function featureDir(board: FlowBoard, productId: string, slug: unknown): string {
  const feature = board.features.find((f) => f.slug !== null && f.slug === slug)
  const root = getWorkFolder(requireActiveProfile().id, productId)
  if (!feature || board.workFolder !== 'ok' || root === null) {
    throw new AppError('RECONCILE_STALE', STALE)
  }
  return join(root, FEATURES_DIR, feature.slug!)
}

function edit(file: string, change: (text: string) => string | null): void {
  const next = change(readFileSync(file, 'utf8'))
  if (next === null) throw new AppError('RECONCILE_STALE', STALE)
  writeFileAtomic(file, next)
}

/** Grava `Azure: #<id>` no PBI do plano e devolve o quadro de novo. */
export function linkPlannedPbi(
  productId: string,
  slug: string,
  pbiKey: string,
  azureId: number
): FlowBoard {
  const id = assertId(azureId)
  const board = getFlowBoard(productId)
  const dir = featureDir(board, board.productId, slug)
  const feature = board.features.find((f) => f.slug === slug)!
  confirmed(
    feature.reconciliation.pbis.find((r) => r.pbi === pbiKey),
    id
  )
  edit(join(dir, ARTIFACT_FILES.plan), (text) => setPlanAzureId(text, pbiKey, id))
  return getFlowBoard(board.productId)
}

/** Troca `Feature: #a criar` por `Feature: #<id>` no README do rascunho. */
export function linkDraftFeature(productId: string, slug: string, featureId: number): FlowBoard {
  const id = assertId(featureId)
  const board = getFlowBoard(productId)
  const dir = featureDir(board, board.productId, slug)
  const feature = board.features.find((f) => f.slug === slug)!
  confirmed(feature.reconciliation.feature, id)
  edit(join(dir, ARTIFACT_FILES.readme), (text) => setReadmeFeatureId(text, id))
  return getFlowBoard(board.productId)
}
