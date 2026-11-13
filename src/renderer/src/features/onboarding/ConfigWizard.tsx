import { useCallback, useState } from 'react'
import { Alert, Button, Flex, Form, Input, Progress, Steps, Typography } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import type { Configuration } from '@shared/config/schema'
import { validateConfiguration } from '@shared/config/validate'
import { PatField, PatInstructions } from '../../auth/PatSetupScreen'
import { AppMark } from '../../components/AppLogo'
import { useCreateProfile, useImportConfig } from '../../ipc/useProfile'
import { t } from '../../i18n'
import { tRich } from '../../i18n/rich'
import { IssueList } from './IssueList'
import {
  activeProducts,
  buildConfiguration,
  draftFromConfig,
  idProblem,
  type WizardDraft
} from './draft'
import { parseOrganizationInput } from './organization'
import { CalendarStep } from './steps/CalendarStep'
import { FieldsStep } from './steps/FieldsStep'
import { OriginsStep } from './steps/OriginsStep'
import { ProcessStep } from './steps/ProcessStep'
import { ProductsStep } from './steps/ProductsStep'
import { ProjectsStep } from './steps/ProjectsStep'
import { ReviewStep } from './steps/ReviewStep'
import type { UpdateDraft } from './steps/types'

const { Title, Paragraph, Text } = Typography

const STEPS = [
  t('onboarding.wizard.steps.organization'),
  t('onboarding.wizard.steps.token'),
  t('onboarding.wizard.steps.projects'),
  t('onboarding.wizard.steps.origins'),
  t('onboarding.wizard.steps.products'),
  t('onboarding.wizard.steps.process'),
  t('onboarding.wizard.steps.fields'),
  t('onboarding.wizard.steps.calendar'),
  t('onboarding.wizard.steps.review')
] as const

/** O que vem antes do nome da organização no endereço; não se traduz. */
const AZURE_HOST = 'dev.azure.com/'

/** Primeiro passo que só existe com o Perfil criado. */
const FIRST_CONFIG_STEP = 2
const REVIEW_STEP = STEPS.length - 1

/** O que impede avançar do passo, ou `null`. A revisão valida o arquivo inteiro. */
function blocker(step: number, draft: WizardDraft): string | null {
  const products = activeProducts(draft)
  switch (step) {
    case 2:
      return draft.projects.length === 0 ? t('onboarding.wizard.blockers.noProject') : null
    case 3:
      return products.length === 0 ? t('onboarding.wizard.blockers.noProduct') : null
    case 4:
      if (products.some((p) => !p.name.trim())) return t('onboarding.wizard.blockers.productName')
      if ([...products, ...draft.groups].some((i) => !i.idLocked && idProblem(draft, i.key, i.id)))
        return t('onboarding.wizard.blockers.invalidId')
      if (draft.groups.some((g) => !g.name.trim() || g.products.length < 2))
        return t('onboarding.wizard.blockers.groupIncomplete')
      return null
    case 5:
      return draft.projects.some((p) => !draft.projectProcess[p])
        ? t('onboarding.wizard.blockers.noProcess')
        : null
    default:
      return null
  }
}

function OrganizationStep({
  value,
  onChange,
  onNext
}: {
  value: string
  onChange: (value: string) => void
  onNext: (organization: string) => void
}): React.JSX.Element {
  const parsed = parseOrganizationInput(value)
  const touched = value.trim() !== ''

  return (
    <Form layout="vertical" component="div">
      <Paragraph type="secondary">{t('onboarding.organization.intro')}</Paragraph>
      <Form.Item
        label={t('onboarding.organization.label')}
        validateStatus={touched && !parsed.ok ? 'error' : undefined}
        help={touched && !parsed.ok ? parsed.message : undefined}
        extra={
          <Text type="secondary">
            {tRich('onboarding.organization.hint', { host: <Text code>{AZURE_HOST}</Text> })}
          </Text>
        }
      >
        <Input
          autoFocus
          prefix={<GlobalOutlined />}
          placeholder={t('onboarding.organization.placeholder')}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onPressEnter={() => parsed.ok && onNext(parsed.organization)}
        />
      </Form.Item>
      {parsed.ok && parsed.fromUrl && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('onboarding.organization.nameOnlyTitle', { organization: parsed.organization })}
          description={t('onboarding.organization.nameOnlyText')}
        />
      )}
      <Button
        type="primary"
        disabled={!parsed.ok}
        onClick={() => parsed.ok && onNext(parsed.organization)}
      >
        {t('actions.next')}
      </Button>
    </Form>
  )
}

