import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { bizErrorMessage, createAdminUser, listRoles, listUsers, updateAdminUser } from '../api/newsky'

interface AccountRow {
  id: string
  zalo_name?: string
  phone_number?: string
  email?: string
  is_admin?: boolean
  [k: string]: unknown
}

export default function Accounts() {
  const [rows, setRows] = useState<AccountRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<{ id: string; role_name: string }[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AccountRow | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listUsers({ page, limit })
      const users = data?.rows ?? (Array.isArray(data) ? data : [])
      setRows(users)
      setTotal(data?.count ?? users.length)
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    load()
    listRoles().then((r: any[]) => setRoles(r.map((x) => ({ id: x.id, role_name: x.role_name ?? x.name })))).catch(() => undefined)
  }, [load])

  const openModal = (a?: AccountRow) => {
    setEditing(a ?? null)
    form.setFieldsValue(a ? { zalo_name: a.zalo_name, email: a.email, phone_number: a.phone_number, is_admin: a.is_admin } : { zalo_name: '', email: '', phone_number: '', password: '', role_id: undefined, is_admin: false })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await updateAdminUser(editing.id, { zalo_name: values.zalo_name, is_admin: values.is_admin })
        message.success('Đã cập nhật tài khoản')
      } else {
        await createAdminUser({ email: values.email, phone_number: values.phone_number, password: values.password, role_id: values.role_id, full_name: values.zalo_name })
        message.success('Đã tạo tài khoản')
      }
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm tài khoản
          </Button>
        }
      >
        Tài khoản
      </PageTitle>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage }}
        columns={[
          {
            title: 'Người dùng',
            dataIndex: 'zalo_name',
            render: (v) => (
              <Space>
                <Avatar style={{ backgroundColor: 'var(--brand-primary)' }} icon={<UserOutlined />} size="small" />
                <Typography.Text strong>{v || '—'}</Typography.Text>
              </Space>
            ),
          },
          { title: 'SĐT', dataIndex: 'phone_number' },
          {
            title: 'Vai trò',
            dataIndex: 'is_admin',
            width: 120,
            render: (v: boolean) => (v ? <Tag color="gold">Admin</Tag> : <Tag>Nhân viên</Tag>),
          },
          {
            title: '',
            width: 100,
            render: (_, row) => (
              <Button size="small" onClick={() => openModal(row)}>
                Sửa
              </Button>
            ),
          },
        ]}
      />

      <Modal title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'} open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="zalo_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input />
          </Form.Item>
          {!editing && (
            <Space style={{ display: 'flex' }}>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]} style={{ flex: 1 }}>
                <Input placeholder="nhanvien@vista.vn" />
              </Form.Item>
              <Form.Item name="phone_number" label="SĐT (đăng nhập)" rules={[{ required: true, message: 'Nhập SĐT' }]} style={{ flex: 1 }}>
                <Input placeholder="0901234568" />
              </Form.Item>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]} style={{ flex: 1 }}>
                <Input.Password />
              </Form.Item>
            </Space>
          )}
          <Space style={{ display: 'flex' }}>
            <Form.Item name="role_id" label="Vai trò" style={{ flex: 1 }}>
              <Select allowClear options={roles.map((r) => ({ value: r.id, label: r.role_name }))} />
            </Form.Item>
            <Form.Item name="is_admin" label="Là Admin" style={{ flex: 1 }}>
              <Select options={[{ value: true, label: 'Có' }, { value: false, label: 'Không' }]} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
