import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Input, Modal, Spin, Tag, Typography, message } from 'antd'
import {
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LoadingOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { useQueries } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { PutRolesIdPermissionsBody } from '@/api/models/putRolesIdPermissionsBody'
import {
  getGetRolesIdPermissionsQueryOptions,
  getGetRolesIdPermissionsQueryKey,
  getGetRolesQueryKey,
  useDeleteRolesId,
  useGetPermissions,
  useGetRoles,
  usePostRoles,
  usePutRolesId,
  usePutRolesIdPermissions,
} from '@/api/endpoints/roles'
import { useQueryClient } from '@tanstack/react-query'

interface RoleRow {
  id: string
  role_name: string
  description?: string | null
  [k: string]: unknown
}
interface PermRow {
  id: string
  key: string
  module: string
  description?: string
}

const SYSTEM_ROLES = ['Admin']

/** Nhãn tiếng Việt cho module quyền (fallback: chính key module). */
const MODULE_LABELS: Record<string, string> = {
  academy: 'Học viện',
  appointment: 'Lịch hẹn',
  branch: 'Cơ sở',
  card_rank: 'Hạng thẻ',
  customer: 'Khách hàng',
  custom_field: 'Trường tùy chỉnh',
  day_off: 'Ngày nghỉ',
  lookup: 'Danh mục chọn',
  membership: 'Thành viên & Điểm',
  notification: 'Thông báo',
  package_type: 'Loại gói liệu trình',
  permission: 'Phân quyền',
  report: 'Báo cáo',
  reward: 'Quà đổi điểm',
  schedule: 'Lịch làm việc',
  service: 'Dịch vụ',
  setting: 'Cấu hình',
  shift_template: 'Ca làm',
  treatment_package: 'Gói liệu trình',
  voucher: 'Voucher',
  wheel: 'Vòng quay may mắn',
}

/** Nhãn tiếng Việt cho action; vài cặp (module, action) cần nhãn riêng. */
const ACTION_LABELS: Record<string, string> = {
  create: 'Thêm mới',
  read: 'Xem',
  update: 'Sửa',
  delete: 'Xóa',
  approve: 'Duyệt',
  start: 'Bắt đầu',
  export: 'Xuất dữ liệu',
  all: 'Toàn bộ cơ sở',
  manage: 'Quản lý',
  points_adjust: 'Điều chỉnh điểm',
  rank_override: 'Gán hạng',
  recalculate: 'Tính lại hạng',
  redeem_admin: 'Đổi hộ khách',
  spin_admin: 'Quản lý lượt quay',
  revenue: 'Doanh thu',
  debt: 'Công nợ',
  customer: 'Khách hàng',
  rank: 'Hạng thẻ',
  appointment: 'Lịch hẹn',
  session: 'Buổi điều trị',
  commission: 'Hoa hồng',
}
const ACTION_OVERRIDES: Record<string, string> = {
  'report.customer': 'Khách mới',
  'report.read': 'Báo cáo tổng hợp',
  'report.rank': 'Cơ cấu hạng thẻ',
  'report.session': 'Buổi đã sử dụng',
}

const moduleLabel = (module: string) => MODULE_LABELS[module] ?? module
const actionLabel = (key: string, action: string) => ACTION_OVERRIDES[key] ?? ACTION_LABELS[action] ?? action

export default function Roles() {
  const queryClient = useQueryClient()
  const rolesQuery = useGetRoles()
  const permissionsQuery = useGetPermissions()
  const createRoleMutation = usePostRoles()
  const updateRoleMutation = usePutRolesId()
  const deleteRoleMutation = useDeleteRolesId()
  const setPermissionsMutation = usePutRolesIdPermissions()

  // Legacy envelope: responseData = { count, rows, totalPages, currentPage }
  const roles = (pickData<{ rows?: RoleRow[] }>(rolesQuery.data)?.rows ?? []) as RoleRow[]
  const totalRoles = pickData<{ count?: number }>(rolesQuery.data)?.count ?? roles.length
  const permissionsPayload = pickData<PermRow[] | { rows?: PermRow[] }>(permissionsQuery.data)
  const perms = (
    Array.isArray(permissionsPayload) ? permissionsPayload : permissionsPayload?.rows ?? []
  ) as PermRow[]

  const rolePermissionQueries = useQueries({
    queries: roles.map((role) => getGetRolesIdPermissionsQueryOptions(role.id)),
  })
  const permCountByRole = new Map<string, number>(
    roles.map((role, index) => {
      const keys = (pickData<string[]>(rolePermissionQueries[index]?.data) ?? []) as string[]
      return [role.id, Array.isArray(keys) ? keys.length : 0]
    }),
  )

  const loading = rolesQuery.isLoading || permissionsQuery.isLoading
  const loadError = rolesQuery.error ?? permissionsQuery.error
  const permsEmpty = permissionsQuery.isSuccess && perms.length === 0

  // Dialog sửa vai trò
  const [editOpen, setEditOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleDescription, setRoleDescription] = useState('')

  // Dialog phân quyền
  const [permOpen, setPermOpen] = useState(false)
  const [permRole, setPermRole] = useState<RoleRow | null>(null)
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savingPerm, setSavingPerm] = useState(false)

  const groups = useMemo(() => {
    const map = new Map<string, PermRow[]>()
    perms.forEach((p) => {
      const list = map.get(p.module) ?? []
      list.push(p)
      map.set(p.module, list)
    })
    return [...map.entries()].map(([module, rows]) => ({ module, rows }))
  }, [perms])
  const totalPerms = perms.length

  const openCreate = () => {
    setEditingRole(null)
    setRoleName('')
    setRoleDescription('')
    setEditOpen(true)
  }
  const openEdit = (role: RoleRow) => {
    setEditingRole(role)
    setRoleName(role.role_name)
    setRoleDescription(role.description ?? '')
    setEditOpen(true)
  }
  const openPermissions = (role: RoleRow) => {
    const cached = queryClient.getQueryData<string>(getGetRolesIdPermissionsQueryKey(role.id))
    const keys = (pickData<string[]>(cached as unknown as unknown[]) ?? []) as string[]
    setPermRole(role)
    setGranted(new Set(Array.isArray(keys) ? keys : []))
    setPermOpen(true)
  }

  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: getGetRolesQueryKey() })

  const saveRole = async () => {
    if (!roleName.trim()) {
      message.warning('Nhập tên vai trò')
      return
    }
    setSaving(true)
    try {
      if (editingRole) {
        await updateRoleMutation.mutateAsync({
          id: editingRole.id,
          data: { role_name: roleName.trim(), description: roleDescription.trim() || undefined },
        })
        message.success('Đã cập nhật vai trò')
      } else {
        await createRoleMutation.mutateAsync({
          data: { role_name: roleName.trim(), description: roleDescription.trim() || undefined },
        })
        message.success('Đã tạo vai trò mới')
      }
      setEditOpen(false)
      await invalidateRoles()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể lưu vai trò'))
    } finally {
      setSaving(false)
    }
  }

  const togglePerm = (key: string, checked: boolean) => {
    setGranted((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }
  const setModulePerms = (module: string, checked: boolean) => {
    setGranted((prev) => {
      const next = new Set(prev)
      perms
        .filter((p) => p.module === module)
        .forEach((p) => (checked ? next.add(p.key) : next.delete(p.key)))
      return next
    })
  }
  const setAllPerms = (checked: boolean) => {
    setGranted(checked ? new Set(perms.map((p) => p.key)) : new Set())
  }

  const savePermissions = async () => {
    if (!permRole) return
    setSavingPerm(true)
    try {
      await setPermissionsMutation.mutateAsync({
        id: permRole.id,
        data: { permissions: [...granted] } as unknown as PutRolesIdPermissionsBody,
      })
      message.success('Đã cập nhật quyền hạn')
      queryClient.removeQueries({ queryKey: getGetRolesIdPermissionsQueryKey(permRole.id) })
      setPermOpen(false)
      await invalidateRoles()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể lưu quyền hạn'))
    } finally {
      setSavingPerm(false)
    }
  }

  const confirmDelete = async (role: RoleRow) => {
    setSaving(true)
    try {
      await deleteRoleMutation.mutateAsync({ id: role.id })
      message.success('Đã xóa vai trò')
      await invalidateRoles()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể xóa vai trò'))
    } finally {
      setSaving(false)
    }
  }

  const askDelete = (role: RoleRow) => {
    Modal.confirm({
      title: 'Xóa vai trò',
      content: (
        <p className="pt-2 text-sm text-slate-600">
          Bạn chắc chắn muốn xóa vai trò <strong>{role.role_name}</strong>? Hành động này không thể
          hoàn tác — các tài khoản đang gán vai trò này sẽ mất quyền truy cập tương ứng.
        </p>
      ),
      okText: 'Xóa vai trò',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: () => confirmDelete(role),
    })
  }

  const allChecked = totalPerms > 0 && granted.size === totalPerms
  const someChecked = granted.size > 0 && !allChecked

  return (
    <>
      <PageTitle
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="rounded-xl"
            onClick={openCreate}
          >
            Tạo vai trò mới
          </Button>
        }
      >
        Phân quyền
      </PageTitle>

      <div className="mb-5">
        <p className="m-0 text-sm text-slate-600">
          Quản lý vai trò và phân quyền cho người dùng ({totalRoles} vai trò)
        </p>
      </div>

      {loadError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải đủ danh sách vai trò và quyền"
          description={errorMessage(loadError)}
          action={<Button size="small" onClick={() => void rolesQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {!loadError && permsEmpty && (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="Danh mục quyền đang trống"
          description="BE chưa trả về permission key nào; cần đồng bộ danh mục quyền trước khi phân quyền."
        />
      )}

      <Spin spinning={loading}>
        <div className="grid gap-4">
          {roles.map((role) => {
            const isSystem = SYSTEM_ROLES.includes(role.role_name)
            return (
              <div
                key={role.id}
                className="flex flex-col justify-between gap-4 rounded-[20px] border border-[var(--brand-border-soft)] bg-white p-5 transition-all hover:border-[var(--brand-border-strong)] hover:shadow-md max-sm:flex-col sm:flex-row sm:items-start"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[rgba(var(--brand-rgb),0.1)]">
                    <SafetyOutlined className="text-xl text-[var(--brand-primary)]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Typography.Text strong className="text-[15px] text-[var(--brand-dark)]">
                        {role.role_name}
                      </Typography.Text>
                      {isSystem && (
                        <Tag className="m-0 rounded-lg border-[var(--brand-border)] bg-[var(--brand-bg)] text-[11px] text-slate-600">
                          Hệ thống
                        </Tag>
                      )}
                      {role.receptionist === true && (
                        <Tag className="m-0 rounded-lg text-[11px]" color="processing">
                          Lễ tân
                        </Tag>
                      )}
                    </div>
                    <p className="mt-1 mb-0 text-sm text-slate-600">
                      {role.description || 'Không có mô tả'}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <KeyOutlined className="text-[12px]" />
                        {permCountByRole.get(role.id) ?? 0} quyền
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 max-sm:self-end">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    className="rounded-xl text-[var(--brand-primary)] hover:bg-[rgba(var(--brand-rgb),0.08)]!"
                    onClick={() => openEdit(role)}
                  >
                    Sửa
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<SafetyCertificateOutlined />}
                    className="rounded-xl text-emerald-700 hover:bg-emerald-50!"
                    onClick={() => openPermissions(role)}
                  >
                    Phân quyền
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    disabled={isSystem}
                    className="rounded-xl text-red-600 hover:bg-red-50! disabled:opacity-50"
                    onClick={() => askDelete(role)}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            )
          })}

          {roles.length === 0 && !loading && !loadError && (
            <div className="rounded-[20px] border border-[var(--brand-border-soft)] bg-[var(--brand-bg)] p-10 text-center text-slate-500">
              Chưa có vai trò nào
            </div>
          )}
        </div>
      </Spin>

      {/* Dialog tạo/sửa vai trò */}
      <Modal
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={() => void saveRole()}
        okText={editingRole ? 'Lưu thay đổi' : 'Tạo vai trò'}
        cancelText="Hủy"
        confirmLoading={saving}
        title={
          <span className="text-lg text-[var(--brand-dark)]">
            {editingRole ? 'Sửa vai trò' : 'Tạo vai trò mới'}
          </span>
        }
        okButtonProps={{ className: 'rounded-xl' }}
        cancelButtonProps={{ className: 'rounded-xl' }}
      >
        <div className="flex flex-col gap-4 pt-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Tên vai trò *</span>
            <Input
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="VD: Quản lý cơ sở"
              maxLength={100}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Mô tả</span>
            <Input.TextArea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Mô tả ngắn về vai trò này"
              rows={3}
              maxLength={255}
            />
          </label>
        </div>
      </Modal>

      {/* Dialog phân quyền */}
      <Modal
        open={permOpen}
        onCancel={() => setPermOpen(false)}
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
            <Button className="rounded-xl" onClick={() => setPermOpen(false)}>
              Hủy
            </Button>
            <Button
              type="primary"
              className="rounded-xl"
              icon={<CheckOutlined />}
              loading={savingPerm}
              disabled={permsEmpty || loading}
              onClick={() => void savePermissions()}
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
              onChange={(e) => setAllPerms(e.target.checked)}
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
            const checkedCount = group.rows.filter((p) => granted.has(p.key)).length
            const groupAll = group.rows.length > 0 && checkedCount === group.rows.length
            const groupSome = checkedCount > 0 && !groupAll
            return (
              <div key={group.module} className="rounded-xl border border-[var(--brand-border-soft)] bg-white p-4">
                <div className="flex items-center justify-between gap-4 border-b border-[var(--brand-border-soft)] pb-3">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={groupAll}
                      indeterminate={groupSome}
                      onChange={(e) => setModulePerms(group.module, e.target.checked)}
                    />
                    <span className="leading-tight">
                      <span className="block text-sm font-semibold text-[var(--brand-dark)]">
                        {moduleLabel(group.module)}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                        {group.module} · {checkedCount}/{group.rows.length}
                      </span>
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.rows.map((p) => {
                    const action = p.key.split('.').slice(1).join('.')
                    return (
                      <label key={p.id} className="flex cursor-pointer items-start gap-2" title={p.description}>
                        <Checkbox
                          className="mt-0.5"
                          checked={granted.has(p.key)}
                          onChange={(e) => togglePerm(p.key, e.target.checked)}
                        />
                        <span className="leading-tight">
                          <span className="block text-sm text-slate-800">{actionLabel(p.key, action)}</span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-400">
                            {p.key}
                          </span>
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

      {/* Xóa vai trò dùng Modal.confirm nhỏ — gọi trực tiếp trong askDelete */}
    </>
  )
}
