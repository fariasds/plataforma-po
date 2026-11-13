import { useState } from 'react'
import { firstStepsState } from '@shared/home'
import { useProfileState } from '../../ipc/useProfile'
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

  const choose = (showList: boolean): void => {
    setShowList(profileId, showList)
    setMemory(readFirstSteps(profileId))
  }

  return state.view === 'first-access' ? (
    <FirstAccessHome state={state} onHide={() => choose(false)} />
  ) : (
    <RecurringHome onReviewFirstSteps={() => choose(true)} />
  )
}
