import { useMemo, useState } from 'react'
import { Alert, Button, Modal, Spin, Tag, Typography, message } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
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
import { Can } from '@casl/react'
import { permKey, permissionSetToArray } from '@/configs/permissions'

import RoleEditModal from './components/RoleEditModal'
import RolePermissionModal from './components/RolePermissionModal'
import { SYSTEM_ROLES, type PermRow, type RoleRow } from './components/constants'

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
  const permissionsPayload = pickData<PermRow[] | { rows?: PermRow[] }>(permissionsQuery.data)
  const perms = (
    Array.isArray(permissionsPayload) ? permissionsPayload : permissionsPayload?.rows ?? []
  ) as PermRow[]

  const rolePermissionQueries = useQueries({
    queries: roles.map((role) => getGetRolesIdPermissionsQueryOptions(role.id)),
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

  const openCreate = () => {
    setEditingRole(null)
    setRoleName('')
    setRoleCode('')
    setRoleDescription('')
    setEditOpen(true)
  }
  const openEdit = (role: RoleRow) => {
    setEditingRole(role)
    setRoleName(role.role_name)
    setRoleCode(role.code ?? '')
    setRoleDescription(role.description ?? '')
    setEditOpen(true)
  }
  const openPermissions = (role: RoleRow) => {
    const cached = queryClient.getQueryData<{ module?: string; action?: string }[]>(getGetRolesIdPermissionsQueryKey(role.id))
    const pairs = (pickData<{ module?: string; action?: string }[]>(cached as unknown as unknown[]) ?? []) as { module?: string; action?: string }[]
    setPermRole(role)
    setGranted(new Set((Array.isArray(pairs) ? pairs : []).filter((p) => p.module && p.action).map((p) => permKey(p.module!, p.action!))))
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
        // code cố định sau khi tạo — không gửi khi sửa
        await updateRoleMutation.mutateAsync({
          id: editingRole.id,
          data: { role_name: roleName.trim(), description: roleDescription.trim() || undefined },
        })
        message.success('Đã cập nhật vai trò')
      } else {
        await createRoleMutation.mutateAsync({
          data: {
            role_name: roleName.trim(),
            description: roleDescription.trim() || undefined,
            ...(roleCode.trim() ? { code: roleCode.trim().toLowerCase() } : {}),
          } as never,
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
        data: { permissions: permissionSetToArray(granted) } as unknown as PutRolesIdPermissionsBody,
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

  return (
    <>
      <PageTitle
        subtitle="Vai trò và phân quyền truy cập hệ thống"
        right={
          <Can I="MANAGE" a="PERMISSION">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="rounded-xl"
              onClick={openCreate}
            >
              Tạo vai trò mới
            </Button>
          </Can>
        }
      >
        Phân quyền
      </PageTitle>

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

                <div className="flex items-center gap-1 max-sm:self-end">
                  <Can I="MANAGE" a="PERMISSION">
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
                  </Can>
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

      {/* Xóa vai trò dùng Modal.confirm nhỏ — gọi trực tiếp trong askDelete */}
    </>
  )
}
