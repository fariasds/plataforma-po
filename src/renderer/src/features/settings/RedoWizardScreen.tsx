import { Card } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useConfiguration } from '../../ipc/useAzure'
import { ConfigWizard } from '../onboarding/ConfigWizard'

/** O assistente sobre a Configuração em uso, dentro do app. */
export function RedoWizardScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const config = useConfiguration()
  const back = (): void => void navigate('/configuracao')

  return (
    <Card style={{ maxWidth: 1100 }}>
      <ConfigWizard mode="redo" current={config} onFinished={back} onCancel={back} />
    </Card>
  )
}
