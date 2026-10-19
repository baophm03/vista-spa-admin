import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import {
  bizErrorMessage,
  createAdminUser,
  deleteAdminUser,
  listRoles,
  listUsers,
  updateAdminUser,
} from '../api/newsky'

interface StaffRow {
  id: string
  zalo_name?: string
  email?: string
  phone_number?: string
  is_admin?: boolean
  is_active?: boolean
  roles?: { role_name?: string }[]
}

export default function Staffs() {
  const [rows, setRows] = useState<StaffRow[]>([])
  const [roles, setRoles] = useState<{ id: string; role_name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listUsers({ page: 1, limit: 100 })
      setRows(data?.rows ?? [])
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    listRoles()
      .then((r: any[]) => setRoles(r.map((x) => ({ id: x.id, role_name: x.role_name ?? x.name }))))
      .catch(() => undefined)
  }, [load])

  const openModal = (s?: StaffRow) => {
    setEditing(s ?? null)
    form.setFieldsValue(
      s
        ? { zalo_name: s.zalo_name, email: s.email, phone_number: s.phone_number, is_admin: s.is_admin }
        : { zalo_name: '', email: '', phone_number: '', password: '', role_id: undefined, is_admin: false },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await updateAdminUser(editing.id, {
          zalo_name: values.zalo_name,
          is_admin: values.is_admin,
          role_id: values.role_id,
        })
        message.success('Đã cập nhật chuyên viên')
      } else {
        await createAdminUser({
          email: values.email,
          phone_number: values.phone_number,
          password: values.password,
          role_id: values.role_id,
          full_name: values.zalo_name,
        })
        message.success('Đã thêm chuyên viên')
      }
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const remove = async (row: StaffRow) => {
    try {
      await deleteAdminUser(row.id)
      message.success('Đã xóa chuyên viên')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const roleLabel = (r: StaffRow) => {
    if (r.is_admin) return 'Admin'
    const name = r.roles?.[0]?.role_name
    return name || 'Nhân viên'
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm chuyên viên
            </Button>
          </Space>
        }
      >
        Chuyên viên / KTV
      </PageTitle>
      <Table<StaffRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        locale={{ emptyText: 'Chưa có nhân viên nào trong hệ thống.' }}
        columns={[
          {
            title: 'Nhân viên',
            dataIndex: 'zalo_name',
            render: (_, s) => (
              <Space>
                <Avatar size={36} style={{ backgroundColor: 'var(--brand-primary)' }} icon={<UserOutlined />} />
                <span style={{ fontWeight: 600 }}>{s.zalo_name || s.email || '—'}</span>
              </Space>
            ),
          },
          {
            title: 'Vai trò',
            key: 'role',
            width: 140,
            render: (_, s) => <Tag color={s.is_admin ? 'gold' : 'purple'}>{roleLabel(s)}</Tag>,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            width: 120,
            render: (v) => (
              <Tag color={v === false ? 'default' : 'green'}>{v === false ? 'Nghỉ' : 'Đang làm'}</Tag>
            ),
          },
          { title: 'SĐT', dataIndex: 'phone_number', width: 150, render: (v) => v || '—' },
          { title: 'Email', dataIndex: 'email', render: (v) => v || '—' },
          {
            title: 'Thao tác',
            key: 'actions',
            width: 140,
            render: (_, s) => (
              <Space>
                <Button size="small" onClick={() => openModal(s)}>
                  Sửa
                </Button>
                <Popconfirm title="Xóa chuyên viên này?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove(s)}>
                  <Button size="small" danger>
                    Xóa
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Sửa chuyên viên' : 'Thêm chuyên viên'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="zalo_name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Trần Hoa" />
          </Form.Item>
          {!editing && (
            <Space style={{ display: 'flex' }}>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]} style={{ flex: 1 }}>
                <Input placeholder="nhanvien@vista.vn" />
              </Form.Item>
              <Form.Item name="phone_number" label="SĐT (đăng nhập)" rules={[{ required: true, message: 'Nhập SĐT' }]} style={{ flex: 1 }}>
                <Input placeholder="0901 111 222" />
              </Form.Item>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]} style={{ flex: 1 }}>
                <Input.Password />
              </Form.Item>
            </Space>
          )}
          {editing && (
            <Form.Item name="phone_number" label="SĐT" style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          )}
          <Space style={{ display: 'flex' }}>
            <Form.Item name="role_id" label="Vai trò" style={{ flex: 1 }}>
              <Select
                allowClear
                options={roles.map((r) => ({ value: r.id, label: r.role_name }))}
                placeholder="Chọn vai trò"
              />
            </Form.Item>
            <Form.Item name="is_admin" label="Quyền admin" valuePropName="checked" style={{ flex: 1 }}>
              <Select
                options={[
                  { value: true, label: 'Có' },
                  { value: false, label: 'Không' },
                ]}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
