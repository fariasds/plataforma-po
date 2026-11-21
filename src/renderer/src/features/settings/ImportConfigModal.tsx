import { useState } from 'react'
import { Alert, Button, Flex, Modal, Segmented, Typography, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { removedFromDiff, type ImportMode } from '@shared/config/import'
import type { ImportPreview } from '@shared/ipc'
import { ConfigDiff } from '../../components/ConfigDiff'
import { useImportConfig, usePreviewImport } from '../../ipc/useProfile'
import { formatList, t, tPlural } from '../../i18n'
import { IssueList } from '../onboarding/IssueList'

const { Paragraph, Text } = Typography

/**
 * Importar uma Configuração no Perfil que já está em uso (RN-CFG-09): escolher o
 * arquivo, ver o que muda e só então aplicar. A conta da prévia é a mesma do
 * main ao gravar, então o que o PO revisou é o que vai para o disco.
 */
export function ImportConfigModal({
  open,
  onClose
}: {
  open: boolean
  onClose: (applied: boolean) => void
}): React.JSX.Element {
  const [fileName, setFileName] = useState<string | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mode, setMode] = useState<ImportMode>('replace')
  const previewImport = usePreviewImport()
  const importConfig = useImportConfig()

  const reset = (): void => {
    setFileName(null)
    setText(null)
    setPreview(null)
    setMode('replace')
    previewImport.reset()
    importConfig.reset()
  }

  const close = (applied: boolean): void => {
    reset()
    onClose(applied)
  }

  const choose = async (file: File): Promise<void> => {
    setFileName(file.name)
    setPreview(null)
    importConfig.reset()
    const content = await file.text()
    setText(content)
    await runPreview(content, mode)
  }

  const runPreview = async (content: string, nextMode: ImportMode): Promise<void> => {
    try {
      setPreview(await previewImport.mutateAsync({ json: content, mode: nextMode }))
    } catch {
      // O erro já está na mutação e aparece abaixo.
    }
  }

  const changeMode = (nextMode: ImportMode): void => {
    setMode(nextMode)
    importConfig.reset()
    if (text !== null) void runPreview(text, nextMode)
  }

  const apply = async (): Promise<void> => {
    if (text === null) return
    try {
      const result = await importConfig.mutateAsync({ json: text, mode })
      if (result.saved) close(true)
      else setPreview({ ok: false, issues: result.issues })
    } catch {
      // O erro já está na mutação e aparece abaixo.
    }
  }

  const removed = preview?.ok ? removedFromDiff(preview.diff) : null
  const removedNames = removed ? [...removed.products, ...removed.groups, ...removed.squads] : []
  const failure = previewImport.error ?? importConfig.error

  return (
    <Modal
      open={open}
      title={t('settings.import.title')}
      width={640}
      onCancel={() => close(false)}
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={() => close(false)}>{t('actions.cancel')}</Button>
          <Button
            type="primary"
            danger={removedNames.length > 0}
            disabled={!preview?.ok}
            loading={importConfig.isPending}
            onClick={() => void apply()}
          >
            {t('settings.import.apply')}
          </Button>
        </Flex>
      }
    >
      <Flex vertical gap={16}>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          {t('settings.import.intro')}
        </Paragraph>
        <div>
          <Upload
            accept=".json,application/json"
            maxCount={1}
            showUploadList={false}
            disabled={importConfig.isPending}
            beforeUpload={(file) => {
              void choose(file)
              // Nada sobe para lugar nenhum: o arquivo só é lido aqui.
              return false
            }}
          >
            <Button icon={<UploadOutlined />} loading={previewImport.isPending}>
              {fileName ? t('settings.import.chooseAnother') : t('settings.import.chooseFile')}
            </Button>
          </Upload>
          {fileName && (
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {fileName}
            </Text>
          )}
        </div>

        {preview && !preview.ok && (
          <Alert
            type="error"
            showIcon
            title={t('settings.import.refused')}
            description={<IssueList issues={preview.issues} />}
          />
        )}

        {preview?.ok && (
          <>
            {preview.kind === 'template' ? (
              <Alert type="info" showIcon title={t('settings.import.templateNote')} />
            ) : (
              <Flex vertical gap={6}>
                <Segmented<ImportMode>
                  value={mode}
                  onChange={changeMode}
                  options={[
                    { value: 'replace', label: t('settings.import.replace') },
                    { value: 'merge', label: t('settings.import.merge') }
                  ]}
                />
                <Text type="secondary">
                  {mode === 'merge'
                    ? t('settings.import.mergeHint')
                    : t('settings.import.replaceHint')}
                </Text>
              </Flex>
            )}
            <Text strong>{t('settings.import.changes')}</Text>
            <ConfigDiff diff={preview.diff} />
            {removedNames.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title={tPlural('settings.import.orphans', removedNames.length, {
                  ids: formatList(removedNames)
                })}
              />
            )}
          </>
        )}

        {failure && <Alert type="error" showIcon title={failure.message} />}
      </Flex>
    </Modal>
  )
}
