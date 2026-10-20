import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Card, Space, Spin, Switch, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { bizErrorMessage, getRolePermissions, listPermissions, listRoles, updateRolePermissions } from '../api/newsky'

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
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [perms, setPerms] = useState<PermRow[]>([])
  const [grants, setGrants] = useState<Record<string, Set<string>>>({})
  const initialGrants = useRef<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, p] = await Promise.all([listRoles(), listPermissions()])
      setRoles(r as RoleRow[])
      setPerms(p as PermRow[])
      const g: Record<string, Set<string>> = {}
      for (const role of r as RoleRow[]) {
        try {
          const keys = (await getRolePermissions(role.id)) as string[]
          g[role.id] = new Set(keys)
          initialGrants.current[role.id] = [...keys].sort()
        } catch {
          g[role.id] = new Set()
          initialGrants.current[role.id] = []
        }
      }
      setGrants(g)
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
        await updateRolePermissions(role.id, { permissions: [...(grants[role.id] ?? [])] })
      }
      message.success('Đã lưu phân quyền')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const modules = [...new Set(perms.map((p) => p.module))]

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button type="primary" icon={<PlusOutlined />} disabled>
              Thêm vai trò (tạo qua API)
            </Button>
            <Button type="primary" loading={saving} onClick={save}>
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
