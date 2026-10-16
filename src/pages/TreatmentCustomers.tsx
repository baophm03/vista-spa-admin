import { useMemo, useState } from 'react'
import { Button, Card, Col, DatePicker, Form, InputNumber, Modal, Popconfirm, Progress, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { CUSTOMERS, STAFFS, TREATMENT_ASSIGNMENTS, TREATMENT_CATALOG } from '../mock/admin'
import type { TreatmentAssignment } from '../mock/admin'

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'ongoing', label: 'Đang làm' },
  { value: 'done', label: 'Hoàn tất' },
]

export default function TreatmentCustomers() {
  const [rows, setRows] = useState<TreatmentAssignment[]>(TREATMENT_ASSIGNMENTS)
  const [filter, setFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TreatmentAssignment | null>(null)
  const [form] = Form.useForm()

  const list = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  )

  const stats = useMemo(() => {
    const ongoing = rows.filter((r) => r.status === 'ongoing')
    return {
      total: rows.length,
      ongoing: ongoing.length,
      done: rows.filter((r) => r.status === 'done').length,
      customers: new Set(ongoing.map((r) => r.customer)).size,
    }
  }, [rows])

  const openModal = (t?: TreatmentAssignment) => {
    setEditing(t ?? null)
    form.setFieldsValue(
      t ?? {
        customer: undefined,
        treatment: undefined,
        total_sessions: 4,
        done_sessions: 0,
        start_date: '',
        staff: STAFFS[0],
      },
    )
    setOpen(true)
  }

  const onTreatmentChange = (name: string) => {
    const item = TREATMENT_CATALOG.find((t) => t.name === name)
    if (item) form.setFieldsValue({ total_sessions: item.sessions })
  }

  const submit = async () => {
    const values = await form.validateFields()
    const row = {
      ...values,
      start_date: values.start_date?.format?.('DD/MM/YYYY') ?? values.start_date,
      status: values.done_sessions >= values.total_sessions ? 'done' : 'ongoing',
    }
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...row } : r)))
      message.success('Đã cập nhật liệu trình của khách')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), code: `LT-0${239 + rs.length}`, ...row }])
      message.success('Đã thêm khách vào liệu trình')
    }
    setOpen(false)
  }

  const addSession = (row: TreatmentAssignment) => {
    const next = row.done_sessions + 1
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? { ...r, done_sessions: next, status: next >= r.total_sessions ? 'done' : 'ongoing' }
          : r,
      ),
    )
    message.success(
      next >= row.total_sessions
        ? `Hoàn tất liệu trình ${row.code} 🎉`
        : `Ghi nhận buổi ${next}/${row.total_sessions} — ${row.code}`,
    )
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Segmented options={FILTERS} value={filter} onChange={(v) => setFilter(v as string)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm khách vào liệu trình
            </Button>
          </Space>
        }
      >
        Khách dùng liệu trình
      </PageTitle>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Tổng lượt đăng ký" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Đang thực hiện" value={stats.ongoing} valueStyle={{ color: '#8E63A9' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Đã hoàn tất" value={stats.done} valueStyle={{ color: '#16A34A' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Khách đang dùng liệu trình" value={stats.customers} valueStyle={{ color: '#D97706' }} />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        dataSource={list}
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
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.treatment}</div>
              </div>
            ),
          },
          {
            title: 'Tiến độ',
            width: 200,
            render: (_, row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Progress
                  percent={Math.round((row.done_sessions / row.total_sessions) * 100)}
                  size="small"
                  strokeColor="#8E63A9"
                  style={{ flex: 1, margin: 0 }}
                />
                <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                  {row.done_sessions}/{row.total_sessions}
                </span>
              </div>
            ),
          },
          { title: 'Chuyên viên', dataIndex: 'staff', width: 120 },
          { title: 'Bắt đầu', dataIndex: 'start_date', width: 110 },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 110,
            render: (v) => (v === 'done' ? <Tag color="green">Hoàn tất</Tag> : <Tag color="purple">Đang làm</Tag>),
          },
          {
            title: '',
            width: 180,
            render: (_, row) => (
              <Space>
                {row.status === 'ongoing' && (
                  <Button size="small" type="primary" ghost onClick={() => addSession(row)}>
                    +1 buổi
                  </Button>
                )}
                <Button size="small" onClick={() => openModal(row)}>
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa lượt đăng ký này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa lượt đăng ký')
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
        title={editing ? 'Sửa lượt đăng ký' : 'Thêm khách vào liệu trình'}
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
              placeholder="Chọn khách hàng từ danh sách"
              options={CUSTOMERS.map((c) => ({ value: c.name, label: `${c.name} — ${c.code}` }))}
            />
          </Form.Item>
          <Form.Item name="treatment" label="Liệu trình" rules={[{ required: true, message: 'Chọn liệu trình' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn liệu trình"
              onChange={onTreatmentChange}
              options={TREATMENT_CATALOG.filter((t) => t.is_active).map((t) => ({
                value: t.name,
                label: `${t.name} (${t.sessions} buổi)`,
              }))}
            />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="total_sessions" label="Tổng số buổi" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="done_sessions" label="Đã thực hiện" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} max={20} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="start_date" label="Ngày bắt đầu" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="staff" label="Chuyên viên" style={{ flex: 1 }}>
              <Select options={STAFFS.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
