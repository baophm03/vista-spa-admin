import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography, Alert, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { CUSTOMERS, ORDERS, PRODUCTS } from '../mock/admin'
import type { Order } from '../mock/admin'

type OrderStatus = Order['status']

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'orange' },
  confirmed: { label: 'Đã xác nhận', color: 'purple' },
  shipping: { label: 'Đang giao', color: 'geekblue' },
  done: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'shipping', label: 'Đang giao' },
  { value: 'done', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
]

export default function Orders() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Order[]>(ORDERS)
  const [filter, setFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const list = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  )

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      shipping: rows.filter((r) => r.status === 'shipping').length,
      revenue: rows.filter((r) => r.status === 'done').reduce((s, r) => s + r.items.reduce((x, i) => x + i.price * i.qty, 0), 0),
    }),
    [rows],
  )

  const submit = async () => {
    const values = await form.validateFields()
    const product = PRODUCTS.find((p) => p.name === values.product)
    setRows((rs) => [
      {
        id: String(Date.now()),
        code: `HD-${10250 + rs.length}`,
        customer: values.customer,
        phone: CUSTOMERS.find((c) => c.name === values.customer)?.phone ?? '',
        address: values.address,
        payment: values.payment,
        date: values.date?.format?.('DD/MM/YYYY') ?? new Date().toLocaleDateString('vi-VN'),
        status: 'pending',
        items: product
          ? [{ name: product.name, image: product.image, price: product.price, qty: values.quantity }]
          : [],
      },
      ...rs,
    ])
    message.success('Đã tạo đơn hàng')
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Segmented options={FILTERS} value={filter} onChange={(v) => setFilter(v as string)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.setFieldsValue({ customer: undefined, product: undefined, quantity: 1, address: '', payment: 'COD' }); setOpen(true) }}>
              Tạo đơn hàng
            </Button>
          </Space>
        }
      >
        Đơn hàng
      </PageTitle>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Dữ liệu minh họa — backend chưa có module đơn hàng. Các thao tác chỉ lưu tạm trên trình duyệt."
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Tổng đơn hàng" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Chờ xác nhận" value={stats.pending} valueStyle={{ color: '#D97706' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Đang giao" value={stats.shipping} valueStyle={{ color: '#3B5BDB' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Doanh thu bán lẻ" value={stats.revenue} suffix="đ" valueStyle={{ color: 'var(--brand-primary)' }} />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        dataSource={list}
        onRow={(row) => ({ onClick: () => navigate(`/orders/${row.id}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Mã đơn',
            dataIndex: 'code',
            width: 110,
            render: (v) => <Typography.Text strong style={{ color: 'var(--brand-dark)' }}>{v}</Typography.Text>,
          },
          {
            title: 'Khách hàng',
            dataIndex: 'customer',
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.phone}</div>
              </div>
            ),
          },
          {
            title: 'Sản phẩm',
            dataIndex: 'items',
            render: (_, row) => (
              <Space>
                <img src={row.items[0]?.image} alt="" width={36} height={36} style={{ borderRadius: 12, objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: 13 }}>{row.items[0]?.name}</div>
                  {row.items.length > 1 && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      +{row.items.length - 1} sản phẩm khác
                    </Typography.Text>
                  )}
                </div>
              </Space>
            ),
          },
          {
            title: 'Tổng tiền',
            width: 130,
            render: (_, row) => (
              <span style={{ fontWeight: 600 }}>
                {row.items.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString('vi-VN')}đ
              </span>
            ),
          },
          { title: 'Thanh toán', dataIndex: 'payment', width: 120 },
          { title: 'Ngày', dataIndex: 'date', width: 110 },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 130,
            render: (v: OrderStatus) => <Tag color={ORDER_STATUS_META[v].color}>{ORDER_STATUS_META[v].label}</Tag>,
          },
          {
            title: '',
            width: 80,
            render: (_, row) => (
              <Popconfirm
                title="Xóa đơn hàng này?"
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={(e) => {
                  e?.stopPropagation()
                  setRows((rs) => rs.filter((r) => r.id !== row.id))
                  message.success('Đã xóa đơn hàng')
                }}
                onCancel={(e) => e?.stopPropagation()}
              >
                <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                  Xóa
                </Button>
              </Popconfirm>
            ),
          },
        ]}
      />

      <Modal title="Tạo đơn hàng" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Tạo đơn" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khách hàng"
              options={CUSTOMERS.map((c) => ({ value: c.name, label: `${c.name} — ${c.code}` }))}
            />
          </Form.Item>
          <Form.Item name="product" label="Sản phẩm" rules={[{ required: true, message: 'Chọn sản phẩm' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn sản phẩm"
              options={PRODUCTS.filter((p) => p.is_active).map((p) => ({
                value: p.name,
                label: `${p.name} — ${p.price.toLocaleString('vi-VN')}đ`,
              }))}
            />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="payment" label="Thanh toán" style={{ flex: 1 }}>
              <Select options={['COD', 'ZaloPay', 'Chuyển khoản'].map((p) => ({ value: p, label: p }))} />
            </Form.Item>
          </Space>
          <Form.Item name="address" label="Địa chỉ giao hàng" rules={[{ required: true, message: 'Nhập địa chỉ' }]}>
            <Input placeholder="Số nhà, đường, quận..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

