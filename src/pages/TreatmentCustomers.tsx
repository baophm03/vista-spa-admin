import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Progress, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import {
  bizErrorMessage,
  cancelCustomerTreatment,
  createCustomerTreatment,
  createTreatmentPayment,
  createTreatmentSession,
  listCustomerProfiles,
  listCustomerTreatments,
  listTreatmentPackages,
  listTreatmentPayments,
  listTreatmentSessions,
} from '../api/newsky'
import type { CustomerProfile, CustomerTreatment, TreatmentPackage } from '../api/newsky'

const QUOTA_LABEL: Record<string, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn gói',
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang làm' },
  { value: 'FINISHED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang làm', color: 'purple' },
  FINISHED: { label: 'Hoàn tất', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

export default function TreatmentCustomers() {
  const [rows, setRows] = useState<CustomerTreatment[]>([])
  const [profiles, setProfiles] = useState<CustomerProfile[]>([])
  const [packages, setPackages] = useState<TreatmentPackage[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  // Drawer chi tiết
  const [detail, setDetail] = useState<CustomerTreatment | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [payOpen, setPayOpen] = useState(false)
  const [payForm] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listCustomerTreatments())
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    listCustomerProfiles({ page: 1, limit: 200 }).then(({ data }) => setProfiles(data)).catch(() => undefined)
    listTreatmentPackages().then(setPackages).catch(() => undefined)
  }, [load])

  const list = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  )

  const stats = useMemo(() => ({
    total: rows.length,
    ongoing: rows.filter((r) => r.status === 'ACTIVE').length,
    done: rows.filter((r) => r.status === 'FINISHED').length,
    debt: rows.reduce((s, r) => s + Number(r.debt_amount ?? 0), 0),
  }), [rows])

  const openDetail = async (row: CustomerTreatment) => {
    setDetail(row)
    try {
      setSessions((await listTreatmentSessions(row.id)) as any[])
      setPayments((await listTreatmentPayments(row.id)) as any[])
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const openModal = () => {
    form.setFieldsValue({ customer_profile_id: undefined, package_id: undefined, total_amount: undefined })
    setOpen(true)
  }

  const onPackageChange = (id: string) => {
    const pkg = packages.find((p) => p.id === id)
    if (pkg) form.setFieldsValue({ total_amount: pkg.list_price ?? undefined })
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await createCustomerTreatment(values)
      message.success('Đã thêm khách vào liệu trình')
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const addSession = async (row: CustomerTreatment) => {
    try {
      await createTreatmentSession(row.id, {})
      message.success('Đã tạo buổi mới')
      if (detail?.id === row.id) openDetail(row)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const cancelTreatment = async (row: CustomerTreatment) => {
    try {
      await cancelCustomerTreatment(row.id)
      message.success('Đã hủy liệu trình')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const submitPayment = async () => {
    const values = await payForm.validateFields()
    try {
      await createTreatmentPayment(detail!.id, values)
      message.success('Đã ghi nhận thanh toán')
      setPayOpen(false)
      payForm.resetFields()
      openDetail(detail!)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const profileName = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? id?.slice(0, 8)
  const packageName = (id: string) => packages.find((p) => p.id === id)?.name ?? '—'

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
            <Statistic title="Tổng công nợ" value={stats.debt} suffix="đ" valueStyle={{ color: '#D97706' }} />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={list}
        onRow={(row) => ({ onClick: () => openDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Khách hàng',
            key: 'customer',
            render: (_, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{profileName(row.customer_profile_id)}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{packageName(row.package_id)}</div>
              </div>
            ),
          },
          {
            title: 'Tiến độ',
            width: 200,
            render: (_, row) => {
              const total = row.quota_type === 'UNLIMITED' ? null : row.quota_type === 'VALUE' ? null : row.sessions_total
              const used = row.sessions_used ?? 0
              return total ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Progress percent={Math.round((used / total) * 100)} size="small" strokeColor="#8E63A9" style={{ flex: 1, margin: 0 }} />
                  <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {used}/{total}
                  </span>
                </div>
              ) : (
                <Tag color="gold">{row.quota_type === 'UNLIMITED' ? 'Trọn gói' : `Định mức ${Number(row.value_used ?? 0).toLocaleString('vi-VN')}đ`}</Tag>
              )
            },
          },
          {
            title: 'Thanh toán',
            key: 'payment',
            width: 200,
            render: (_, row) => (
              <div>
                <div style={{ fontSize: 13 }}>
                  {Number(row.paid_amount ?? 0).toLocaleString('vi-VN')} / {Number(row.total_amount ?? 0).toLocaleString('vi-VN')}đ
                </div>
                <Tag color={row.debt_amount > 0 ? 'orange' : 'green'} style={{ marginTop: 4 }}>
                  {row.debt_amount > 0 ? `Còn nợ ${Number(row.debt_amount).toLocaleString('vi-VN')}đ` : 'Đã trả đủ'}
                </Tag>
              </div>
            ),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 110,
            render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
          {
            title: '',
            width: 240,
            render: (_, row) => (
              <Space onClick={(e) => e.stopPropagation()}>
                {row.status === 'ACTIVE' && (
                  <Button size="small" type="primary" ghost onClick={() => addSession(row)}>
                    +1 buổi
                  </Button>
                )}
                {row.debt_amount > 0 && row.status !== 'CANCELLED' && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDetail(row)
                      payForm.setFieldsValue({ amount: row.debt_amount, method: 'CASH' })
                      setPayOpen(true)
                    }}
                  >
                    Thu tiền
                  </Button>
                )}
                {row.status === 'ACTIVE' && (
                  <Popconfirm title="Hủy liệu trình này?" okText="Hủy" cancelText="Không" onConfirm={() => cancelTreatment(row)}>
                    <Button size="small" danger>
                      Hủy LT
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Thêm khách vào liệu trình"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khách hàng từ danh sách"
              options={profiles.map((c) => ({ value: c.id, label: `${c.full_name} — ${c.phone}` }))}
            />
          </Form.Item>
          <Form.Item name="package_id" label="Liệu trình" rules={[{ required: true, message: 'Chọn liệu trình' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn liệu trình"
              onChange={onPackageChange}
              options={packages.filter((p) => p.is_active).map((p) => ({
                value: p.id,
                label: `${p.name} (${QUOTA_LABEL[p.quota_type ?? ''] ?? p.quota_type})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="total_amount" label="Số tiền (đ)" rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <InputNumber min={0} step={100000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Ghi nhận thanh toán"
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={submitPayment}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={payForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="amount" label="Số tiền (đ)" rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <InputNumber min={1} step={50000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'CASH', label: 'Tiền mặt' },
                { value: 'BANK', label: 'Chuyển khoản' },
                { value: 'POS', label: 'POS' },
                { value: 'OTHER', label: 'Khác' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detail ? `Chi tiết — ${profileName(detail.customer_profile_id)}` : ''}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
      >
        {detail && (
          <>
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Buổi điều trị
            </Typography.Title>
            <Table
              rowKey="id"
              dataSource={sessions}
              pagination={false}
              size="small"
              columns={[
                { title: 'Buổi', dataIndex: 'session_no', width: 70 },
                { title: 'Trạng thái', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                { title: 'KTV', dataIndex: ['staff', 'zalo_name'], render: (v) => v || '—' },
              ]}
            />
            <Typography.Title level={5} style={{ marginTop: 16 }}>
              Lịch sử thanh toán
            </Typography.Title>
            <Table
              rowKey="id"
              dataSource={payments}
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Số tiền',
                  dataIndex: 'amount',
                  render: (v) => `${Number(v).toLocaleString('vi-VN')}đ`,
                },
                { title: 'Phương thức', dataIndex: 'method', width: 110 },
                { title: 'Ghi chú', dataIndex: 'note', render: (v) => v || '—' },
              ]}
            />
          </>
        )}
      </Modal>
    </>
  )
}