function TokenStep({
  organization,
  onBack,
  onCreated
}: {
  organization: string
  onBack: () => void
  onCreated: (config: Configuration) => void
}): React.JSX.Element {
  const createProfile = useCreateProfile()

  return (
    <>
      <PatInstructions organization={organization} />
      <Form
        layout="vertical"
        requiredMark={false}
        onFinish={(values: { pat: string }) =>
          createProfile.mutate(
            // Na v1 há um Perfil só; o nome dele é o da organização.
            { name: organization, organization, pat: values.pat },
            { onSuccess: (state) => state.config && onCreated(state.config) }
          )
        }
      >
        <PatField autoFocus />
        <Flex gap={8}>
          <Button onClick={onBack} disabled={createProfile.isPending}>
            {t('actions.back')}
          </Button>
          <Button type="primary" htmlType="submit" loading={createProfile.isPending}>
            {t('onboarding.token.validate')}
          </Button>
        </Flex>
        {createProfile.isError && (
          <Alert
            type="error"
            showIcon
            title={t('onboarding.token.createFailed')}
            description={createProfile.error.message}
            style={{ marginTop: 16 }}
          />
        )}
      </Form>
    </>
  )
}

interface Props {
  /**
   * `first-run`: começa pela organização e pelo token, que criam o Perfil.
   * `redo`: o Perfil já existe; começa pelos projetos, a partir de `current`.
   */
  mode: 'first-run' | 'redo'
  current?: Configuration | null
  onFinished: () => void
  /** Sair sem salvar. Na primeira execução só aparece antes de o Perfil existir. */
  onCancel?: () => void
}

/**
 * Assistente de Configuração. Monta um rascunho e só grava no fim, pela mesma
 * porta da importação: o main valida de novo e recusa o que não passar.
 */
