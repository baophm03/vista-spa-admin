import { useState } from 'react'
import { Avatar, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { ACCOUNTS, ROLES } from '../mock/admin'
import type { Account } from '../mock/admin'

export default function Accounts() {
  const [rows, setRows] = useState<Account[]>(ACCOUNTS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form] = Form.useForm()

  const openModal = (a?: Account) => {
    setEditing(a ?? null)
    form.setFieldsValue(
      a ?? {
        name: '',
        email: '',
        role: 'KTV',
        password: '',
        is_active: true,
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const { password, ...rest } = values
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...rest } : r)))
      message.success(password ? 'Đã cập nhật tài khoản (kèm mật khẩu mới)' : 'Đã cập nhật tài khoản')
    } else {
      setRows((rs) => [
        ...rs,
        { id: String(Date.now()), last_login: 'Chưa đăng nhập', ...rest },
      ])
      message.success('Đã tạo tài khoản')
    }
    setOpen(false)
  }

  const toggleActive = (row: Account) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)))
    message.success(row.is_active ? `Đã khóa tài khoản ${row.name}` : `Đã mở khóa ${row.name}`)
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
        dataSource={rows}
        columns={[
          {
            title: 'Người dùng',
            dataIndex: 'name',
            render: (v, row) => (
              <Space>
                <Avatar style={{ backgroundColor: '#8E63A9' }} icon={<UserOutlined />} size="small" />
                <div>
                  <div style={{ fontWeight: 500 }}>{v}</div>
                  <div style={{ fontSize: 12, color: '#6F7071' }}>{row.email}</div>
                </div>
              </Space>
            ),
          },
          {
            title: 'Vai trò',
            dataIndex: 'role',
            width: 120,
            render: (v) => <Tag color={v === 'Admin' ? 'gold' : 'purple'}>{v}</Tag>,
          },
          { title: 'Đăng nhập cuối', dataIndex: 'last_login', width: 170 },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            width: 110,
            render: (v) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag>Đã khóa</Tag>),
          },
          {
            title: '',
            width: 200,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Sửa
                </Button>
                {row.name !== 'Admin' && row.role !== 'Admin' && (
                  <Button size="small" danger={row.is_active} onClick={() => toggleActive(row)}>
                    {row.is_active ? 'Khóa' : 'Mở khóa'}
                  </Button>
                )}
                <Popconfirm
                  title="Xóa tài khoản này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa tài khoản')
                  }}
                >
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
        title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Nguyễn Quản Lý" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email đăng nhập"
            rules={[
              { required: true, message: 'Nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input placeholder="ten@newskyvista.vn" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="role" label="Vai trò" style={{ flex: 1 }}>
              <Select options={ROLES.map((r) => ({ value: r.name, label: r.name }))} />
            </Form.Item>
            <Form.Item
              name="password"
              label={editing ? 'Mật khẩu mới (bỏ trống nếu giữ)' : 'Mật khẩu'}
              rules={editing ? [] : [{ required: true, message: 'Nhập mật khẩu' }]}
              style={{ flex: 1 }}
            >
              <Input.Password placeholder="••••••••" />
            </Form.Item>
          </Space>
          <Form.Item name="is_active" label="Hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
