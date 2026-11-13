import { Alert, Table, Tag, Typography } from 'antd'
import { ErrorState } from '../../../components/ErrorState'
import { t } from '../../../i18n'
import { idFromName, newKey, paletteColor, type WizardDraft } from '../draft'
import { useDiscoveredProjects } from '../useDiscovery'
import type { StepProps } from './types'

const { Paragraph } = Typography

/**
 * Projeto recém-marcado ganha um Produto que cobre o projeto inteiro, com o time
 * padrão. É o caso mais comum; quem divide o projeto em vários Produtos ajusta
 * no passo seguinte.
 */
function withProjects(
  draft: WizardDraft,
  selected: string[],
  defaultTeams: Map<string, string | null>
): WizardDraft {
  const products = [...draft.products]
  for (const project of selected) {
    if (products.some((p) => p.project === project)) continue
    products.push({
      key: newKey('p'),
      id: idFromName(
        project,
        [...products, ...draft.groups].map((item) => item.id)
      ),
      idTouched: false,
      idLocked: false,
      name: project,
      color: paletteColor(products.length),
      project,
      team: defaultTeams.get(project) ?? null,
      areaPaths: [],
      excludedAreaPaths: [],
      cadence: 'sprints'
    })
  }
  return { ...draft, projects: selected, products }
}

export function ProjectsStep({ draft, update }: StepProps): React.JSX.Element {
  const projects = useDiscoveredProjects()

  if (projects.isError) {
    return (
      <ErrorState
        title={t('onboarding.projects.listFailed')}
        error={projects.error}
        onRetry={() => projects.refetch()}
      />
    )
  }

  const known = new Set(projects.data?.map((p) => p.name))
  const missing = projects.data ? draft.projects.filter((p) => !known.has(p)) : []

  return (
    <>
      <Paragraph type="secondary">{t('onboarding.projects.intro')}</Paragraph>

      {missing.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('onboarding.projects.missingTitle', { projects: missing.join(', ') })}
          description={t('onboarding.projects.missingText')}
        />
      )}

      <Table
        size="small"
        rowKey="name"
        loading={projects.isPending}
        dataSource={projects.data ?? []}
        pagination={false}
        rowSelection={{
          selectedRowKeys: draft.projects,
          preserveSelectedRowKeys: true,
          onChange: (keys) => {
            const defaults = new Map(projects.data?.map((p) => [p.name, p.defaultTeam]))
            update((d) => withProjects(d, keys as string[], defaults))
          }
        }}
        columns={[
          { title: t('common.project'), dataIndex: 'name' },
          {
            title: t('onboarding.projects.process'),
            dataIndex: 'process',
            render: (process: string | null) => (process ? <Tag>{process}</Tag> : '—')
          },
          {
            title: t('onboarding.projects.defaultTeam'),
            dataIndex: 'defaultTeam',
            render: (team) => team ?? '—'
          }
        ]}
      />
    </>
  )
}
