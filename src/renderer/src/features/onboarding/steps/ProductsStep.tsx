import { Alert, Button, ColorPicker, Flex, Input, Select, Table, Typography } from 'antd'
import { DeleteOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons'
import { HelpTip } from '../../../components/HelpTip'
import { t } from '../../../i18n'
import {
  activeProducts,
  idFromName,
  idProblem,
  idsExcept,
  newKey,
  paletteColor,
  productsWithoutSquad,
  type GroupDraft,
  type ProductDraft,
  type SquadDraft,
  type WizardDraft
} from '../draft'
import type { StepProps } from './types'

const { Paragraph, Title, Text } = Typography

/**
 * Renomear muda o ID junto só enquanto o PO não tocou no ID e ele ainda não foi
 * salvo. Depois disso o ID é fixo (RN-CFG-02).
 */
function rename<T extends ProductDraft | GroupDraft | SquadDraft>(
  draft: WizardDraft,
  item: T,
  name: string
): T {
  const followName = !item.idTouched && !item.idLocked
  return {
    ...item,
    name,
    id: followName ? idFromName(name, idsExcept(draft, item.key)) : item.id
  }
}

function IdInput({
  draft,
  item,
  onChange
}: {
  draft: WizardDraft
  item: ProductDraft | GroupDraft | SquadDraft
  onChange: (id: string) => void
}): React.JSX.Element {
  const problem = item.idLocked ? null : idProblem(draft, item.key, item.id)
  return (
    <Flex vertical>
      <Input
        size="small"
        value={item.id}
        disabled={item.idLocked}
        status={problem ? 'error' : undefined}
        prefix={item.idLocked ? <LockOutlined /> : undefined}
        onChange={(event) => onChange(event.target.value.trim())}
      />
      {problem && (
        <Text type="danger" style={{ fontSize: 12 }}>
          {problem}
        </Text>
      )}
    </Flex>
  )
}

function ProductTable({ draft, update }: StepProps): React.JSX.Element {
  const patch = (key: string, change: (p: ProductDraft) => ProductDraft): void =>
    update((d) => ({ ...d, products: d.products.map((p) => (p.key === key ? change(p) : p)) }))

  return (
    <Table
      size="small"
      rowKey="key"
      pagination={false}
      dataSource={activeProducts(draft)}
      columns={[
        {
          title: t('common.name'),
          render: (_, product) => (
            <Input
              size="small"
              value={product.name}
              status={product.name.trim() ? undefined : 'error'}
              onChange={(event) => patch(product.key, (p) => rename(draft, p, event.target.value))}
            />
          )
        },
        {
          title: t('onboarding.products.color'),
          width: 64,
          render: (_, product) => (
            <ColorPicker
              size="small"
              disabledAlpha
              value={product.color}
              onChangeComplete={(color) =>
                patch(product.key, (p) => ({ ...p, color: color.toHexString().toUpperCase() }))
              }
            />
          )
        },
        {
          title: (
            <Flex align="center" gap={4}>
              {t('common.id')} <HelpTip rule="RN-CFG-02" />
            </Flex>
          ),
          width: 220,
          render: (_, product) => (
            <IdInput
              draft={draft}
              item={product}
              onChange={(id) => patch(product.key, (p) => ({ ...p, id, idTouched: true }))}
            />
          )
        },
        { title: t('common.project'), dataIndex: 'project', width: 160 }
      ]}
    />
  )
}

function GroupEditor({ draft, update }: StepProps): React.JSX.Element {
  const patch = (key: string, change: (g: GroupDraft) => GroupDraft): void =>
    update((d) => ({ ...d, groups: d.groups.map((g) => (g.key === key ? change(g) : g)) }))
  const productOptions = activeProducts(draft).map((p) => ({ value: p.key, label: p.name }))

  const add = (): void =>
    update((d) => {
      const name = t('onboarding.products.groupDefaultName', { number: d.groups.length + 1 })
      const key = newKey('g')
      return {
        ...d,
        groups: [
          ...d.groups,
          {
            key,
            id: idFromName(name, idsExcept(d, key)),
            idTouched: false,
            idLocked: false,
            name,
            products: []
          }
        ]
      }
    })

  return (
    <Flex vertical gap={8}>
      {draft.groups.map((group) => (
        <Flex key={group.key} gap={8} align="start" wrap>
          <Input
            size="small"
            style={{ width: 200 }}
            placeholder={t('onboarding.products.groupNamePlaceholder')}
            value={group.name}
            onChange={(event) => patch(group.key, (g) => rename(draft, g, event.target.value))}
          />
          <div style={{ width: 180 }}>
            <IdInput
              draft={draft}
              item={group}
              onChange={(id) => patch(group.key, (g) => ({ ...g, id, idTouched: true }))}
            />
          </div>
          <Select
            size="small"
            mode="multiple"
            style={{ flex: 1, minWidth: 240 }}
            placeholder={t('onboarding.products.groupProductsPlaceholder')}
            options={productOptions}
            value={group.products.filter((key) => productOptions.some((o) => o.value === key))}
            status={group.products.length < 2 ? 'error' : undefined}
            onChange={(products: string[]) => patch(group.key, (g) => ({ ...g, products }))}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('onboarding.products.removeGroup')}
            onClick={() =>
              update((d) => ({ ...d, groups: d.groups.filter((g) => g.key !== group.key) }))
            }
          />
        </Flex>
      ))}
      <div>
        <Button size="small" icon={<PlusOutlined />} onClick={add}>
          {t('onboarding.products.addGroup')}
        </Button>
      </div>
    </Flex>
  )
}