export function ConfigWizard({
  mode,
  current = null,
  onFinished,
  onCancel
}: Props): React.JSX.Element {
  const [step, setStep] = useState(mode === 'redo' ? FIRST_CONFIG_STEP : 0)
  const [organizationInput, setOrganizationInput] = useState('')
  const [organization, setOrganization] = useState('')
  const [draft, setDraft] = useState<WizardDraft | null>(() =>
    mode === 'redo' && current ? draftFromConfig(current) : null
  )
  // A Configuração que o Perfil tinha quando o assistente começou a editá-la.
  const [previous, setPrevious] = useState<Configuration | null>(mode === 'redo' ? current : null)
  const save = useImportConfig()

  const update: UpdateDraft = useCallback((change) => setDraft((d) => (d ? change(d) : d)), [])

  const problem = draft ? blocker(step, draft) : null
  const valid = draft ? validateConfiguration(buildConfiguration(draft)).ok : false

  const finish = (): void => {
    if (!draft) return
    save.mutate(JSON.stringify(buildConfiguration(draft), null, 2), {
      onSuccess: (result) => {
        if (result.saved) onFinished()
      }
    })
  }

  let body: React.ReactNode
  if (step === 0) {
    body = (
      <OrganizationStep
        value={organizationInput}
        onChange={setOrganizationInput}
        onNext={(org) => {
          setOrganization(org)
          setStep(1)
        }}
      />
    )
  } else if (step === 1) {
    body = (
      <TokenStep
        organization={organization}
        onBack={() => setStep(0)}
        onCreated={(config) => {
          setDraft(draftFromConfig(config))
          setPrevious(config)
          setStep(FIRST_CONFIG_STEP)
        }}
      />
    )
  } else if (draft) {
    const props = { draft, update }
    body = [
      null,
      null,
      <ProjectsStep key="projects" {...props} />,
      <OriginsStep key="origins" {...props} />,
      <ProductsStep key="products" {...props} />,
      <ProcessStep key="process" {...props} />,
      <FieldsStep key="fields" {...props} />,
      <CalendarStep key="calendar" {...props} />,
      <ReviewStep key="review" draft={draft} previous={previous} />
    ][step]
  }

  const profileExists = mode === 'redo' || draft !== null

  return (
    <Flex vertical gap={24}>
      <Flex align="center" justify="space-between" gap={16} wrap>
        <Flex align="center" gap={12}>
          <AppMark size={32} />
          <Title level={4} style={{ margin: 0 }}>
            {mode === 'redo'
              ? t('onboarding.wizard.titleRedo')
              : t('onboarding.wizard.titleFirstRun')}
          </Title>
        </Flex>
        <Flex align="center" gap={12}>
          <Text type="secondary">
            {t('onboarding.wizard.stepOf', { current: step + 1, total: STEPS.length })}
          </Text>
          <Progress
            percent={Math.round(((step + 1) / STEPS.length) * 100)}
            showInfo={false}
            size="small"
            style={{ width: 140, margin: 0 }}
          />
        </Flex>
      </Flex>

      <Flex gap={32} wrap align="flex-start">
        {/* Os passos ficam numa coluna: nove títulos não cabem numa linha sem encolher. */}
        <Steps
          size="small"
          orientation="vertical"
          current={step}
          style={{ flex: '0 0 200px' }}
          items={STEPS.map((title, index) => ({
            title,
            // Organização e token já foram usados para criar o Perfil: não se volta a eles.
            disabled: (profileExists && index < FIRST_CONFIG_STEP) || index > step
          }))}
          onChange={(index) =>
            index < step && index >= (profileExists ? FIRST_CONFIG_STEP : 0) && setStep(index)
          }
        />

        <Flex vertical gap={20} style={{ flex: '999 1 480px', minWidth: 0 }}>
          <Title level={3} style={{ margin: 0, letterSpacing: '-0.02em' }}>
            {STEPS[step]}
          </Title>
          <div>{body}</div>

          {step >= FIRST_CONFIG_STEP && draft && (
            <Flex vertical gap={12}>
              {save.data && !save.data.saved && (
                <Alert
                  type="error"
                  showIcon
                  title={t('onboarding.wizard.refused')}
                  description={<IssueList issues={save.data.issues} />}
                />
              )}
              {save.isError && (
                <Alert
                  type="error"
                  showIcon
                  title={t('onboarding.wizard.saveFailed')}
                  description={save.error.message}
                />
              )}
              <Flex gap={8} align="center" wrap>
                {step > FIRST_CONFIG_STEP && (
                  <Button onClick={() => setStep(step - 1)} disabled={save.isPending}>
                    {t('actions.back')}
                  </Button>
                )}
                {step < REVIEW_STEP ? (
                  <Button
                    type="primary"
                    disabled={problem !== null}
                    onClick={() => setStep(step + 1)}
                  >
                    {t('actions.next')}
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    disabled={!valid}
                    loading={save.isPending}
                    onClick={finish}
                  >
                    {t('onboarding.wizard.saveAndEnter')}
                  </Button>
                )}
                {problem && <Text type="secondary">{problem}</Text>}
                <div style={{ flex: 1 }} />
                {mode === 'redo' ? (
                  <Button type="text" onClick={onCancel} disabled={save.isPending}>
                    {t('onboarding.wizard.cancelWithoutSaving')}
                  </Button>
                ) : (
                  // O Perfil já existe e é válido, só sem Produtos: dá para entrar e voltar depois.
                  <Button type="text" onClick={onFinished} disabled={save.isPending}>
                    {t('onboarding.wizard.finishLater')}
                  </Button>
                )}
              </Flex>
            </Flex>
          )}

          {step < FIRST_CONFIG_STEP && onCancel && (
            <div>
              <Button type="link" style={{ padding: 0 }} onClick={onCancel}>
                {t('actions.backToStart')}
              </Button>
            </div>
          )}
        </Flex>
      </Flex>
    </Flex>
  )
}
