import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { useBrandCurrency, useBrandDateTime } from '@/themeRuntime'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import PageTitle from '../components/base/PageTitle'
import { useGetBranches } from '../api/endpoints/branches'
import {
  useDeleteLuckyWheelsId,
  useDeleteLuckyWheelsIdPrizesPrizeId,
  useGetLuckyWheelsIdEligibleCustomers,
  useGetLuckyWheels,
  useGetLuckyWheelsIdPrizes,
  useGetLuckyWheelsIdSpins,
  usePostLuckyWheels,
  usePostLuckyWheelsIdPrizes,
  usePostLuckyWheelsIdSpins,
  usePutLuckyWheelsId,
  usePutLuckyWheelsIdPrizesPrizeId,
  usePutLuckyWheelsIdSpinsSpinIdClaim,
} from '../api/endpoints/lucky-wheels'
import type {
  GetLuckyWheelsIdEligibleCustomers200AllOfResponseDataItem as EligibleCustomer,
  PostLuckyWheelsBody,
  WheelPrize,
  WheelSpin,
} from '../api/models'
import { Can } from '@casl/react'

interface LuckyWheel { id: string; branch_id?: string | null; name: string; min_year_spent: number; spins_per_user: number; is_active?: boolean }

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
  const [editingPrize, setEditingPrize] = useState<WheelPrize | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [chosenCustomer, setChosenCustomer] = useState<EligibleCustomer | null>(null)
  const [manualPrizeOpen, setManualPrizeOpen] = useState(false)
  const [manualPrizeId, setManualPrizeId] = useState<string | null>(null)
  const [wheelForm] = Form.useForm()
  const [prizeForm] = Form.useForm()

  const wheelsQuery = useGetLuckyWheels()
  const branchesQuery = useGetBranches()
  const prizesQuery = useGetLuckyWheelsIdPrizes(selected?.id ?? '')
  const spinsQuery = useGetLuckyWheelsIdSpins(selected?.id ?? '')
  const eligibleQuery = useGetLuckyWheelsIdEligibleCustomers(
    selected?.id ?? '',
    customerSearch ? { search: customerSearch, limit: 50 } : { limit: 50 },
  )
  const createMutation = usePostLuckyWheels()
  const updateMutation = usePutLuckyWheelsId()
  const deleteMutation = useDeleteLuckyWheelsId()
  const prizeMutation = usePostLuckyWheelsIdPrizes()
  const prizeUpdateMutation = usePutLuckyWheelsIdPrizesPrizeId()
  const prizeDeleteMutation = useDeleteLuckyWheelsIdPrizesPrizeId()
  const spinForCustomerMutation = usePostLuckyWheelsIdSpins()
  const claimMutation = usePutLuckyWheelsIdSpinsSpinIdClaim()
  const wheels = wheelsQuery.data?.responseData ?? []
  const branches = branchesQuery.data?.responseData ?? []
  const prizes = prizesQuery.data?.responseData ?? []
  const spins = spinsQuery.data?.responseData ?? []
  const eligibleCustomers = eligibleQuery.data?.responseData ?? []

  useEffect(() => {
    if (!selected && wheels.length) setSelected(wheels[0])
  }, [wheels, selected])

  const selectWheel = (w: LuckyWheel) => {
    setSelected(w)
    setChosenCustomer(null)
  }
  const loadWheels = () => wheelsQuery.refetch()

  const submitWheel = async () => {
    const values = await wheelForm.validateFields()
    try {
      await createMutation.mutateAsync({ data: values as PostLuckyWheelsBody })
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

  const openCreatePrize = () => {
    setEditingPrize(null)
    prizeForm.resetFields()
    prizeForm.setFieldsValue({ prize_type: 'VOUCHER', weight: 1 })
    setPrizeOpen(true)
  }

  const openEditPrize = (p: WheelPrize) => {
    setEditingPrize(p)
    prizeForm.setFieldsValue({
      name: p.name,
      prize_type: p.prize_type,
      weight: p.weight,
      points: p.points ?? undefined,
      voucher_id: p.voucher_id ?? undefined,
      service_id: p.service_id ?? undefined,
      quantity_total: p.quantity_total ?? undefined,
      is_active: p.is_active !== false,
    })
    setPrizeOpen(true)
  }

  const submitPrize = async () => {
    const values = await prizeForm.validateFields()
    try {
      if (editingPrize) {
        await prizeUpdateMutation.mutateAsync({ id: selected!.id, prizeId: editingPrize.id, data: values })
        message.success('Đã cập nhật giải')
      } else {
        await prizeMutation.mutateAsync({ id: selected!.id, data: values })
        message.success('Đã thêm giải')
      }
      setPrizeOpen(false)
      await prizesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể lưu giải thưởng')
    }
  }

  const removePrize = async (p: WheelPrize) => {
    try {
      await prizeDeleteMutation.mutateAsync({ id: selected!.id, prizeId: p.id })
      message.success('Đã xóa giải')
      await prizesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể xóa giải thưởng')
    }
  }

  const spinForCustomer = async (random: boolean) => {
    if (!selected || !chosenCustomer?.customer_profile_id) return
    try {
      const res = await spinForCustomerMutation.mutateAsync({
        id: selected.id,
        data: {
          customer_profile_id: chosenCustomer.customer_profile_id ?? '',
          request_key: `admin-${selected.id}-${chosenCustomer.customer_profile_id}-${Date.now()}`,
          ...(random ? {} : { prize_id: manualPrizeId! }),
        },
      })
      const prizeName = res.responseData?.prize?.name
      message.success(prizeName ? `Kết quả: khách trúng giải "${prizeName}"` : 'Kết quả: không trúng thưởng')
      setManualPrizeOpen(false)
      setManualPrizeId(null)
      await Promise.all([eligibleQuery.refetch(), spinsQuery.refetch(), prizesQuery.refetch()])
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể quay cho khách')
    }
  }

  const openManualPrize = () => {
    if (!chosenCustomer) return
    setManualPrizeId(null)
    setManualPrizeOpen(true)
  }

  const claimSpin = async (spinId: string) => {
    if (!selected) return
    try {
      await claimMutation.mutateAsync({ id: selected.id, spinId })
      message.success('Đã xác nhận khách nhận giải')
      await spinsQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể xác nhận giải')
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
          <Card title={`Giải thưởng — ${selected.name}`} extra={<Can I="CREATE" a="WHEEL"><Button size="small" icon={<PlusOutlined />} onClick={openCreatePrize}>Thêm giải</Button></Can>}>
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
                {
                  title: '',
                  width: 140,
                  render: (_, row: WheelPrize) => (
                    <Space>
                      <Can I="UPDATE" a="WHEEL">
                        <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openEditPrize(row) }}>Sửa</Button>
                      </Can>
                      <Can I="DELETE" a="WHEEL">
                        <Popconfirm title="Xóa giải này? (chỉ xóa được khi chưa có lượt quay trúng giải)" onConfirm={() => removePrize(row)}>
                          <Button size="small" danger>Xóa</Button>
                        </Popconfirm>
                      </Can>
                    </Space>
                  ),
                },
              ]}
            />
          </Card>
        )}

        {selected && (
          <Can I="SPIN_ADMIN" a="WHEEL">
            <Card title={`Quay hộ khách — ${selected.name}`}>
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                <Space wrap>
                  <Input.Search
                    allowClear
                    placeholder="Tìm theo tên / SĐT"
                    style={{ width: 260 }}
                    onSearch={(v) => setCustomerSearch(v.trim() || '')}
                  />
                  {chosenCustomer && (
                    <Typography.Text>
                      Đã chọn: <Typography.Text strong>{chosenCustomer.full_name}</Typography.Text> ({chosenCustomer.phone})
                    </Typography.Text>
                  )}
                </Space>
                <Table
                  rowKey="customer_profile_id"
                  dataSource={eligibleCustomers}
                  loading={eligibleQuery.isLoading}
                  pagination={false}
                  size="small"
                  locale={{ emptyText: 'Không có khách đủ điều kiện' }}
                  onRow={(row) => ({ onClick: () => setChosenCustomer(row), style: { cursor: 'pointer' } })}
                  columns={[
                    {
                      title: 'Khách hàng', dataIndex: 'full_name', render: (v, row) => (
                        <Typography.Text strong style={chosenCustomer?.customer_profile_id === row.customer_profile_id ? { color: 'var(--brand-primary)' } : undefined}>
                          {v} {row.customer_code ? `(${row.customer_code})` : ''}
                        </Typography.Text>
                      ),
                    },
                    { title: 'SĐT', dataIndex: 'phone', width: 130 },
                    { title: 'Chi tiêu', dataIndex: 'spend', width: 130, render: (v) => `${Number(v).toLocaleString('vi-VN')}đ` },
                    { title: 'Lượt còn lại', dataIndex: 'spins_left', width: 110, render: (v, row) => `${v}/${row.spins_max}` },
                  ]}
                />
                <Space wrap>
                  <Button
                    type="primary"
                    disabled={!chosenCustomer || (chosenCustomer.spins_left ?? 0) <= 0 || spinForCustomerMutation.isPending}
                    loading={spinForCustomerMutation.isPending && !!manualPrizeId}
                    onClick={() => spinForCustomer(true)}
                  >
                    Quay ngẫu nhiên
                  </Button>
                  <Button
                    disabled={!chosenCustomer || (chosenCustomer.spins_left ?? 0) <= 0 || !prizes.length}
                    onClick={openManualPrize}
                  >
                    Ghi kết quả tay
                  </Button>
                </Space>
              </Space>
            </Card>
          </Can>
        )}

        {selected && (
          <Card title="Lịch sử quay">
            <Table<WheelSpin>
              rowKey="id"
              dataSource={spins}
              pagination={{ pageSize: 5 }}
              size="small"
              columns={[
                { title: 'Thời gian', dataIndex: 'spun_at', render: (v) => formatDateTime(v) },
                { title: 'Khách hàng', key: 'customer', render: (_, row) => row.customer_profile?.full_name || row.user_id || '—' },
                { title: 'Trúng', dataIndex: 'is_win', render: (v) => (v ? <Tag color="green">Trúng thưởng</Tag> : <Tag>Không trúng</Tag>) },
                { title: 'Giải', dataIndex: ['prize', 'name'], render: (v) => v || '—' },
                {
                  title: 'Trạng thái',
                  dataIndex: 'status',
                  width: 110,
                  render: (v) => (v === 'CLAIMED' ? <Tag color="blue">Đã nhận</Tag> : <Tag>Chờ nhận</Tag>),
                },
                {
                  title: '',
                  width: 140,
                  render: (_, row) =>
                    row.status === 'ISSUED' && row.is_win ? (
                      <Can I="SPIN_ADMIN" a="WHEEL">
                        <Button size="small" type="primary" ghost loading={claimMutation.isPending} onClick={() => claimSpin(row.id)}>
                          Xác nhận trúng
                        </Button>
                      </Can>
                    ) : null,
                },
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

      <Modal title={editingPrize ? 'Sửa giải thưởng' : 'Thêm giải thưởng'} open={prizeOpen} onCancel={() => setPrizeOpen(false)} onOk={submitPrize} okText="Lưu" cancelText="Hủy">
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
            {({ getFieldValue }) => (
              <>
                {getFieldValue('prize_type') === 'POINTS' ? (
                  <Form.Item name="points" label="Số điểm tặng" rules={[{ required: true }]}>
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                ) : null}
                {getFieldValue('prize_type') === 'VOUCHER' ? (
                  <Form.Item name="voucher_id" label="Voucher ID (UUID)" rules={[{ required: true, message: 'Nhập voucher ID' }]}>
                    <Input placeholder="UUID voucher cấp khi trúng" />
                  </Form.Item>
                ) : null}
                {getFieldValue('prize_type') === 'SERVICE' ? (
                  <Form.Item name="service_id" label="Dịch vụ ID (UUID)" rules={[{ required: true, message: 'Nhập dịch vụ ID' }]}>
                    <Input placeholder="UUID dịch vụ tặng khi trúng" />
                  </Form.Item>
                ) : null}
              </>
            )}
          </Form.Item>
          <Form.Item name="quantity_total" label="Số lượng (bỏ trống = không giới hạn)">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          {editingPrize && (
            <Form.Item name="is_active" label="Đang kích hoạt" valuePropName="checked">
              <Select options={[{ value: true, label: 'Bật' }, { value: false, label: 'Tắt' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <Modal
        title="Ghi kết quả tay"
        open={manualPrizeOpen}
        onCancel={() => setManualPrizeOpen(false)}
        onOk={() => spinForCustomer(false)}
        okText="Ghi kết quả"
        cancelText="Hủy"
        okButtonProps={{ disabled: !manualPrizeId, loading: spinForCustomerMutation.isPending }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
          Chọn giải trúng cho {chosenCustomer?.full_name} — hệ thống sẽ ghi kết quả và phát thưởng (bỏ qua quay ngẫu nhiên).
        </Typography.Paragraph>
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn giải trúng"
          value={manualPrizeId}
          onChange={setManualPrizeId}
          options={prizes
            .filter((p) => p.prize_type !== 'NONE' && (p.quantity_total == null || (p.quantity_given ?? 0) < p.quantity_total))
            .map((p) => ({ value: p.id!, label: `${p.name} (${TYPE_META[p.prize_type]?.label ?? p.prize_type})` }))}
        />
      </Modal>
    </>
  )
}
