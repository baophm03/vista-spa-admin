import { useMemo, useState } from 'react'
import { Alert, Button, Spin, Tag, Typography, message } from 'antd'
import {
  EditOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
} from '@ant-design/icons'
import { useQueries } from '@tanstack/react-query'
import MobileUI from '@/components/base/MobileUI'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { PutRolesIdPermissionsAdminBody } from '@/api/models/putRolesIdPermissionsAdminBody'
import { getGetRolesIdPermissionsAdminQueryOptions, getGetRolesIdPermissionsAdminQueryKey, getGetRolesAdminQueryKey, useGetRolesAdmin, usePutRolesIdAdmin, usePutRolesIdPermissionsAdmin } from '@/api/endpoints/roles'
import { useGetPermissionsAdmin } from '@/api/endpoints/permissions'
import { useQueryClient } from '@tanstack/react-query'
import { Can } from '@casl/react'
import { permKey, permissionSetToArray } from '@/configs/permissions'

import RoleEditModal from './components/RoleEditModal'
import RolePermissionModal from './components/RolePermissionModal'
import { type PermRow, type RoleRow } from './components/constants'

export default function Roles() {
  const queryClient = useQueryClient()
  const rolesQuery = useGetRolesAdmin()
  const permissionsQuery = useGetPermissionsAdmin()
  const updateRoleMutation = usePutRolesIdAdmin()
  const setPermissionsMutation = usePutRolesIdPermissionsAdmin()

  // Legacy envelope: responseData = { count, rows, totalPages, currentPage }
  const roles = (pickData<{ rows?: RoleRow[] }>(rolesQuery.data)?.rows ?? []) as RoleRow[]
  // GET /permissions/admin trả catalog nested: [{ module, label, actions: [{ action, label }] }]
  // → flatten thành PermRow { id, key, module, action, description }
  const permissionsPayload = pickData<
    Array<{ module?: string; actions?: Array<{ action?: string; label?: string; description?: string }> }> | { rows?: unknown[] }
  >(permissionsQuery.data)
  const catalogEntries = (
    Array.isArray(permissionsPayload) ? permissionsPayload : permissionsPayload?.rows ?? []
  ) as Array<{ module?: string; actions?: Array<{ action?: string; label?: string; description?: string }> }>
  const perms = catalogEntries.flatMap((entry) =>
    (entry?.actions ?? []).map((a) => ({
      id: `${entry.module}:${a.action}`,
      key: `${entry.module}:${a.action}`,
      module: String(entry.module ?? ''),
      action: String(a.action ?? ''),
      description: a.description ?? a.label,
    })),
  ) as PermRow[]

  const rolePermissionQueries = useQueries({
    queries: roles.map((role) => getGetRolesIdPermissionsAdminQueryOptions(role.id)),
  })
  const permCountByRole = new Map<string, number>(
    roles.map((role, index) => {
      // GET /roles/{id}/permissions trả mảng {module, action} (định dạng meu)
      const pairs = (pickData<{ module?: string; action?: string }[]>(rolePermissionQueries[index]?.data) ?? []) as { module?: string; action?: string }[]
      return [role.id, Array.isArray(pairs) ? pairs.length : 0]
    }),
  )

  const loading = rolesQuery.isLoading || permissionsQuery.isLoading
  const loadError = rolesQuery.error ?? permissionsQuery.error
  const permsEmpty = permissionsQuery.isSuccess && perms.length === 0

  // Dialog sửa vai trò
  const [editOpen, setEditOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null)
  const [roleName, setRoleName] = useState('')
  const [roleCode, setRoleCode] = useState('')
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

  const openEdit = (role: RoleRow) => {
    setEditingRole(role)
    setRoleName(role.role_name)
    setRoleCode(role.code ?? '')
    setRoleDescription(role.description ?? '')
    setEditOpen(true)
  }
  const openPermissions = (role: RoleRow) => {
    const cached = queryClient.getQueryData<{ module?: string; action?: string }[]>(getGetRolesIdPermissionsAdminQueryKey(role.id))
    const pairs = (pickData<{ module?: string; action?: string }[]>(cached as unknown as unknown[]) ?? []) as { module?: string; action?: string }[]
    // Chỉ giữ permission còn tồn tại trong catalog hiện tại — bỏ quyền ghost
    // (còn sót trong DB nhưng đã bị xoá khỏi registry) để không gửi lại khi lưu.
    const validKeys = new Set(perms.map((p) => p.key))
    setPermRole(role)
    setGranted(
      new Set(
        (Array.isArray(pairs) ? pairs : [])
          .filter((p) => p.module && p.action)
          .map((p) => permKey(p.module!, p.action!))
          .filter((key) => validKeys.has(key)),
      ),
    )
    setPermOpen(true)
  }

  const invalidateRoles = () => queryClient.invalidateQueries({ queryKey: getGetRolesAdminQueryKey() })

  const saveRole = async () => {
    if (!roleName.trim()) {
      message.warning('Nhập tên vai trò')
      return
    }
    if (!editingRole) return
    setSaving(true)
    try {
      // code cố định — chỉ cho sửa tên/mô tả, không cho tạo/xóa role
      await updateRoleMutation.mutateAsync({
        id: editingRole.id,
        data: { role_name: roleName.trim(), description: roleDescription.trim() || undefined },
      })
      message.success('Đã cập nhật vai trò')
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
        .forEach((p) => (checked ? next.add(permKey(p.module, p.action)) : next.delete(permKey(p.module, p.action))))
      return next
    })
  }
  const setAllPerms = (checked: boolean) => {
    setGranted(checked ? new Set(perms.map((p) => permKey(p.module, p.action))) : new Set())
  }

  const savePermissions = async () => {
    if (!permRole) return
    setSavingPerm(true)
    try {
      await setPermissionsMutation.mutateAsync({
        id: permRole.id,
        // Submit mảng {module, action} — định dạng PUT /roles/{id}/permissions của meu-be
        data: { permissions: permissionSetToArray(granted) } as unknown as PutRolesIdPermissionsAdminBody,
      })
      message.success('Đã cập nhật quyền hạn')
      queryClient.removeQueries({ queryKey: getGetRolesIdPermissionsAdminQueryKey(permRole.id) })
      setPermOpen(false)
      await invalidateRoles()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể lưu quyền hạn'))
    } finally {
      setSavingPerm(false)
    }
  }

  return (
    <MobileUI>
      <PageTitle subtitle="Vai trò và phân quyền truy cập hệ thống">Phân quyền</PageTitle>

      {loadError && (
        <Alert
          className="mb-4! max-lg:mb-3!"
          type="error"
          showIcon
          message="Không tải đủ danh sách vai trò và quyền"
          description={errorMessage(loadError)}
          action={<Button size="small" onClick={() => void rolesQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {!loadError && permsEmpty && (
        <Alert
          className="mb-4! max-lg:mb-3!"
          type="warning"
          showIcon
          message="Danh mục quyền đang trống"
          description="BE chưa trả về permission key nào; cần đồng bộ danh mục quyền trước khi phân quyền."
        />
      )}

      <Spin spinning={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-lg:gap-3">
          {roles.map((role) => {
            return (
              <div
                key={role.id}
                className="flex flex-col justify-between gap-4 rounded-lg  border border-[var(--brand-border-soft)] bg-white p-5 max-lg:p-3 max-lg:gap-3 transition-all hover:border-[var(--brand-border-strong)] hover:shadow-md max-sm:flex-col sm:flex-row sm:items-start md:flex-col md:items-stretch"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg  bg-[rgba(var(--brand-rgb),0.1)]">
                    <SafetyOutlined className="text-xl text-[var(--brand-primary)]" />
                  </div>
                  <div className='min-w-0'>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Typography.Text strong className="text-[15px] text-[var(--brand-dark)] break-words">
                        {role.role_name}
                      </Typography.Text>
                      {role.code && <Tag color="geekblue">{role.code}</Tag>}
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

                <div className="flex items-center gap-1 max-sm:self-end md:self-end">
                  <Can I="MANAGE" a="PERMISSION">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      className="rounded-lg text-[var(--brand-primary)] hover:bg-[rgba(var(--brand-rgb),0.08)]!"
                      onClick={() => openEdit(role)}
                    >
                      Sửa
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      icon={<SafetyCertificateOutlined />}
                      className="rounded-lg text-emerald-700 hover:bg-emerald-50!"
                      onClick={() => openPermissions(role)}
                    >
                      Phân quyền
                    </Button>
                  </Can>
                </div>
              </div>
            )
          })}

          {roles.length === 0 && !loading && !loadError && (
            <div className="rounded-lg  border border-[var(--brand-border-soft)] bg-[var(--brand-bg)] p-10 text-center text-slate-500">
              Chưa có vai trò nào
            </div>
          )}
        </div>
      </Spin>

      {/* Dialog tạo/sửa vai trò */}
      <RoleEditModal
        open={editOpen}
        editingRole={editingRole}
        roleName={roleName}
        roleCode={roleCode}
        roleDescription={roleDescription}
        saving={saving}
        onRoleNameChange={setRoleName}
        onRoleCodeChange={setRoleCode}
        onRoleDescriptionChange={setRoleDescription}
        onCancel={() => setEditOpen(false)}
        onOk={() => void saveRole()}
      />

      {/* Dialog phân quyền */}
      <RolePermissionModal
        open={permOpen}
        permRole={permRole}
        groups={groups}
        granted={granted}
        totalPerms={totalPerms}
        loading={loading}
        permsEmpty={permsEmpty}
        savingPerm={savingPerm}
        onCancel={() => setPermOpen(false)}
        onSave={() => void savePermissions()}
        onTogglePerm={togglePerm}
        onSetModulePerms={setModulePerms}
        onSetAllPerms={setAllPerms}
      />
    </MobileUI>
  )
}
