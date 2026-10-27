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
import { ability } from '@/config/casl/ability'

const EMPTY_SETTINGS: SystemSetting[] = []

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
      .filter((setting) => (section.groups as readonly string[]).includes(setting.group))
      .sort((a, b) => a.key.localeCompare(b.key))
    return {
      key: section.key,
      label: section.label,
      children: sectionSettings.length ? (
        <Card>
          {sectionSettings.map((setting) => (
            <div key={setting.key}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {branchId && <Typography.Text type="secondary" className="text-xs!">{sourceLabel(setting)}</Typography.Text>}
                {branchId && !setting.branch_allowed && <Tag>Chỉ sửa toàn hệ thống</Tag>}
              </div>
              <SystemSettingField
                setting={setting}
                value={draft[setting.key]}
                disabled={!canEdit || (Boolean(branchId) && !setting.branch_allowed)}
                onChange={(value) => updateDraft(setting.key, value)}
              />
            </div>
          ))}
        </Card>
      ) : <Card><Typography.Text type="secondary">Nhóm này chưa có cấu hình.</Typography.Text></Card>,
    }
  })

  return (
    <>
      <PageTitle extra={canEdit ? <Button type="primary" icon={<SaveOutlined />} loading={saveMutation.isPending} disabled={!changedSettings.length || settingsQuery.isLoading} onClick={save}>Lưu cấu hình</Button> : undefined}>
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
