import { Button, Flex, Form, Input, InputNumber, Select, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { Configuration } from '@shared/config/schema'
import { t } from '../../../i18n'
import type { StepProps } from './types'

const { Paragraph, Text } = Typography

type Calendar = Configuration['calendar']
type Holiday = Calendar['extraHolidays'][number]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Soma das faixas válidas, para mostrar o teto das horas produtivas. */
function workingHoursTotal(calendar: Calendar): number {
  const total = calendar.workingHours
    .filter((r) => TIME.test(r.start) && TIME.test(r.end))
    .reduce((sum, r) => sum + Math.max(0, minutes(r.end) - minutes(r.start)), 0)
  return Math.round((total / 60) * 100) / 100
}

export function CalendarStep({ draft, update }: StepProps): React.JSX.Element {
  const calendar = draft.calendar
  const set = (change: (c: Calendar) => Calendar): void =>
    update((d) => ({ ...d, calendar: change(d.calendar) }))

  const setHoliday = (index: number, holiday: Holiday): void =>
    set((c) => ({
      ...c,
      extraHolidays: c.extraHolidays.map((h, i) => (i === index ? holiday : h))
    }))

  return (
    <Form layout="vertical" component="div">
      <Paragraph type="secondary">{t('onboarding.calendar.intro')}</Paragraph>

      <Form.Item
        label={t('onboarding.calendar.country')}
        extra={t('onboarding.calendar.countryHint')}
      >
        <Select
          allowClear
          style={{ width: 240 }}
          placeholder={t('onboarding.calendar.countryPlaceholder')}
          options={[{ value: 'BR', label: t('onboarding.calendar.brazil') }]}
          value={calendar.country}
          onChange={(country?: 'BR') => set((c) => ({ ...c, country }))}
        />
      </Form.Item>

      <Form.Item
        label={t('onboarding.calendar.extraHolidays')}
        extra={t('onboarding.calendar.extraHolidaysHint')}
      >
        <Flex vertical gap={8}>
          {calendar.extraHolidays.map((holiday, index) => {
            const recurring = 'monthDay' in holiday
            return (
              <Flex key={index} gap={8} align="center" wrap>
                <Select
                  style={{ width: 170 }}
                  value={recurring ? 'monthDay' : 'date'}
                  options={[
                    { value: 'monthDay', label: t('onboarding.calendar.everyYear') },
                    { value: 'date', label: t('onboarding.calendar.singleDate') }
                  ]}
                  onChange={(kind: 'monthDay' | 'date') =>
                    setHoliday(
                      index,
                      kind === 'monthDay'
                        ? { monthDay: '', name: holiday.name }
                        : { date: '', name: holiday.name }
                    )
                  }
                />
                <Input
                  style={{ width: 140 }}
                  placeholder={
                    recurring
                      ? t('onboarding.calendar.monthDayPlaceholder')
                      : t('onboarding.calendar.datePlaceholder')
                  }
                  value={recurring ? holiday.monthDay : holiday.date}
                  onChange={(event) => {
                    const value = event.target.value.trim()
                    setHoliday(
                      index,
                      recurring
                        ? { monthDay: value, name: holiday.name }
                        : { date: value, name: holiday.name }
                    )
                  }}
                />
                <Input
                  style={{ flex: 1, minWidth: 200 }}
                  placeholder={t('onboarding.calendar.holidayNamePlaceholder')}
                  value={holiday.name}
                  onChange={(event) => setHoliday(index, { ...holiday, name: event.target.value })}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t('onboarding.calendar.removeHoliday')}
                  onClick={() =>
                    set((c) => ({
                      ...c,
                      extraHolidays: c.extraHolidays.filter((_, i) => i !== index)
                    }))
                  }
                />
              </Flex>
            )
          })}
          <div>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() =>
                set((c) => ({
                  ...c,
                  extraHolidays: [...c.extraHolidays, { monthDay: '', name: '' }]
                }))
              }
            >
              {t('onboarding.calendar.addHoliday')}
            </Button>
          </div>
        </Flex>
      </Form.Item>

      <Form.Item
        label={t('onboarding.calendar.workingHours')}
        extra={t('onboarding.calendar.workingHoursHint')}
      >
        <Flex vertical gap={8}>
          {calendar.workingHours.map((range, index) => (
            <Flex key={index} gap={8} align="center">
              {(['start', 'end'] as const).map((edge) => (
                <Input
                  key={edge}
                  style={{ width: 100 }}
                  placeholder={edge === 'start' ? '09:00' : '12:00'}
                  status={TIME.test(range[edge]) ? undefined : 'error'}
                  value={range[edge]}
                  onChange={(event) =>
                    set((c) => ({
                      ...c,
                      workingHours: c.workingHours.map((r, i) =>
                        i === index ? { ...r, [edge]: event.target.value.trim() } : r
                      )
                    }))
                  }
                />
              ))}
              {calendar.workingHours.length > 1 && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t('onboarding.calendar.removeRange')}
                  onClick={() =>
                    set((c) => ({
                      ...c,
                      workingHours: c.workingHours.filter((_, i) => i !== index)
                    }))
                  }
                />
              )}
            </Flex>
          ))}
          <div>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() =>
                set((c) => ({
                  ...c,
                  workingHours: [...c.workingHours, { start: '', end: '' }]
                }))
              }
            >
              {t('onboarding.calendar.addRange')}
            </Button>
          </div>
        </Flex>
      </Form.Item>

      <Form.Item
        label={t('onboarding.calendar.productiveHours')}
        extra={
          <Text type="secondary">
            {t('onboarding.calendar.productiveHoursHint', { hours: workingHoursTotal(calendar) })}
          </Text>
        }
      >
        <InputNumber
          min={0.5}
          max={24}
          step={0.5}
          value={calendar.productiveHoursPerDay}
          onChange={(value) =>
            set((c) => ({ ...c, productiveHoursPerDay: value ?? c.productiveHoursPerDay }))
          }
        />
      </Form.Item>
    </Form>
  )
}
