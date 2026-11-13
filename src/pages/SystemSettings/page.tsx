import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Select, Spin, Tabs, Tag, Typography, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
import SystemSettingField from '@/components/settings/SystemSettingField'
import { sameSettingValue, settingSections } from '@/components/settings/systemSettings'
import type { SystemSetting, SystemSettingUpdate } from '@/components/settings/systemSettings'
import { getGetSettingsQueryKey, getSettings, putSettings } from '@/api/endpoints/settings'
import { getGetAppConfigQueryKey } from '@/api/endpoints/app'
import { useGetBranches } from '@/api/endpoints/branches'
import type { Branch } from '@/api/models/branch'
import type { PutSettingsBody } from '@/api/models/putSettingsBody'
import { errorMessage, pickData } from '@/api/helpers'
import { ability } from '@/configs/casl/ability'

const EMPTY_SETTINGS: SystemSetting[] = []
const POINTS_SETTING_ORDER: Record<string, number> = {
  'points.enabled': 0,
  'points.auto_earn': 1,
  'points.earn_amount': 2,
  'points.point_value': 3,
  'points.redeem_min_percent': 4,
  'points.redeem_max_percent': 5,
  'points.redeem_balance_max_percent': 6,
}
const POINTS_SETTING_GROUPS = [
  {
    key: 'earning',
    label: 'Tích điểm',
    settingKeys: ['points.enabled', 'points.auto_earn', 'points.earn_amount', 'points.point_value'],
  },
  {
    key: 'redemption',
    label: 'Giới hạn đổi điểm',
    settingKeys: ['points.redeem_min_percent', 'points.redeem_max_percent', 'points.redeem_balance_max_percent'],
  },
] as const
const POINTS_SETTING_ROWS = [
  ['points.enabled', 'points.redeem_min_percent'],
  ['points.auto_earn', 'points.redeem_max_percent'],
  ['points.earn_amount', 'points.redeem_balance_max_percent'],
  ['points.point_value', null],
] as const
const BOOKING_SETTING_ROWS = [
  ['booking.auto_approve', 'booking.horizon_days'],
  ['booking.min_cancel_hours', 'booking.pending_expire_hours'],
  ['booking.require_staff_service', 'booking.slot_minutes'],
  ['reminder.next_session_days', 'reminder.offsets_days'],
  ['reminder.send_time', 'job.birthday_time'],
] as const
const MEMBER_SETTING_COLUMNS = [
  {
    label: 'Thông tin khách hàng',
    settingKeys: ['customer_code.format', 'customer_code.regen_on_rank_up', 'customer.shared_across_branches'],
  },
  {
    label: 'Xếp hạng hội viên',
    settingKeys: ['rank.metric', 'rank.period', 'rank.boundary', 'rank.downgrade', 'rank.near_percent'],
  },
] as const

function sourceLabel(setting: SystemSetting) {
  if (setting.is_overridden) return 'Đang dùng cấu hình riêng của cơ sở'
  if (setting.source_scope === 'GLOBAL') return 'Đang kế thừa cấu hình toàn hệ thống'
  return 'Đang dùng giá trị mặc định'
}

