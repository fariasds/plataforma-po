import { Flex, Spin, Typography } from 'antd'
import { AppLogo } from '../components/AppLogo'

const { Text } = Typography

/** Full-window placeholder while auth or the allowlist is being resolved. */
export function Splash({ text }: { text: string }): React.JSX.Element {
  return (
    <Flex vertical align="center" justify="center" gap={20} style={{ minHeight: '100vh' }}>
      <AppLogo size={48} fontSize={22} />
      <Flex align="center" gap={10}>
        <Spin size="small" />
        <Text type="secondary">{text}</Text>
      </Flex>
    </Flex>
  )
}
