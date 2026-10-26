import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Space, Spin, Switch, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueries } from '@tanstack/react-query'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData } from '@/api/helpers'
import type { PutRolesIdPermissionsBody } from '@/api/models/putRolesIdPermissionsBody'
import { getGetRolesIdPermissionsQueryOptions, useGetPermissions, useGetRoles, usePutRolesIdPermissions } from '@/api/endpoints/roles'

interface RoleRow {
  id: string
  role_name: string
  [k: string]: unknown
}
interface PermRow {
  id: string
  key: string
  module: string
  description?: string
}

export default function Roles() {
  const [grants, setGrants] = useState<Record<string, Set<string>>>({})
  const initialGrants = useRef<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const rolesQuery = useGetRoles()
  const permissionsQuery = useGetPermissions()
  const updateMutation = usePutRolesIdPermissions()
  // Legacy envelope: responseData = { count, rows, totalPages, currentPage }
  const roles = (pickData<{ rows?: RoleRow[] }>(rolesQuery.data)?.rows ?? []) as RoleRow[]
  const permissionsPayload = pickData<PermRow[] | { rows?: PermRow[] }>(permissionsQuery.data)
  const perms = (
    Array.isArray(permissionsPayload)
      ? permissionsPayload
      : permissionsPayload?.rows ?? []
  ) as PermRow[]
  const rolePermissionQueries = useQueries({
    queries: roles.map((role) => getGetRolesIdPermissionsQueryOptions(role.id)),
  })
  const permissionQueryState = rolePermissionQueries.map((query) => query.dataUpdatedAt).join(',')
  const loading = rolesQuery.isLoading || permissionsQuery.isLoading || rolePermissionQueries.some((query) => query.isLoading)
  const loadError = rolesQuery.error ?? permissionsQuery.error ?? rolePermissionQueries.find((query) => query.isError)?.error

  useEffect(() => {
    if (!roles.length || rolePermissionQueries.some((query) => query.isLoading)) return
    const next: Record<string, Set<string>> = {}
    roles.forEach((role, index) => {
      // responseData là mảng permission key (model gen sai kiểu — đọc bằng pickData rồi cast)
      const keys = (pickData<string[]>(rolePermissionQueries[index]?.data) ?? []) as string[]
      next[role.id] = new Set(Array.isArray(keys) ? keys : [])
      initialGrants.current[role.id] = [...next[role.id]].sort()
    })
    setGrants(next)
  }, [rolesQuery.data, permissionQueryState])

  const reload = async () => {
    await Promise.all([rolesQuery.refetch(), permissionsQuery.refetch(), ...rolePermissionQueries.map((query) => query.refetch())])
  }

  const toggle = (roleId: string, permKey: string, checked: boolean) => {
    setGrants((g) => {
      const next = { ...g, [roleId]: new Set(g[roleId] ?? []) }
      if (checked) next[roleId].add(permKey)
      else next[roleId].delete(permKey)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      // Chỉ PUT các role có thay đổi so với lúc load
      const changed = roles.filter((role) => {
        const next = [...(grants[role.id] ?? [])].sort()
        const prev = initialGrants.current[role.id] ?? []
        return next.length !== prev.length || next.some((k, i) => k !== prev[i])
      })
      for (const role of changed) {
        // Backend nhận mảng permission key; model orval gen sai kiểu string nên phải cast
        await updateMutation.mutateAsync({
          id: role.id,
          data: { permissions: [...(grants[role.id] ?? [])] } as unknown as PutRolesIdPermissionsBody,
        })
      }
      message.success('Đã lưu phân quyền')
      await reload()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể lưu phân quyền'))
    } finally {
      setSaving(false)
    }
  }

  const modules = [...new Set(perms.map((p) => p.module))]

  return (
    <>
      <PageTitle
        extra={
          <Space className="max-sm:flex! max-sm:w-full! max-sm:flex-wrap!">
            <Button icon={<ReloadOutlined />} onClick={() => void reload()} />
            <Button type="primary" icon={<PlusOutlined />} disabled>
              Thêm vai trò (tạo qua API)
            </Button>
            <Button
              className="max-sm:flex-1"
              type="primary"
              loading={saving}
              disabled={loading || Boolean(loadError) || perms.length === 0}
              onClick={() => void save()}
            >
              Lưu phân quyền
            </Button>
          </Space>
        }
      >
        Phân quyền
      </PageTitle>
      <Card>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Quyền theo key (VD: appointment.approve) — nhân viên có quyền nào sẽ gọi được API tương ứng. Admin toàn quyền mặc định.
        </Typography.Text>
        {loadError && (
          <Alert
            className="mb-4"
            type="error"
            showIcon
            message="Không tải đủ danh sách vai trò và quyền"
            description={errorMessage(loadError)}
            action={<Button size="small" onClick={() => void reload()}>Thử lại</Button>}
          />
        )}
        {!loading && !loadError && permissionsQuery.isSuccess && perms.length === 0 && (
          <Alert
            className="mb-4"
            type="warning"
            showIcon
            message="Danh mục quyền đang trống"
            description="BE chưa trả về permission key nào; cần đồng bộ danh mục quyền trước khi phân quyền."
          />
        )}
        <Spin spinning={loading}>
          <Table
            rowKey="id"
            dataSource={roles}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: 'Vai trò',
                dataIndex: 'role_name',
                width: 140,
                fixed: 'left',
                render: (v) => <Tag color="purple" style={{ fontSize: 13 }}>{v}</Tag>,
              },
              ...modules.map((m) => ({
                title: m,
                width: 160,
                render: (_: unknown, row: RoleRow) => (
                  <Space direction="vertical" size={2}>
                    {perms
                      .filter((p) => p.module === m)
                      .map((p) => (
                        <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Switch
                            size="small"
                            checked={grants[row.id]?.has(p.key) ?? false}
                            onChange={(v) => toggle(row.id, p.key, v)}
                          />
                          <Typography.Text style={{ fontSize: 11 }}>{p.key.split('.')[1]}</Typography.Text>
                        </div>
                      ))}
                  </Space>
                ),
              })),
            ]}
          />
        </Spin>
      </Card>
    </>
  )
}
