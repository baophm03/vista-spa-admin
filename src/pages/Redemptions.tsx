import { useMemo, useState } from 'react'
import { Button, Card, Col, DatePicker, Form, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { CUSTOMERS, REDEMPTIONS, VOUCHERS } from '../mock/admin'
import type { Redemption } from '../mock/admin'

export default function Redemptions() {
  const [rows, setRows] = useState<Redemption[]>(REDEMPTIONS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Redemption | null>(null)
  const [form] = Form.useForm()

  const stats = useMemo(
    () => ({
      total: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      points: rows.filter((r) => r.status === 'done').reduce((s, r) => s + r.points, 0),
    }),
    [rows],
  )

  const openModal = (r?: Redemption) => {
    setEditing(r ?? null)
    form.setFieldsValue(r ?? { customer: undefined, item: undefined, points: 0, date: '' })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const row = {
      ...values,
      date: values.date?.format?.('DD/MM/YYYY') ?? values.date,
    }
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...row } : r)))
      message.success('Đã cập nhật lượt đổi quà')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), code: `DQ-0${132 + rs.length}`, status: 'pending', ...row }])
      message.success('Đã ghi nhận đổi quà')
    }
    setOpen(false)
  }

  const markDone = (row: Redemption) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: 'done' } : r)))
    message.success(`Đã trừ ${row.points} điểm — khách đã nhận quà`)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Ghi nhận đổi quà
          </Button>
        }
      >
        Khách đổi quà
      </PageTitle>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={8}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Tổng lượt đổi" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Chờ nhận quà" value={stats.pending} valueStyle={{ color: '#D97706' }} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Điểm đã đổi" value={stats.points} valueStyle={{ color: '#8E63A9' }} />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          {
            title: 'Mã',
            dataIndex: 'code',
            width: 100,
            render: (v) => <Typography.Text code>{v}</Typography.Text>,
          },
          {
            title: 'Khách hàng',
            dataIndex: 'customer',
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.item}</div>
              </div>
            ),
          },
          {
            title: 'Điểm đã đổi',
            dataIndex: 'points',
            width: 120,
            render: (v) => <span style={{ fontWeight: 600, color: '#8E63A9' }}>{v.toLocaleString('vi-VN')}</span>,
          },
          { title: 'Ngày đổi', dataIndex: 'date', width: 110 },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 120,
            render: (v) => (v === 'done' ? <Tag color="green">Đã nhận quà</Tag> : <Tag color="orange">Chờ nhận</Tag>),
          },
          {
            title: '',
            width: 180,
            render: (_, row) => (
              <Space>
                {row.status === 'pending' && (
                  <Button size="small" type="primary" ghost onClick={() => markDone(row)}>
                    Đã nhận quà
                  </Button>
                )}
                <Button size="small" onClick={() => openModal(row)}>
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa lượt đổi quà này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa lượt đổi quà')
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
        title={editing ? 'Sửa lượt đổi quà' : 'Ghi nhận đổi quà'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khách hàng"
              options={CUSTOMERS.map((c) => ({ value: c.name, label: `${c.name} — ${c.code}` }))}
            />
          </Form.Item>
          <Form.Item name="item" label="Quà / Voucher" rules={[{ required: true, message: 'Chọn quà' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn quà hoặc voucher"
              options={VOUCHERS.map((v) => ({ value: v.title, label: `${v.title} (${v.value})` }))}
            />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="points" label="Điểm đã đổi" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} step={50} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="date" label="Ngày đổi" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
