import { useState } from 'react'
import { firstStepsState } from '@shared/home'
import { RELEASE_NOTES, releaseModalDecision, type ReleaseEntry } from '@shared/release-notes'
import { useIsDemo, useProfileState } from '../../ipc/useProfile'
import { ReleaseNotesModal } from '../release-notes/ReleaseNotesModal'
import { markSeen, readSeen } from '../release-notes/seen-storage'
import { FirstAccessHome } from './FirstAccessHome'
import { readFirstSteps, setShowList } from './first-steps-storage'
import { RecurringHome } from './RecurringHome'

/**
 * Tela de entrada do app (`RN-HOM-01`). Não é um dashboard: aponta para a tela de
 * cada momento da sprint e, no primeiro acesso, ensina o caminho (`RN-HOM-03`).
 */
export function HomeScreen(): React.JSX.Element {
  const profileId = useProfileState().data?.profile?.id
  // As visitas são gravadas pelo AppLayout em outras telas; ao voltar para a Home,
  // ela remonta e lê de novo.
  const [memory, setMemory] = useState(() => readFirstSteps(profileId))
  const state = firstStepsState(memory)
  const pendingNotes = usePendingReleaseNotes()

  const choose = (showList: boolean): void => {
    setShowList(profileId, showList)
    setMemory(readFirstSteps(profileId))
  }

  return (
    <>
      {state.view === 'first-access' ? (
        <FirstAccessHome state={state} onHide={() => choose(false)} />
      ) : (
        <RecurringHome onReviewFirstSteps={() => choose(true)} />
      )}
      {pendingNotes.entries && (
        <ReleaseNotesModal entries={pendingNotes.entries} onClose={pendingNotes.close} />
      )}
    </>
  )
}

/**
 * Decide uma vez, ao montar a Home, se o modal de novidades abre (`RN-HOM-04`).
 * A demonstração não abre nem marca: o PO veria as novidades num Perfil de
 * exemplo e nunca no dele.
 */
function usePendingReleaseNotes(): { entries?: ReleaseEntry[]; close: () => void } {
  const isDemo = useIsDemo()
  const [entries, setEntries] = useState<ReleaseEntry[] | undefined>(() => {
    if (isDemo) return undefined
    const decision = releaseModalDecision(RELEASE_NOTES, __APP_VERSION__, readSeen())
    if (decision.open) return decision.entries
    if (decision.markSeen) markSeen(__APP_VERSION__)
    return undefined
  })
  return {
    entries: isDemo ? undefined : entries,
    close: () => {
      markSeen(__APP_VERSION__)
      setEntries(undefined)
    }
  }
}
