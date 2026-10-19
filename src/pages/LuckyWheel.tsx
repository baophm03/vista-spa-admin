import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/PageTitle'
import {
  bizErrorMessage,
  createLuckyWheel,
  createWheelPrize,
  deleteLuckyWheel,
  listBranches,
  listLuckyWheels,
  listWheelPrizes,
  listWheelSpins,
  updateLuckyWheel,
} from '../api/newsky'
import type { Branch, LuckyWheel, WheelPrize } from '../api/newsky'

const TYPE_META: Record<string, { label: string; color: string }> = {
  VOUCHER: { label: 'Voucher', color: 'gold' },
  SERVICE: { label: 'Dịch vụ', color: 'purple' },
  POINTS: { label: 'Điểm', color: 'geekblue' },
  NONE: { label: 'Không trúng', color: 'default' },
}

export default function LuckyWheel() {
  const [wheels, setWheels] = useState<LuckyWheel[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [selected, setSelected] = useState<LuckyWheel | null>(null)
  const [prizes, setPrizes] = useState<WheelPrize[]>([])
  const [spins, setSpins] = useState<any[]>([])
  const [wheelOpen, setWheelOpen] = useState(false)
  const [prizeOpen, setPrizeOpen] = useState(false)
  const [wheelForm] = Form.useForm()
  const [prizeForm] = Form.useForm()

  const loadWheels = useCallback(async () => {
    try {
      const data = await listLuckyWheels()
      setWheels(data)
      if (data.length && !selected) selectWheel(data[0])
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectWheel = async (w: LuckyWheel) => {
    setSelected(w)
    try {
      setPrizes(await listWheelPrizes(w.id))
      setSpins((await listWheelSpins(w.id)) as any[])
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  useEffect(() => {
    loadWheels()
    listBranches().then(setBranches).catch(() => undefined)
  }, [loadWheels])

  const submitWheel = async () => {
    const values = await wheelForm.validateFields()
    try {
      await createLuckyWheel(values)
      message.success('Đã tạo vòng quay')
      setWheelOpen(false)
      loadWheels()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const toggleWheel = async (w: LuckyWheel) => {
    try {
      await updateLuckyWheel(w.id, { is_active: !w.is_active })
      message.success(w.is_active ? 'Đã tắt vòng quay' : 'Đã bật vòng quay')
      loadWheels()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const removeWheel = async (w: LuckyWheel) => {
    try {
      await deleteLuckyWheel(w.id)
      message.success('Đã xóa vòng quay')
      setSelected(null)
      loadWheels()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const submitPrize = async () => {
    const values = await prizeForm.validateFields()
    try {
      await createWheelPrize(selected!.id, values)
      message.success('Đã thêm giải')
      setPrizeOpen(false)
      selectWheel(selected!)
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const branchName = (id?: string) => (id ? branches.find((b) => b.id === id)?.name ?? '—' : 'Tất cả cơ sở')

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadWheels} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setWheelOpen(true)}>
              Thêm vòng quay
            </Button>
          </Space>
        }
      >
        Quay số may mắn
      </PageTitle>

      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        <Table
          rowKey="id"
          dataSource={wheels}
          pagination={false}
          onRow={(row) => ({ onClick: () => selectWheel(row), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'Tên vòng quay', dataIndex: 'name', render: (v, row) => (
              <Typography.Text strong style={selected?.id === row.id ? { color: '#8E63A9' } : undefined}>{v}</Typography.Text>
            ) },
            { title: 'Cơ sở', dataIndex: 'branch_id', render: (v) => branchName(v) },
            { title: 'Doanh số tối thiểu', dataIndex: 'min_year_spent', render: (v) => `${Number(v).toLocaleString('vi-VN')}đ/năm` },
            { title: 'Lượt/user', dataIndex: 'spins_per_user', width: 90 },
            { title: 'Trạng thái', dataIndex: 'is_active', width: 100, render: (v) => (v ? <Tag color="green">Đang mở</Tag> : <Tag>Tắt</Tag>) },
            {
              title: '',
              width: 160,
              render: (_, row) => (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button size="small" onClick={() => toggleWheel(row)}>{row.is_active ? 'Tắt' : 'Bật'}</Button>
                  <Popconfirm title="Xóa vòng quay này?" onConfirm={() => removeWheel(row)}>
                    <Button size="small" danger>Xóa</Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />

        {selected && (
          <Card title={`Giải thưởng — ${selected.name}`} extra={<Button size="small" icon={<PlusOutlined />} onClick={() => setPrizeOpen(true)}>Thêm giải</Button>}>
            <Table
              rowKey="id"
              dataSource={prizes}
              pagination={false}
              size="small"
              columns={[
                { title: 'Tên giải', dataIndex: 'name' },
                { title: 'Loại', dataIndex: 'prize_type', render: (v: string) => <Tag color={TYPE_META[v]?.color}>{TYPE_META[v]?.label ?? v}</Tag> },
                { title: 'Trọng số', dataIndex: 'weight', width: 90 },
                { title: 'Số lượng', key: 'qty', width: 120, render: (_, row) => (row.quantity_total != null ? `${row.quantity_given}/${row.quantity_total}` : '∞') },
              ]}
            />
          </Card>
        )}

        {selected && (
          <Card title="Lịch sử quay">
            <Table
              rowKey="id"
              dataSource={spins}
              pagination={{ pageSize: 5 }}
              size="small"
              columns={[
                { title: 'Thời gian', dataIndex: 'spun_at', render: (v) => dayjs(v).format('DD/MM/YYYY HH:mm') },
                { title: 'Trúng', dataIndex: 'is_win', render: (v) => (v ? <Tag color="green">Trúng thưởng</Tag> : <Tag>Không trúng</Tag>) },
                { title: 'Giải', dataIndex: ['prize', 'name'], render: (v) => v || '—' },
              ]}
            />
          </Card>
        )}
      </Space>

      <Modal title="Thêm vòng quay" open={wheelOpen} onCancel={() => setWheelOpen(false)} onOk={submitWheel} okText="Lưu" cancelText="Hủy">
        <Form form={wheelForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên vòng quay" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="VD: Quay may mắn tháng 10" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="branch_id" label="Cơ sở (bỏ trống = tất cả)" style={{ flex: 1 }}>
              <Select allowClear options={branches.map((b) => ({ value: b.id, label: b.name }))} />
            </Form.Item>
            <Form.Item name="spins_per_user" label="Lượt/user" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="min_year_spent" label="Doanh số tối thiểu năm (đ)" rules={[{ required: true }]}>
            <InputNumber min={0} step={100000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Thêm giải thưởng" open={prizeOpen} onCancel={() => setPrizeOpen(false)} onOk={submitPrize} okText="Lưu" cancelText="Hủy">
        <Form form={prizeForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên giải" rules={[{ required: true, message: 'Nhập tên giải' }]}>
            <Input placeholder="VD: Voucher giảm 100k" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="prize_type" label="Loại giải" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={Object.keys(TYPE_META).map((k) => ({ value: k, label: TYPE_META[k].label }))} />
            </Form.Item>
            <Form.Item name="weight" label="Trọng số" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.prize_type !== cur.prize_type}>
            {({ getFieldValue }) =>
              getFieldValue('prize_type') === 'POINTS' ? (
                <Form.Item name="points" label="Số điểm tặng" rules={[{ required: true }]}>
                  <InputNumber min={1} style={{ width: '100%' }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="quantity_total" label="Số lượng (bỏ trống = không giới hạn)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
