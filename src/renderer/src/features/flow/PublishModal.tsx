import { useState } from 'react'
import { Alert, Checkbox, Flex, Modal, Typography } from 'antd'
import { t } from '../../i18n'
import { MONO_FONT } from '../../theme'

const { Text } = Typography

/**
 * Escolher o que publicar na wiki (ADR 0016). Esta janela só monta o pedido: quem
 * confirma é o PO, no diálogo do sistema que o processo principal abre depois
 * (RN-SEC-41).
 */
export function PublishModal(props: {
  files: string[]
  pending: boolean
  onCancel: () => void
  onConfirm: (files: string[]) => void
}): React.JSX.Element {
  const [chosen, setChosen] = useState<string[]>(props.files)
  return (
    <Modal
      open
      title={t('catalog.publish.title')}
      onCancel={props.onCancel}
      onOk={() => props.onConfirm(chosen)}
      okText={t('catalog.publish.next')}
      okButtonProps={{ disabled: chosen.length === 0 }}
      confirmLoading={props.pending}
    >
      <Flex vertical gap={12}>
        <Alert type="info" showIcon title={t('catalog.publish.intro')} />
        <Checkbox.Group value={chosen} onChange={(v) => setChosen(v as string[])}>
          <Flex vertical gap={6}>
            {props.files.map((file) => (
              <Checkbox key={file} value={file}>
                <Text style={{ fontFamily: MONO_FONT, fontSize: 12.5 }}>{file}</Text>
              </Checkbox>
            ))}
          </Flex>
        </Checkbox.Group>
      </Flex>
    </Modal>
  )
}
