import { useState } from 'react'
import { Button, Card, Form, Input, Modal, Popconfirm, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { ROLES } from '../mock/admin'
import type { Role } from '../mock/admin'

const PERM_LABELS: Record<keyof Role['permissions'], string> = {
  dashboard: 'Dashboard',
  customers: 'Khách hàng',
  appointments: 'Lịch hẹn',
  treatments: 'Liệu trình',
  vouchers: 'Voucher',
  products: 'Sản phẩm',
  staffs: 'Nhân sự',
  settings: 'Cấu hình',
}

export default function Roles() {
  const [rows, setRows] = useState<Role[]>(ROLES)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const togglePerm = (roleId: string, perm: keyof Role['permissions']) => {
    setRows((rs) =>
      rs.map((r) =>
        r.id === roleId ? { ...r, permissions: { ...r.permissions, [perm]: !r.permissions[perm] } } : r,
      ),
    )
    message.success('Đã cập nhật quyền')
  }

  const submit = async () => {
    const values = await form.validateFields()
    const permissions = Object.keys(PERM_LABELS).reduce(
      (acc, k) => ({ ...acc, [k]: false }),
      {} as Role['permissions'],
    )
    setRows((rs) => [...rs, { id: String(Date.now()), members: 0, ...values, permissions }])
    message.success('Đã thêm vai trò (mặc định không có quyền — bật trong bảng)')
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ name: '' }); setOpen(true) }}>
            Thêm vai trò
          </Button>
        }
      >
        Phân quyền
      </PageTitle>
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={false}
          columns={[
            {
              title: 'Vai trò',
              dataIndex: 'name',
              width: 140,
              render: (v) => <Tag color="purple" style={{ fontSize: 13 }}>{v}</Tag>,
            },
            {
              title: 'Thành viên',
              dataIndex: 'members',
              width: 100,
              render: (v) => `${v} người`,
            },
            ...(
              Object.keys(PERM_LABELS) as (keyof Role['permissions'])[]
            ).map((perm) => ({
              title: PERM_LABELS[perm],
              width: 100,
              align: 'center' as const,
              render: (_: unknown, row: Role) =>
                row.name === 'Admin' ? (
                  <Tag color="gold">Toàn quyền</Tag>
                ) : (
                  <Switch size="small" checked={row.permissions[perm]} onChange={() => togglePerm(row.id, perm)} />
                ),
            })),
            {
              title: '',
              width: 80,
              render: (_: unknown, row: Role) =>
                row.name === 'Admin' ? null : (
                  <Popconfirm
                    title="Xóa vai trò này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => {
                      setRows((rs) => rs.filter((r) => r.id !== row.id))
                      message.success('Đã xóa vai trò')
                    }}
                  >
                    <Button size="small" danger>
                      Xóa
                    </Button>
                  </Popconfirm>
                ),
            },
          ]}
        />
      </Card>

      <Modal title="Thêm vai trò" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên vai trò" rules={[{ required: true, message: 'Nhập tên vai trò' }]}>
            <Input placeholder="VD: Marketing" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
