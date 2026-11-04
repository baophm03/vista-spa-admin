import { Button, Checkbox, Modal, Typography } from 'antd'
import { CheckOutlined, LoadingOutlined } from '@ant-design/icons'
import type { PermRow, RoleRow } from './constants'
import { actionLabel, moduleLabel } from './constants'
import { permKey } from '@/configs/permissions'

interface PermGroup {
  module: string
  rows: PermRow[]
}

interface RolePermissionModalProps {
  open: boolean
  permRole: RoleRow | null
  groups: PermGroup[]
  granted: Set<string>
  totalPerms: number
  loading: boolean
  permsEmpty: boolean
  savingPerm: boolean
  onCancel: () => void
  onSave: () => void
  onTogglePerm: (key: string, checked: boolean) => void
  onSetModulePerms: (module: string, checked: boolean) => void
  onSetAllPerms: (checked: boolean) => void
}

export default function RolePermissionModal({
  open,
  permRole,
  groups,
  granted,
  totalPerms,
  loading,
  permsEmpty,
  savingPerm,
  onCancel,
  onSave,
  onTogglePerm,
  onSetModulePerms,
  onSetAllPerms,
}: RolePermissionModalProps) {
  const allChecked = totalPerms > 0 && granted.size === totalPerms
  const someChecked = granted.size > 0 && !allChecked

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={960}
      styles={{ body: { paddingTop: 8 } }}
      title={
        <div>
          <div className="text-lg text-[var(--brand-dark)]">
            Phân quyền{permRole ? ` — ${permRole.role_name}` : ''}
          </div>
          <div className="text-xs font-normal text-slate-500">
            Chọn các quyền hạn áp dụng cho vai trò này
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button className="rounded-xl" onClick={onCancel}>
            Hủy
          </Button>
          <Button
            type="primary"
            className="rounded-xl"
            icon={<CheckOutlined />}
            loading={savingPerm}
            disabled={permsEmpty || loading}
            onClick={onSave}
          >
            Lưu quyền hạn
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between">
        <Typography.Text strong>Quyền hạn *</Typography.Text>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500">
            Đã chọn: {granted.size}/{totalPerms}
          </span>
          <Checkbox
            checked={allChecked}
            indeterminate={someChecked}
            onChange={(e) => onSetAllPerms(e.target.checked)}
          >
            <span className="text-sm font-medium text-[var(--brand-dark)]">Chọn tất cả</span>
          </Checkbox>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-[var(--brand-border-soft)] bg-[var(--brand-bg)] p-4">
        {loading && (
          <div className="flex items-center justify-center py-6 text-[var(--brand-primary)]">
            <LoadingOutlined className="text-xl" />
          </div>
        )}
        {!loading && groups.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">Không tải được danh sách quyền</p>
        )}
        {groups.map((group) => {
          const checkedCount = group.rows.filter((p) => granted.has(permKey(p.module, p.action))).length
          const groupAll = group.rows.length > 0 && checkedCount === group.rows.length
          const groupSome = checkedCount > 0 && !groupAll
          return (
            <div key={group.module} className="rounded-xl border border-[var(--brand-border-soft)] bg-white p-4">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border-soft)] pb-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <Checkbox
                    checked={groupAll}
                    indeterminate={groupSome}
                    onChange={(e) => onSetModulePerms(group.module, e.target.checked)}
                  />
                  <span className="leading-tight">
                    <span className="block text-sm font-semibold text-[var(--brand-dark)]">
                      {moduleLabel(group.module)}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                      Đã bật {checkedCount}/{group.rows.length} quyền
                    </span>
                  </span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.rows.map((p) => {
                  return (
                    <label key={p.id} className="flex min-w-0 cursor-pointer items-start gap-2">
                      <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={granted.has(permKey(p.module, p.action))}
                        onChange={(e) => onTogglePerm(permKey(p.module, p.action), e.target.checked)}
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block text-sm text-slate-800">{actionLabel(p)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
