import 'antd/dist/reset.css'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as AntdApp, ConfigProvider } from 'antd'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './ipc/queryClient'
import { APP_NAME } from '@shared/app-info'
import { antdLocale } from './i18n'
import { buildTheme } from './theme'
import App from './App'

// O <title> do index.html é só o valor inicial; o nome vem de app-info.
document.title = APP_NAME

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={antdLocale} theme={buildTheme()}>
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>
)