function SettingsEditor({ canEdit }: { canEdit: boolean }) {
  const [branchId, setBranchId] = useState('')
  const [draftState, setDraftState] = useState<{ scope: string; values: Record<string, unknown> } | null>(null)
  const queryClient = useQueryClient()
  const canSelectBranch = ability.can('READ', 'BRANCH')
  const branchesQuery = useGetBranches(undefined, { query: { enabled: canSelectBranch } })
  const params = branchId ? { branch_id: branchId } : undefined
  const settingsQuery = useQuery({
    queryKey: getGetSettingsQueryKey(params),
    queryFn: async () => pickData<SystemSetting[]>(await getSettings(params)) ?? [],
  })
  const settings = settingsQuery.data ?? EMPTY_SETTINGS
  const branches = pickData<Branch[]>(branchesQuery.data) ?? []
  const scope = branchId || 'GLOBAL'
  const serverValues = useMemo(() => Object.fromEntries(settings.map((setting) => [setting.key, setting.value])), [settings])
  const draft = draftState?.scope === scope ? draftState.values : serverValues

  const updateDraft = (key: string, value: unknown) => {
    setDraftState((current) => {
      const values = current?.scope === scope ? current.values : serverValues
      return { scope, values: { ...values, [key]: value } }
    })
  }

  const changedSettings = useMemo(() => settings.filter((setting) =>
    !sameSettingValue(draft[setting.key], setting.value) && (!branchId || setting.branch_allowed),
  ), [settings, draft, branchId])

  const saveMutation = useMutation({
    mutationFn: async (items: SystemSettingUpdate[]) => putSettings({ items } as unknown as PutSettingsBody),
    onSuccess: async () => {
      message.success('Đã lưu cấu hình hệ thống')
      await queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() })
      await queryClient.invalidateQueries({ queryKey: getGetAppConfigQueryKey() })
    },
    onError: (error) => message.error(errorMessage(error)),
  })

  const save = () => {
    const items = changedSettings.map((setting) => ({
      key: setting.key,
      value: draft[setting.key],
      ...(branchId ? { branch_id: branchId } : {}),
    }))
    if (items.length) saveMutation.mutate(items)
  }

  const tabs = settingSections.map((section) => {
    const sectionSettings = settings
      .filter((setting) => ![
        'label.brand',
        'treatment.expiry_policy',
        'session.required_fields',
        'lucky_wheel.customer_default_enabled',
        'lucky_wheel.customer_overrides',
      ].includes(setting.key)
        && (section.groups as readonly string[]).includes(setting.group))
      .sort((a, b) => {
        if (a.key === b.key) return 0
        if (section.key === 'points') {
          const orderDifference = (POINTS_SETTING_ORDER[a.key] ?? Number.MAX_SAFE_INTEGER)
            - (POINTS_SETTING_ORDER[b.key] ?? Number.MAX_SAFE_INTEGER)
          if (orderDifference !== 0) return orderDifference
        }
        return a.key.localeCompare(b.key)
      })
    const fields = sectionSettings.map((setting) => (
      <div
        key={setting.key}
        className={section.key === 'modules' ? 'h-full border-b border-[var(--brand-border)]' : undefined}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {branchId && <Typography.Text type="secondary" className="text-xs!">{sourceLabel(setting)}</Typography.Text>}
          {branchId && !setting.branch_allowed && <Tag>Chỉ sửa toàn hệ thống</Tag>}
        </div>
        <SystemSettingField
          setting={setting}
          value={draft[setting.key]}
          disabled={!canEdit || (Boolean(branchId) && !setting.branch_allowed)}
          alignControlsRight={['payment', 'commission', 'discount', 'academy', 'lucky_wheel'].includes(setting.group)
            || section.key === 'modules' || section.key === 'booking' || section.key === 'member'}
          onChange={(value) => updateDraft(setting.key, value)}
        />
      </div>
    ))
    const fieldsByKey = new Map(sectionSettings.map((setting, index) => [setting.key, fields[index]]))
    const mobilePointsContent = POINTS_SETTING_GROUPS.map((group) => {
      const groupFields = group.settingKeys.map((key) => fieldsByKey.get(key)).filter(Boolean)
      if (!groupFields.length) return null
      return (
        <section key={group.key}>
          <Typography.Title level={5} className="mb-2!">{group.label}</Typography.Title>
          <div className="divide-y divide-[var(--brand-border)]">{groupFields}</div>
        </section>
      )
    })
    const desktopPointsContent = [
      <Typography.Title key="earning-title" level={5} className="mb-2!">Tích điểm</Typography.Title>,
      <Typography.Title key="redemption-title" level={5} className="mb-2!">Giới hạn đổi điểm</Typography.Title>,
      ...POINTS_SETTING_ROWS.flatMap(([leftKey, rightKey]) => [
        <div key={`${leftKey}-left`} className="min-w-0 border-b border-[var(--brand-border)]">
          {fieldsByKey.get(leftKey)}
        </div>,
        ...(rightKey ? [
          <div key={`${leftKey}-right`} className="min-w-0 border-b border-[var(--brand-border)]">
            {fieldsByKey.get(rightKey)}
          </div>,
        ] : []),
      ]),
    ]
    const desktopBookingContent = BOOKING_SETTING_ROWS.flatMap(([leftKey, rightKey]) => [
      <div key={`${leftKey}-left`} className="h-full border-b border-[var(--brand-border)]">
        {fieldsByKey.get(leftKey)}
      </div>,
      <div key={`${leftKey}-right`} className="h-full border-b border-[var(--brand-border)]">
        {fieldsByKey.get(rightKey)}
      </div>,
    ])
    const memberColumnsContent = MEMBER_SETTING_COLUMNS.map((column) => {
      const columnFields = column.settingKeys.map((key) => fieldsByKey.get(key)).filter(Boolean)
      if (!columnFields.length) return null
      return (
        <section key={column.label}>
          <Typography.Title level={5} className="mb-2!">{column.label}</Typography.Title>
          <div>
            {column.settingKeys.map((key) => fieldsByKey.has(key) ? (
              <div key={key} className="min-w-0 border-b border-[var(--brand-border)]">
                {fieldsByKey.get(key)}
              </div>
            ) : null)}
          </div>
        </section>
      )
    })
    const subsections = 'subsections' in section ? section.subsections : undefined
    const subsectionContent = subsections?.map((subsection) => {
      const subsectionSettings = sectionSettings.filter((setting) => (subsection.groups as readonly string[]).includes(setting.group))
      if (subsection.key === 'academy') {
        subsectionSettings.sort((a, b) => {
          if (a.key === 'academy.returning_discount_percent') return -1
          if (b.key === 'academy.returning_discount_percent') return 1
          return a.key.localeCompare(b.key)
        })
      }
      if (!subsectionSettings.length) return null
      return (
        <section key={subsection.key}>
          <Typography.Title level={5} className="mb-2!">{subsection.label}</Typography.Title>
          <div>{subsectionSettings.map((setting) => fieldsByKey.get(setting.key))}</div>
        </section>
      )
    })
    const visibleSubsections = subsectionContent?.filter(Boolean) ?? []
    return {
      key: section.key,
      label: section.label,
      children: sectionSettings.length ? (
        section.key === 'points' ? (
          <Card>
            <div className="space-y-6 xl:hidden">{mobilePointsContent}</div>
            <div className="hidden xl:grid xl:grid-cols-2 xl:gap-x-8">{desktopPointsContent}</div>
          </Card>
        ) : section.key === 'booking' ? (
          <Card>
            <div className="divide-y divide-[var(--brand-border)] xl:hidden">
              {fields.map((field, index) => <div key={index} className="py-5 first:pt-0 last:pb-0">{field}</div>)}
            </div>
            <div className="hidden xl:grid xl:grid-cols-2 xl:gap-x-8">{desktopBookingContent}</div>
          </Card>
        ) : section.key === 'member' ? (
          <Card>
            <div className="divide-y divide-[var(--brand-border)] xl:hidden">
              {memberColumnsContent.map((content, index) => content && (
                <div key={index} className="py-5 first:pt-0 last:pb-0">{content}</div>
              ))}
            </div>
            <div className="hidden xl:grid xl:grid-cols-2 xl:gap-x-8">{memberColumnsContent}</div>
          </Card>
        ) : section.key === 'modules' ? (
          <Card><div className="grid grid-cols-1 gap-x-8 xl:grid-cols-2">{fields}</div></Card>
        ) : subsections ? (
          <Card>
            <div className="divide-y divide-[var(--brand-border)] xl:hidden">
              {visibleSubsections.map((content, index) => (
                <div key={index} className="py-5 first:pt-0 last:pb-0">{content}</div>
              ))}
            </div>
            <div className="hidden xl:block">
              <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-x-8">
                {visibleSubsections[0]}
                <div className="bg-[var(--brand-border)]" />
                {visibleSubsections[1]}
              </div>
              <div className="my-6 h-px bg-[var(--brand-border)]" />
              <div className="grid grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-x-8">
                {visibleSubsections[2]}
                <div className="bg-[var(--brand-border)]" />
                {visibleSubsections[3]}
              </div>
            </div>
          </Card>
        ) : <Card>{fields}</Card>
      ) : <Card><Typography.Text type="secondary">Nhóm này chưa có cấu hình.</Typography.Text></Card>,
    }
  })

  return (
    <>
      <PageTitle
        subtitle="Thiết lập vận hành của hệ thống"
        right={canEdit ? <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} disabled={!changedSettings.length || settingsQuery.isLoading} onClick={save}>Lưu cấu hình</Button> : undefined}
      >
        Cài đặt hệ thống
      </PageTitle>
      {!canEdit && <Alert className="mb-4" type="info" showIcon message="Bạn có quyền xem cấu hình; cần quyền cập nhật để chỉnh sửa." />}
      <Card className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Typography.Text strong>Phạm vi cấu hình</Typography.Text>
            <div><Typography.Text type="secondary">Cơ sở có thể ghi đè một số cấu hình được cho phép.</Typography.Text></div>
          </div>
          {canSelectBranch && (
            <Select
              className="w-full sm:w-80"
              value={branchId || undefined}
              placeholder="Toàn hệ thống"
              options={[
                { value: '', label: 'Toàn hệ thống' },
                ...branches.map((branch) => ({ value: branch.id, label: `${branch.name} (${branch.code})` })),
              ]}
              onChange={(value) => setBranchId(value)}
              aria-label="Chọn phạm vi cấu hình"
            />
          )}
        </div>
      </Card>
      {settingsQuery.isError && <Alert className="mb-2! mt-2!" type="error" showIcon message="Không tải được cấu hình hệ thống" description={errorMessage(settingsQuery.error)} action={<Button size="small" onClick={() => void settingsQuery.refetch()}>Thử lại</Button>} />}
      {branchId && <Alert className="mb-2! mt-2!" type="info" showIcon message="Cấu hình cơ sở" description="Các khóa được phép sẽ lưu thành giá trị riêng của cơ sở. Khóa còn lại chỉ xem theo cấu hình đang có hiệu lực." />}
      <Spin spinning={settingsQuery.isLoading || branchesQuery.isLoading}>
        <Tabs items={tabs} destroyInactiveTabPane={false} />
      </Spin>
    </>
  )
}

export default function SystemSettings() {
  return <Can I="UPDATE" a="SETTING" passThrough>{({ isAllowed }) => <SettingsEditor canEdit={isAllowed} />}</Can>
}
