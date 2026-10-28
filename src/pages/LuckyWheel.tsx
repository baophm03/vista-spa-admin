import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useBrandCurrency, useBrandDateTime } from '@/themeRuntime'
import PageTitle from '../components/base/PageTitle'
import { useGetBranches } from '../api/endpoints/branches'
import {
  useDeleteLuckyWheelsId,
  useGetLuckyWheels,
  useGetLuckyWheelsIdPrizes,
  useGetLuckyWheelsIdSpins,
  usePostLuckyWheels,
  usePostLuckyWheelsIdPrizes,
  usePutLuckyWheelsId,
} from '../api/endpoints/lucky-wheels'
import { Can } from '@casl/react'

interface Branch { id: string; name: string }
interface LuckyWheel { id: string; branch_id?: string; name: string; min_year_spent: number; spins_per_user: number; is_active?: boolean }
interface WheelPrize { id: string; name: string; prize_type: string; weight: number; quantity_total?: number; quantity_given: number }

const TYPE_META: Record<string, { label: string; color: string }> = {
  VOUCHER: { label: 'Voucher', color: 'gold' },
  SERVICE: { label: 'Dịch vụ', color: 'purple' },
  POINTS: { label: 'Điểm', color: 'geekblue' },
  NONE: { label: 'Không trúng', color: 'default' },
}

export default function LuckyWheel() {
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const { formatDateTime } = useBrandDateTime()
  const [selected, setSelected] = useState<LuckyWheel | null>(null)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [prizeOpen, setPrizeOpen] = useState(false)
  const [wheelForm] = Form.useForm()
  const [prizeForm] = Form.useForm()

  const wheelsQuery = useGetLuckyWheels()
  const branchesQuery = useGetBranches()
  const prizesQuery = useGetLuckyWheelsIdPrizes(selected?.id ?? '')
  const spinsQuery = useGetLuckyWheelsIdSpins(selected?.id ?? '')
  const createMutation = usePostLuckyWheels()
  const updateMutation = usePutLuckyWheelsId()
  const deleteMutation = useDeleteLuckyWheelsId()
  const prizeMutation = usePostLuckyWheelsIdPrizes()
  const wheels = (((wheelsQuery.data?.responseData ?? (wheelsQuery.data as any)?.data ?? []) as LuckyWheel[]))
  const branches = (((branchesQuery.data?.responseData ?? (branchesQuery.data as any)?.data ?? []) as Branch[]))
  const prizes = (((prizesQuery.data?.responseData ?? (prizesQuery.data as any)?.data ?? []) as WheelPrize[]))
  const spins = (((spinsQuery.data?.responseData ?? (spinsQuery.data as any)?.data ?? []) as any[]))

  useEffect(() => {
    if (!selected && wheels.length) setSelected(wheels[0])
  }, [wheels, selected])

  const selectWheel = (w: LuckyWheel) => setSelected(w)
  const loadWheels = () => wheelsQuery.refetch()

  const submitWheel = async () => {
    const values = await wheelForm.validateFields()
    try {
      await createMutation.mutateAsync({ data: values })
      message.success('Đã tạo vòng quay')
      setWheelOpen(false)
      await wheelsQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể tạo vòng quay')
    }
  }

  const toggleWheel = async (w: LuckyWheel) => {
    try {
      await updateMutation.mutateAsync({ id: w.id, data: { is_active: !w.is_active } })
      message.success(w.is_active ? 'Đã tắt vòng quay' : 'Đã bật vòng quay')
      await wheelsQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể cập nhật vòng quay')
    }
  }

  const removeWheel = async (w: LuckyWheel) => {
    try {
      await deleteMutation.mutateAsync({ id: w.id })
      message.success('Đã xóa vòng quay')
      setSelected(null)
      await wheelsQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể xóa vòng quay')
    }
  }

  const submitPrize = async () => {
    const values = await prizeForm.validateFields()
    try {
      await prizeMutation.mutateAsync({ id: selected!.id, data: values })
      message.success('Đã thêm giải')
      setPrizeOpen(false)
      await prizesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể thêm giải thưởng')
    }
  }

  const branchName = (id?: string) => (id ? branches.find((b) => b.id === id)?.name ?? '—' : 'Tất cả cơ sở')

  return (
    <>
      <PageTitle
        extra={
          <Space className="max-sm:flex! max-sm:w-full! max-sm:flex-wrap!">
            <Button icon={<ReloadOutlined />} onClick={loadWheels} />
            <Can I="CREATE" a="WHEEL">
              <Button className="max-sm:flex-1" type="primary" icon={<PlusOutlined />} onClick={() => setWheelOpen(true)}>
                Thêm vòng quay
              </Button>
            </Can>
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
            {
              title: 'Tên vòng quay', dataIndex: 'name', render: (v, row) => (
                <Typography.Text strong style={selected?.id === row.id ? { color: 'var(--brand-primary)' } : undefined}>{v}</Typography.Text>
              )
            },
            { title: 'Cơ sở', dataIndex: 'branch_id', render: (v) => branchName(v) },
            { title: 'Doanh số tối thiểu', dataIndex: 'min_year_spent', render: (v) => `${formatMoney(v)}/năm` },
            { title: 'Lượt/user', dataIndex: 'spins_per_user', width: 90 },
            { title: 'Trạng thái', dataIndex: 'is_active', width: 100, render: (v) => (v ? <Tag color="green">Đang mở</Tag> : <Tag>Tắt</Tag>) },
            {
              title: '',
              width: 160,
              render: (_, row) => (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Can I="UPDATE" a="WHEEL">
                    <Button size="small" onClick={() => toggleWheel(row)}>{row.is_active ? 'Tắt' : 'Bật'}</Button>
                  </Can>
                  <Can I="DELETE" a="WHEEL">
                    <Popconfirm title="Xóa vòng quay này?" onConfirm={() => removeWheel(row)}>
                      <Button size="small" danger>Xóa</Button>
                    </Popconfirm>
                  </Can>
                </Space>
              ),
            },
          ]}
        />

        {selected && (
          <Card title={`Giải thưởng — ${selected.name}`} extra={<Can I="CREATE" a="WHEEL"><Button size="small" icon={<PlusOutlined />} onClick={() => setPrizeOpen(true)}>Thêm giải</Button></Can>}>
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
                { title: 'Thời gian', dataIndex: 'spun_at', render: (v) => formatDateTime(v) },
                { title: 'Khách hàng', dataIndex: ['user', 'zalo_name'], render: (v) => v || '—' },
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
          <Form.Item name="min_year_spent" label="Doanh số tối thiểu năm" rules={[{ required: true }]}>
            <InputNumber min={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
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
