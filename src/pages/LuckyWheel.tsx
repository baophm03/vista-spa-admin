import { useMemo, useRef, useState } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { WHEEL_CONFIG, WHEEL_PRIZES, WHEEL_SPINS } from '../mock/admin'
import type { WheelPrize } from '../mock/admin'

const TYPE_META: Record<WheelPrize['type'], { label: string; color: string }> = {
  voucher: { label: 'Voucher', color: 'gold' },
  service: { label: 'Dịch vụ', color: 'purple' },
  points: { label: 'Điểm', color: 'geekblue' },
  none: { label: 'Không trúng', color: 'default' },
}

const COLORS = ['#8E63A9', '#B892D0', '#54316F', '#D9C1E8', '#7A5590', '#E9DDF0', '#9B7BB8', '#6F7071']

export default function LuckyWheel() {
  const [prizes, setPrizes] = useState<WheelPrize[]>(WHEEL_PRIZES)
  const [spins, setSpins] = useState(WHEEL_SPINS)
  const [config, setConfig] = useState(WHEEL_CONFIG)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<WheelPrize | null>(null)
  const [form] = Form.useForm()
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = useMemo(() => prizes.filter((p) => p.is_active), [prizes])
  const totalWeight = useMemo(() => active.reduce((s, p) => s + p.weight, 0) || 1, [active])

  const gradient = useMemo(() => {
    const seg = 360 / Math.max(active.length, 1)
    let acc = 0
    return active
      .map((_, i) => {
        const from = acc
        acc += seg
        return `${COLORS[i % COLORS.length]} ${from}deg ${acc}deg`
      })
      .join(', ')
  }, [active])

  const spin = () => {
    if (spinning || active.length === 0) return
    setSpinning(true)
    setResult(null)
    const roll = Math.random() * totalWeight
    let acc = 0
    let idx = 0
    for (let i = 0; i < active.length; i++) {
      acc += active[i].weight
      if (roll < acc) {
        idx = i
        break
      }
    }
    const seg = 360 / active.length
    const target = 360 * 5 + (360 - (idx * seg + seg / 2))
    setRotation((r) => r + target)
    spinTimer.current = setTimeout(() => {
      setSpinning(false)
      setResult(active[idx].name)
      setSpins((s) => [
        { id: String(Date.now()), customer: 'Khách thử (admin)', prize: active[idx].name, date: new Date().toLocaleString('vi-VN') },
        ...s,
      ])
    }, 3200)
  }

  const openModal = (p?: WheelPrize) => {
    setEditing(p ?? null)
    form.setFieldsValue(p ?? { name: '', type: 'voucher', weight: 10, quantity: 0, is_active: true })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (editing) {
      setPrizes((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...values } : r)))
      message.success('Đã cập nhật giải thưởng')
    } else {
      setPrizes((rs) => [...rs, { id: String(Date.now()), ...values }])
      message.success('Đã thêm giải thưởng')
    }
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm giải thưởng
          </Button>
        }
      >
        Quay số may mắn
      </PageTitle>

      <Row gutter={[20, 20]}>
        <Col xs={24} md={10}>
          <Card style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 260, height: 260, margin: '0 auto' }}>
              <div
                style={{
                  position: 'absolute',
                  top: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 2,
                  fontSize: 24,
                }}
              >
                ▼
              </div>
              <div
                style={{
                  width: 260,
                  height: 260,
                  borderRadius: '50%',
                  background: `conic-gradient(${gradient})`,
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  border: '6px solid #54316F',
                  boxShadow: '0 8px 24px rgba(84, 49, 111, 0.25)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: '#54316F',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                }}
              >
                VISTA
              </div>
            </div>
            <Button
              type="primary"
              size="large"
              style={{ marginTop: 20 }}
              loading={spinning}
              onClick={spin}
              icon={<ReloadOutlined />}
            >
              Quay thử
            </Button>
            {result && (
              <div style={{ marginTop: 12 }}>
                <Tag color="purple" style={{ fontSize: 14, padding: '4px 14px' }}>
                  Kết quả: {result}
                </Tag>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} md={14}>
          <Card title="Cấu hình vòng quay" style={{ marginBottom: 20 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={14}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Bật vòng quay cho khách</span>
                <Switch
                  checked={config.is_enabled}
                  onChange={(v) => {
                    setConfig((c) => ({ ...c, is_enabled: v }))
                    message.success(v ? 'Đã bật vòng quay' : 'Đã tắt vòng quay')
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <InputNumber
                  min={1}
                  max={10}
                  value={config.spins_per_customer}
                  onChange={(v) => setConfig((c) => ({ ...c, spins_per_customer: v ?? 1 }))}
                  addonAfter="lượt/khách"
                  style={{ width: 160 }}
                />
                <InputNumber
                  min={0}
                  step={50000}
                  value={config.min_order_for_spin}
                  onChange={(v) => setConfig((c) => ({ ...c, min_order_for_spin: v ?? 0 }))}
                  addonAfter="đ đơn để được quay"
                  style={{ width: 220 }}
                />
              </div>
              <div style={{ fontSize: 12, color: '#6F7071' }}>
                Tổng tỷ lệ: <b>{totalWeight}</b> — mỗi giải chiếm{' '}
                {active.map((p) => `${p.name} ${Math.round((p.weight / totalWeight) * 100)}%`).join(', ')}
              </div>
            </Space>
          </Card>

          <Card title="Giải thưởng">
            <Table
              rowKey="id"
              dataSource={prizes}
              size="small"
              pagination={false}
              columns={[
                { title: 'Giải', dataIndex: 'name', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
                {
                  title: 'Loại',
                  dataIndex: 'type',
                  width: 110,
                  render: (v: WheelPrize['type']) => <Tag color={TYPE_META[v].color}>{TYPE_META[v].label}</Tag>,
                },
                {
                  title: 'Tỷ lệ',
                  dataIndex: 'weight',
                  width: 80,
                  render: (v) => `${Math.round((v / totalWeight) * 100)}%`,
                },
                {
                  title: 'SL giới hạn',
                  dataIndex: 'quantity',
                  width: 100,
                  render: (v) => (v === 0 ? '—' : v),
                },
                {
                  title: '',
                  width: 130,
                  render: (_, row) => (
                    <Space>
                      <Button size="small" onClick={() => openModal(row)}>
                        Sửa
                      </Button>
                      <Popconfirm
                        title="Xóa giải thưởng này?"
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => {
                          setPrizes((rs) => rs.filter((r) => r.id !== row.id))
                          message.success('Đã xóa giải thưởng')
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
          </Card>
        </Col>
      </Row>

      <Card title="Lượt quay gần đây" style={{ marginTop: 20 }}>
        <Table
          rowKey="id"
          dataSource={spins}
          size="small"
          pagination={{ pageSize: 5 }}
          columns={[
            { title: 'Khách hàng', dataIndex: 'customer' },
            {
              title: 'Phần thưởng',
              dataIndex: 'prize',
              render: (v) =>
                v.includes('may mắn') ? <Tag>{v}</Tag> : <Tag color="purple">{v}</Tag>,
            },
            { title: 'Thời gian', dataIndex: 'date', width: 180 },
          ]}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa giải thưởng' : 'Thêm giải thưởng'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên giải" rules={[{ required: true, message: 'Nhập tên giải' }]}>
            <Input placeholder="VD: Voucher 50k" />
          </Form.Item>
          <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
            <Select
              options={(Object.keys(TYPE_META) as WheelPrize['type'][]).map((t) => ({
                value: t,
                label: TYPE_META[t].label,
              }))}
            />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="weight" label="Tỷ lệ (trọng số)" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="quantity" label="Số lượng giới hạn (0 = không giới hạn)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="is_active" label="Hiện trên vòng quay" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
