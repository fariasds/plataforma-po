import { Alert, Button, Card, Flex, Form, Select, Switch, TreeSelect, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { DiscoveredArea } from '@shared/discovery'
import { ErrorState } from '../../../components/ErrorState'
import { t } from '../../../i18n'
import { idFromName, newKey, paletteColor, type ProductDraft } from '../draft'
import { useDiscoveredAreas, useDiscoveredTeams } from '../useDiscovery'
import type { StepProps, UpdateDraft } from './types'

const { Paragraph, Text } = Typography

interface AreaNode {
  title: string
  value: string
  children: AreaNode[]
}

function toTree(area: DiscoveredArea): AreaNode {
  return { title: area.name, value: area.path, children: area.children.map(toTree) }
}

function patchProduct(update: UpdateDraft, key: string, patch: Partial<ProductDraft>): void {
  update((d) => ({
    ...d,
    products: d.products.map((p) => (p.key === key ? { ...p, ...patch } : p))
  }))
}

function ProjectOrigins({
  project,
  products,
  update
}: {
  project: string
  products: ProductDraft[]
  update: UpdateDraft
}): React.JSX.Element {
  const teams = useDiscoveredTeams(project)
  const areas = useDiscoveredAreas(project)
  const failure = teams.error ?? areas.error
  const tree = areas.data ? [toTree(areas.data)] : []

  const addProduct = (): void =>
    update((d) => {
      const name = `${project} ${d.products.filter((p) => p.project === project).length + 1}`
      return {
        ...d,
        products: [
          ...d.products,
          {
            key: newKey('p'),
            id: idFromName(
              name,
              [...d.products, ...d.groups].map((item) => item.id)
            ),
            idTouched: false,
            idLocked: false,
            name,
            color: paletteColor(d.products.length),
            project,
            team: null,
            areaPaths: [],
            excludedAreaPaths: [],
            cadence: 'sprints'
          }
        ]
      }
    })

  const removeProduct = (key: string): void =>
    update((d) => ({
      ...d,
      products: d.products.filter((p) => p.key !== key),
      groups: d.groups.map((g) => ({ ...g, products: g.products.filter((k) => k !== key) }))
    }))

  return (
    <Card size="small" title={project}>
      {failure && (
        <ErrorState
          title={t('onboarding.origins.loadFailed')}
          error={failure}
          onRetry={() => {
            void teams.refetch()
            void areas.refetch()
          }}
        />
      )}

      <Flex vertical gap={16}>
        {products.map((product) => (
          <Card
            key={product.key}
            size="small"
            type="inner"
            title={product.name || t('onboarding.origins.unnamedProduct')}
            extra={
              products.length > 1 && (
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t('onboarding.origins.removeProduct')}
                  onClick={() => removeProduct(product.key)}
                />
              )
            }
          >
            <Form layout="vertical" component="div">
              <Form.Item
                label={t('onboarding.origins.team')}
                extra={t('onboarding.origins.teamHint')}
              >
                <Select
                  allowClear
                  showSearch
                  loading={teams.isPending}
                  placeholder={t('onboarding.origins.teamPlaceholder')}
                  value={product.team ?? undefined}
                  options={teams.data?.map((t) => ({ value: t.name, label: t.name }))}
                  onChange={(team?: string) =>
                    patchProduct(update, product.key, { team: team ?? null })
                  }
                />
              </Form.Item>
              <Form.Item
                label={t('onboarding.origins.includedAreas')}
                extra={t('onboarding.origins.includedAreasHint')}
              >
                <TreeSelect
                  multiple
                  allowClear
                  showSearch
                  treeNodeFilterProp="title"
                  loading={areas.isPending}
                  treeData={tree}
                  treeDefaultExpandedKeys={areas.data ? [areas.data.path] : []}
                  placeholder={t('onboarding.origins.includedAreasPlaceholder')}
                  value={product.areaPaths}
                  onChange={(paths: string[]) =>
                    patchProduct(update, product.key, { areaPaths: paths })
                  }
                />
              </Form.Item>
              <Form.Item
                label={t('onboarding.origins.excludedAreas')}
                extra={t('onboarding.origins.excludedAreasHint')}
              >
                <TreeSelect
                  multiple
                  allowClear
                  showSearch
                  treeNodeFilterProp="title"
                  loading={areas.isPending}
                  treeData={tree}
                  treeDefaultExpandedKeys={areas.data ? [areas.data.path] : []}
                  placeholder={t('onboarding.origins.excludedAreasPlaceholder')}
                  value={product.excludedAreaPaths}
                  onChange={(paths: string[]) =>
                    patchProduct(update, product.key, { excludedAreaPaths: paths })
                  }
                />
              </Form.Item>
              <Flex align="center" gap={8}>
                <Switch
                  size="small"
                  checked={product.cadence === 'continuous'}
                  onChange={(on) =>
                    patchProduct(update, product.key, { cadence: on ? 'continuous' : 'sprints' })
                  }
                />
                <Text type="secondary">{t('onboarding.origins.continuous')}</Text>
              </Flex>
            </Form>
          </Card>
        ))}

        <Button icon={<PlusOutlined />} onClick={addProduct}>
          {t('onboarding.origins.addProduct')}
        </Button>
      </Flex>
    </Card>
  )
}

/** Um Produto é um recorte de um projeto: time que dá as sprints e áreas. */
export function OriginsStep({ draft, update }: StepProps): React.JSX.Element {
  return (
    <>
      <Paragraph type="secondary">{t('onboarding.origins.intro')}</Paragraph>
      {draft.projects.length === 0 ? (
        <Alert type="info" showIcon title={t('onboarding.origins.noProject')} />
      ) : (
        <Flex vertical gap={16}>
          {draft.projects.map((project) => (
            <ProjectOrigins
              key={project}
              project={project}
              products={draft.products.filter((p) => p.project === project)}
              update={update}
            />
          ))}
        </Flex>
      )}
    </>
  )
}
