import { useEffect } from 'react'
import { Alert, Card, Flex, Form, Input, Select, Spin, Typography } from 'antd'
import type { ProcessProfile } from '@shared/config/schema'
import type { ProcessDiscovery } from '@shared/discovery'
import { ErrorState } from '../../../components/ErrorState'
import { t } from '../../../i18n'
import { idFromName } from '../draft'
import { useDiscoveredProcesses, useDiscoveredProjects } from '../useDiscovery'
import type { StepProps } from './types'

const { Paragraph, Text } = Typography

type ListKey =
  | 'workItemTypes'
  | 'plannableTypes'
  | 'developmentTypes'
  | 'deliveredStates'
  | 'terminalStates'
  | 'removedStates'
  | 'bugStateOrder'

type SingleKey = 'bugType' | 'taskType' | 'estimateField' | 'inProgressState'
type NullableKey = 'devDoneState' | 'testingState'

const FIELDS: {
  key: ListKey | SingleKey | NullableKey
  kind: 'list' | 'single' | 'nullable'
  source: 'types' | 'states' | 'estimate'
}[] = [
  { key: 'workItemTypes', kind: 'list', source: 'types' },
  { key: 'plannableTypes', kind: 'list', source: 'types' },
  { key: 'developmentTypes', kind: 'list', source: 'types' },
  { key: 'bugType', kind: 'single', source: 'types' },
  { key: 'taskType', kind: 'single', source: 'types' },
  { key: 'estimateField', kind: 'single', source: 'estimate' },
  { key: 'deliveredStates', kind: 'list', source: 'states' },
  { key: 'terminalStates', kind: 'list', source: 'states' },
  { key: 'removedStates', kind: 'list', source: 'states' },
  { key: 'inProgressState', kind: 'single', source: 'states' },
  { key: 'devDoneState', kind: 'nullable', source: 'states' },
  { key: 'testingState', kind: 'nullable', source: 'states' },
  { key: 'bugStateOrder', kind: 'list', source: 'states' }
]

function optionsFrom(
  discoveries: ProcessDiscovery[]
): Record<'types' | 'states' | 'estimate', string[]> {
  const types = discoveries.flatMap((d) => d.workItemTypes)
  const unique = (values: (string | null)[]): string[] => [
    ...new Set(values.filter((v): v is string => !!v))
  ]
  return {
    types: unique(types.map((t) => t.name)),
    states: unique(types.flatMap((t) => t.states.map((s) => s.name))),
    estimate: unique(types.map((t) => t.estimateField))
  }
}

function ProfileEditor({
  profile,
  options,
  onChange
}: {
  profile: ProcessProfile
  options: Record<'types' | 'states' | 'estimate', string[]>
  onChange: (next: ProcessProfile) => void
}): React.JSX.Element {
  return (
    <Form layout="vertical" component="div">
      <Flex wrap gap={16}>
        {FIELDS.map((field) => {
          const opts = options[field.source].map((value) => ({ value, label: value }))
          const set = (value: unknown): void => onChange({ ...profile, [field.key]: value })
          const current = profile[field.key]
          return (
            <Form.Item
              key={field.key}
              label={t(`onboarding.process.fields.${field.key}.label`)}
              extra={t(`onboarding.process.fields.${field.key}.hint`)}
              style={{ flex: '1 1 300px', marginBottom: 8 }}
            >
              {field.kind === 'list' ? (
                <Select
                  mode="tags"
                  options={opts}
                  value={current as string[]}
                  status={
                    (current as string[]).length === 0 && field.key !== 'removedStates'
                      ? 'error'
                      : undefined
                  }
                  onChange={set}
                />
              ) : field.source === 'estimate' ? (
                <Input
                  value={current as string}
                  placeholder={t('onboarding.process.estimatePlaceholder')}
                  onChange={(event) => set(event.target.value.trim())}
                />
              ) : (
                <Select
                  showSearch
                  allowClear={field.kind === 'nullable'}
                  placeholder={
                    field.kind === 'nullable' ? t('onboarding.process.nonePlaceholder') : undefined
                  }
                  options={opts}
                  value={(current as string | null) ?? undefined}
                  onChange={(value?: string) => set(value ?? null)}
                />
              )}
            </Form.Item>
          )
        })}
      </Flex>
    </Form>
  )
}