/** RN-GLB-17: um Produto que já está numa Squad não aparece para as outras. */
function SquadEditor({ draft, update }: StepProps): React.JSX.Element {
  const patch = (key: string, change: (s: SquadDraft) => SquadDraft): void =>
    update((d) => ({ ...d, squads: d.squads.map((s) => (s.key === key ? change(s) : s)) }))
  const products = activeProducts(draft)
  const missing = productsWithoutSquad(draft)

  const add = (): void =>
    update((d) => {
      const name = t('onboarding.products.squadDefaultName', { number: d.squads.length + 1 })
      const key = newKey('s')
      return {
        ...d,
        squads: [
          ...d.squads,
          {
            key,
            id: idFromName(name, idsExcept(d, key)),
            idTouched: false,
            idLocked: false,
            name,
            products: [],
            color: paletteColor(d.squads.length),
            kept: { capacityDefaults: undefined }
          }
        ]
      }
    })

  return (
    <Flex vertical gap={8}>
      {draft.squads.map((squad) => {
        const elsewhere = new Set(
          draft.squads.filter((s) => s.key !== squad.key).flatMap((s) => s.products)
        )
        const options = products
          .filter((p) => !elsewhere.has(p.key))
          .map((p) => ({ value: p.key, label: p.name }))
        return (
          <Flex key={squad.key} gap={8} align="start" wrap>
            <Input
              size="small"
              style={{ width: 200 }}
              placeholder={t('onboarding.products.squadNamePlaceholder')}
              value={squad.name}
              onChange={(event) => patch(squad.key, (s) => rename(draft, s, event.target.value))}
            />
            <ColorPicker
              size="small"
              disabledAlpha
              allowClear
              aria-label={t('onboarding.products.squadColor')}
              value={squad.color ?? null}
              onChangeComplete={(color) =>
                patch(squad.key, (s) => ({ ...s, color: color.toHexString().toUpperCase() }))
              }
              onClear={() => patch(squad.key, (s) => ({ ...s, color: undefined }))}
            />
            <div style={{ width: 180 }}>
              <IdInput
                draft={draft}
                item={squad}
                onChange={(id) => patch(squad.key, (s) => ({ ...s, id, idTouched: true }))}
              />
            </div>
            <Select
              size="small"
              mode="multiple"
              style={{ flex: 1, minWidth: 240 }}
              placeholder={t('onboarding.products.squadProductsPlaceholder')}
              options={options}
              value={squad.products.filter((key) => options.some((o) => o.value === key))}
              status={squad.products.length < 1 ? 'error' : undefined}
              onChange={(next: string[]) => patch(squad.key, (s) => ({ ...s, products: next }))}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              aria-label={t('onboarding.products.removeSquad')}
              onClick={() =>
                update((d) => ({ ...d, squads: d.squads.filter((s) => s.key !== squad.key) }))
              }
            />
          </Flex>
        )
      })}
      {missing.length > 0 && (
        <Text type="danger" style={{ fontSize: 12 }}>
          {t('onboarding.products.withoutSquad', { names: missing.map((p) => p.name).join(', ') })}
        </Text>
      )}
      <div>
        <Button size="small" icon={<PlusOutlined />} onClick={add}>
          {t('onboarding.products.addSquad')}
        </Button>
      </div>
    </Flex>
  )
}

export function ProductsStep(props: StepProps): React.JSX.Element {
  return (
    <>
      <Paragraph type="secondary">{t('onboarding.products.intro')}</Paragraph>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title={t('onboarding.products.idWarningTitle')}
        description={t('onboarding.products.idWarningText')}
      />
      <ProductTable {...props} />

      <Title level={5} style={{ marginTop: 24 }}>
        {t('onboarding.products.groupsTitle')}
      </Title>
      <Paragraph type="secondary">{t('onboarding.products.groupsIntro')}</Paragraph>
      <GroupEditor {...props} />

      <Title level={5} style={{ marginTop: 24 }}>
        {t('onboarding.products.squadsTitle')}
      </Title>
      <Paragraph type="secondary">{t('onboarding.products.squadsIntro')}</Paragraph>
      <SquadEditor {...props} />
    </>
  )
}
