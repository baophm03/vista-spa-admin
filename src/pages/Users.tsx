import { useMemo, useState } from 'react'
import { Avatar, Button, DatePicker, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { CUSTOMERS } from '../mock/admin'
import type { Customer, Rank } from '../mock/admin'

const RANK_COLOR: Record<Rank, string> = {
  Vista: 'purple',
  VIP: 'gold',
  'Kim Cương': 'geekblue',
}

export default function Users() {
  const [rows, setRows] = useState<Customer[]>(CUSTOMERS)
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form] = Form.useForm()

  const openModal = (customer?: Customer) => {
    setEditing(customer ?? null)
    form.setFieldsValue(
      customer ?? {
        name: '',
        phone: '',
        email: '',
        rank: 'Vista',
        points: 0,
        expiry: '',
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const row = {
      ...values,
      expiry: values.expiry?.format?.('DD/MM/YYYY') ?? values.expiry,
    }
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...row } : r)))
      message.success('Đã cập nhật khách hàng')
    } else {
      const nextCode = `KH-${String(rows.length + 1).padStart(4, '0')}`
      setRows((rs) => [
        ...rs,
        { id: String(Date.now()), code: nextCode, created_at: new Date().toLocaleDateString('vi-VN'), ...row },
      ])
      message.success('Đã thêm khách hàng')
    }
    setOpen(false)
  }

  const filtered = useMemo(
    () =>
      rows.filter(
        (c) =>
          c.name.toLowerCase().includes(keyword.toLowerCase()) ||
          c.phone.includes(keyword) ||
          c.code.toLowerCase().includes(keyword.toLowerCase()),
      ),
    [rows, keyword],
  )

  const customer = rows.find((c) => c.id === selected)

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
              placeholder="Tìm theo tên, SĐT, mã KH..."
              style={{ width: 260 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm khách hàng
            </Button>
          </Space>
        }
      >
        Khách hàng
      </PageTitle>
      <Table
        rowKey="id"
        dataSource={filtered}
        onRow={(row) => ({ onClick: () => setSelected(row.id), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Mã KH',
            dataIndex: 'code',
            width: 110,
            render: (v) => <Typography.Text code>{v}</Typography.Text>,
          },
          {
            title: 'Khách hàng',
            dataIndex: 'name',
            render: (v) => (
              <Space>
                <Avatar style={{ backgroundColor: '#8E63A9' }} icon={<UserOutlined />} size="small" />
                <span style={{ fontWeight: 500 }}>{v}</span>
              </Space>
            ),
          },
          { title: 'Số điện thoại', dataIndex: 'phone' },
          { title: 'Email', dataIndex: 'email', render: (v) => v || '-' },
          {
            title: 'Hạng',
            dataIndex: 'rank',
            width: 110,
            render: (v: Rank) => <Tag color={RANK_COLOR[v]}>{v}</Tag>,
          },
          {
            title: 'Điểm',
            dataIndex: 'points',
            width: 110,
            render: (v) => v.toLocaleString('vi-VN'),
          },
          { title: 'Ngày tham gia', dataIndex: 'created_at', width: 130 },
          {
            title: '',
            width: 140,
            render: (_, row) => (
              <Space>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    openModal(row)
                  }}
                >
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa khách hàng này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={(e) => {
                    e?.stopPropagation()
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa khách hàng')
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                    Xóa
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={customer ? `${customer.name} — ${customer.code}` : ''}
        width={420}
        open={!!customer}
        onClose={() => setSelected(null)}
      >
        {customer && (
          <div style={{ textAlign: 'center' }}>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${customer.code}`}
              alt={customer.code}
              width={180}
              height={180}
              style={{ borderRadius: 12, border: '1px solid #E9DDF0' }}
            />
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Mã QR khách hàng — quét để tra cứu
            </Typography.Text>
            <div style={{ textAlign: 'left', marginTop: 24, display: 'grid', gap: 12 }}>
              {[
                ['Hạng thành viên', <Tag key="r" color={RANK_COLOR[customer.rank]}>{customer.rank}</Tag>],
                ['Điểm hiện có', customer.points.toLocaleString('vi-VN')],
                ['Hạn thẻ', customer.expiry],
                ['Số điện thoại', customer.phone],
                ['Email', customer.email || '-'],
                ['Ngày tham gia', customer.created_at],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography.Text type="secondary">{label}</Typography.Text>
                  <Typography.Text strong>{value}</Typography.Text>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Nguyễn Thu Hà" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[{ required: true, message: 'Nhập SĐT' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="0901 234 568" />
            </Form.Item>
            <Form.Item name="email" label="Email" style={{ flex: 1 }}>
              <Input placeholder="email@gmail.com" />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="rank" label="Hạng thành viên" style={{ flex: 1 }}>
              <Select
                options={(['Vista', 'VIP', 'Kim Cương'] as Rank[]).map((r) => ({
                  value: r,
                  label: r,
                }))}
              />
            </Form.Item>
            <Form.Item name="points" label="Điểm" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="expiry" label="Hạn thẻ">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
