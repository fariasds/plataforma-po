import { ConfigProvider, Layout } from 'antd'
import { RouterProvider } from 'react-router-dom'
import { ProfileGate } from './auth/ProfileGate'
import { useActiveConfig } from './ipc/useAzure'
import { router } from './routes'
import { buildTheme } from './theme'

function App(): React.JSX.Element {
  // A cor de destaque é do PO (`appearance.accentColor`); sem Configuração, vale a padrão.
  const accentColor = useActiveConfig()?.appearance?.accentColor

  // The outer Layout gives the gate screens (PAT setup, splash) the same
  // background the app uses — they render before the router exists.
  return (
    <ConfigProvider theme={buildTheme(accentColor)}>
      <Layout style={{ minHeight: '100vh' }}>
        <ProfileGate>
          <RouterProvider router={router} />
        </ProfileGate>
      </Layout>
    </ConfigProvider>
  )
}

export default App
