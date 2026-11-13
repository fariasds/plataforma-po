import { useState, type ReactNode } from 'react'
import { Alert, Button, Flex } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import { ErrorState } from '../components/ErrorState'
import { IssueList } from '../features/onboarding/IssueList'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { useOpenProfileFolder, useProfileState } from '../ipc/useProfile'
import { t } from '../i18n'
import { StartOnboardingContext } from './onboarding-context'
import { PatSetupScreen } from './PatSetupScreen'
import { Splash } from './Splash'

function OpenFolderButton(): React.JSX.Element {
  const openFolder = useOpenProfileFolder()
  return (
    <Button
      size="small"
      icon={<FolderOpenOutlined />}
      loading={openFolder.isPending}
      onClick={() => openFolder.mutate()}
    >
      {t('profile.openFolder')}
    </Button>
  )
}

/**
 * Segura o app até haver um Perfil com PAT e Configuração em uso.
 *
 * Com a Configuração quebrada depois de já ter havido uma válida, o app **não**
 * sai do ar: segue com a última versão válida e mostra os erros no topo
 * (RN-CFG-07). Só bloqueia quando nunca houve versão válida.
 */
export function ProfileGate({ children }: { children: ReactNode }): React.JSX.Element {
  const { data: state, isPending, isError, error, refetch } = useProfileState()
  // Ligado quando o PO escolhe uma porta da primeira execução. O Perfil nasce no
  // meio do caminho e o estado vira `ready`; sem isto, o app entraria antes de o
  // assistente terminar.
  const [onboarding, setOnboarding] = useState(false)

  if (isPending) return <Splash text={t('profile.loading')} />

  /*
    Falha ao checar **não é** ausência de Perfil nem de token.

    As duas situações levavam à mesma tela de cadastro, e o efeito era pedir o
    PAT de novo a quem já tem um guardado — convidando a substituir por engano um
    token que estava perfeitamente válido. Aqui a diferença fica explícita, com
    o motivo real e um botão para tentar de novo.
  */
  if (isError) {
    console.error('[perfil] não foi possível carregar o Perfil:', error)
    return (
      <Flex justify="center" style={{ padding: 24 }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <ErrorState title={t('profile.loadFailed')} error={error} onRetry={() => refetch()} />
        </div>
      </Flex>
    )
  }

  if (state.status === 'no-profile' || onboarding) {
    return (
      <OnboardingScreen
        onStart={() => setOnboarding(true)}
        onDone={() => setOnboarding(false)}
        // Aberta pela faixa da demonstração, dá para voltar sem criar nada.
        onBack={
          onboarding && state.profile?.kind === 'demo' ? () => setOnboarding(false) : undefined
        }
      />
    )
  }

  switch (state.status) {
    case 'needs-pat':
      return <PatSetupScreen />
    case 'invalid-config':
      return (
        <Flex justify="center" style={{ padding: 24 }}>
          <Flex vertical gap={12} style={{ maxWidth: 720, width: '100%' }}>
            <ErrorState
              title={t('profile.invalidTitle')}
              error={new Error(t('profile.invalidHint'))}
            />
            <IssueList issues={state.errors} />
            <div>
              <OpenFolderButton />
            </div>
          </Flex>
        </Flex>
      )
    case 'ready':
      return (
        <>
          {state.errors.length > 0 && (
            <Alert
              type="warning"
              showIcon
              banner
              title={t('profile.staleWarning')}
              description={<IssueList issues={state.errors} />}
              action={<OpenFolderButton />}
            />
          )}
          <StartOnboardingContext.Provider value={() => setOnboarding(true)}>
            {children}
          </StartOnboardingContext.Provider>
        </>
      )
  }
}
