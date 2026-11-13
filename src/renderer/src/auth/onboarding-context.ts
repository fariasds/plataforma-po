import { createContext, useContext } from 'react'

/**
 * Abre a primeira execução de dentro do app. Serve à faixa da demonstração
 * ("Conectar ao meu Azure"): o `ProfileGate` é quem decide entre o onboarding e
 * as telas, e a faixa mora lá dentro, no `AppLayout`.
 */
export const StartOnboardingContext = createContext<() => void>(() => {})

export function useStartOnboarding(): () => void {
  return useContext(StartOnboardingContext)
}