/**
 * Perfil de processo sugerido pelo que o Azure diz de cada projeto e editável.
 * Projetos com o mesmo processo dividem um Perfil; o ID sai do nome do processo.
 */
export function ProcessStep({ draft, update }: StepProps): React.JSX.Element {
  const projects = useDiscoveredProjects()
  const discoveries = useDiscoveredProcesses(draft.projects)
  const byProject = new Map(draft.projects.map((project, i) => [project, discoveries[i]]))

  // Projeto ainda sem Perfil ganha um assim que a descoberta chega.
  const readyKey = discoveries.map((d) => (d.data ? '1' : '0')).join('')
  useEffect(() => {
    if (!projects.data) return
    const pending = draft.projects.filter(
      (p) => !(p in draft.projectProcess) && byProject.get(p)?.data
    )
    const added: Record<string, ProcessProfile> = {}
    const mapped: Record<string, string> = {}
    for (const project of pending) {
      const processName = projects.data.find((p) => p.name === project)?.process ?? project
      const id = idFromName(processName)
      const suggestion = byProject.get(project)?.data?.suggestion
      if (!draft.processProfiles[id] && !added[id]) {
        // Sem sugestão, o PO escolhe um Perfil existente na tela.
        if (!suggestion) continue
        added[id] = suggestion
      }
      mapped[project] = id
    }
    if (Object.keys(mapped).length === 0) return
    update((d) => ({
      ...d,
      processProfiles: { ...added, ...d.processProfiles },
      projectProcess: { ...d.projectProcess, ...mapped }
    }))
    // byProject é derivado de `discoveries`; `readyKey` resume o que importa dele.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey, projects.data, draft.projects, draft.projectProcess, update])

  const loading = projects.isPending || discoveries.some((d) => d.isPending)
  const failure = projects.error ?? discoveries.find((d) => d.error)?.error
  const usedIds = [...new Set(draft.projects.map((p) => draft.projectProcess[p]).filter(Boolean))]
  const profileOptions = Object.keys(draft.processProfiles).map((id) => ({ value: id, label: id }))

  return (
    <>
      <Paragraph type="secondary">{t('onboarding.process.intro')}</Paragraph>

      {failure && <ErrorState title={t('onboarding.process.loadFailed')} error={failure} />}
      {loading && <Spin />}

      <Card size="small" title={t('onboarding.process.mappingTitle')} style={{ marginBottom: 16 }}>
        <Flex vertical gap={8}>
          {draft.projects.map((project) => (
            <Flex key={project} align="center" gap={12}>
              <Text style={{ width: 200 }}>{project}</Text>
              <Select
                style={{ width: 220 }}
                placeholder={t('onboarding.process.choosePlaceholder')}
                options={profileOptions}
                value={draft.projectProcess[project]}
                status={draft.projectProcess[project] ? undefined : 'error'}
                onChange={(id: string) =>
                  update((d) => ({ ...d, projectProcess: { ...d.projectProcess, [project]: id } }))
                }
              />
              {byProject.get(project)?.data && !byProject.get(project)?.data?.suggestion && (
                <Text type="warning">{t('onboarding.process.noSuggestion')}</Text>
              )}
            </Flex>
          ))}
        </Flex>
      </Card>

      {usedIds.length === 0 && !loading && (
        <Alert type="info" showIcon title={t('onboarding.process.noneChosen')} />
      )}

      <Flex vertical gap={16}>
        {usedIds.map((id) => {
          const related = draft.projects
            .filter((p) => draft.projectProcess[p] === id)
            .flatMap((p) => byProject.get(p)?.data ?? [])
          return (
            <Card key={id} size="small" title={t('onboarding.process.profileTitle', { id })}>
              <ProfileEditor
                profile={draft.processProfiles[id]}
                options={optionsFrom(related)}
                onChange={(next) =>
                  update((d) => ({ ...d, processProfiles: { ...d.processProfiles, [id]: next } }))
                }
              />
            </Card>
          )
        })}
      </Flex>
    </>
  )
}
