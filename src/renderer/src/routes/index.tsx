import { createHashRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '../components/AppLayout'
import { BugAnalysisScreen } from '../features/bug-analysis/BugAnalysisScreen'
import { DailyScreen } from '../features/daily/DailyScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { PlanningScreen } from '../features/planning/PlanningScreen'
import { SecurityScreen } from '../features/security/SecurityScreen'
import { RedoWizardScreen } from '../features/settings/RedoWizardScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { SprintDeliveryScreen } from '../features/sprint-delivery/SprintDeliveryScreen'
import { TeamPerformanceScreen } from '../features/team-performance/TeamPerformanceScreen'

/**
 * Hash router on purpose: in production the renderer is loaded from `file://`,
 * where path-based routing has no server to resolve URLs against. The hash
 * keeps every route working identically in dev and in the packaged app.
 */
export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // A Home é a tela de entrada (RN-HOM-01): raiz e rota desconhecida caem nela.
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomeScreen /> },
      { path: 'dashboard', element: <Navigate to="/dashboard/sprint-delivery" replace /> },
      { path: 'dashboard/sprint-delivery', element: <SprintDeliveryScreen /> },
      { path: 'dashboard/bug-analysis', element: <BugAnalysisScreen /> },
      // Hidden from the tab bar for now, route kept so the screen is one edit
      // away from coming back. See SUB_TABS in AppLayout.
      { path: 'dashboard/team-performance', element: <TeamPerformanceScreen /> },
      { path: 'planning', element: <PlanningScreen /> },
      { path: 'daily', element: <DailyScreen /> },
      { path: 'configuracao', element: <SettingsScreen /> },
      { path: 'configuracao/assistente', element: <RedoWizardScreen /> },
      { path: 'seguranca', element: <SecurityScreen /> },
      { path: '*', element: <Navigate to="/home" replace /> }
    ]
  }
])
