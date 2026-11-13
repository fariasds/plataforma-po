import { Alert, Button } from 'antd'
import { t } from '../i18n'

interface Props {
  title?: string
  error: Error
  onRetry?: () => void
}

/** Uniform failure state for any screen whose data could not be loaded. */
export function ErrorState({
  title = t('common.loadFailed'),
  error,
  onRetry
}: Props): React.JSX.Element {
  return (
    <Alert
      type="error"
      showIcon
      title={title}
      description={error.message}
      action={
        onRetry ? (
          <Button size="small" onClick={onRetry}>
            {t('actions.retry')}
          </Button>
        ) : undefined
      }
    />
  )
}
