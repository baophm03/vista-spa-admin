import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd'
import { useBrandCurrency, useBrandDateTime } from '@/themeRuntime'
import { DeleteOutlined, EditOutlined, PauseCircleOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import PageTitle from '../../components/base/PageTitle'
import RowActionsMenu from '../../components/base/RowActionsMenu'
import TableEmpty from '../../components/base/TableEmpty'
import ListPagination from '../../components/base/ListPagination'
import { paginateRows } from '../../utils/listTable'
import { useGetBranches } from '../../api/endpoints/branches'
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
} from '../../api/endpoints/lucky-wheels'
import type {
  GetLuckyWheelsIdEligibleCustomers200AllOfResponseDataItem as EligibleCustomer,
  PostLuckyWheelsBody,
  WheelPrize,
  WheelSpin,
} from '../../api/models'
import { Can, useAbility } from '@casl/react'
import ManualPrizeModal from './components/ManualPrizeModal'
import PrizeFormModal from './components/PrizeFormModal'
import WheelFormModal from './components/WheelFormModal'
import WheelSpinModal, { type WheelSpinResult } from './components/WheelSpinModal'
import { PRIZE_TYPE_META as TYPE_META } from './components/constants'

interface LuckyWheel { id: string; branch_id?: string | null; name: string; min_year_spent: number; spins_per_user: number; is_active?: boolean }

export default function LuckyWheel() {
  const { format: formatMoney } = useBrandCurrency()
  const { formatDateTime } = useBrandDateTime()
  const ability = useAbility()
  const [selected, setSelected] = useState<LuckyWheel | null>(null)
  const [wheelOpen, setWheelOpen] = useState(false)
  const [prizeOpen, setPrizeOpen] = useState(false)
  const [editingPrize, setEditingPrize] = useState<WheelPrize | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [chosenCustomer, setChosenCustomer] = useState<EligibleCustomer | null>(null)
  const [manualPrizeOpen, setManualPrizeOpen] = useState(false)
  const [manualPrizeId, setManualPrizeId] = useState<string | null>(null)
  const [spinModalOpen, setSpinModalOpen] = useState(false)
  const [spinResult, setSpinResult] = useState<WheelSpinResult | null>(null)
  const [spinPage, setSpinPage] = useState(1)
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

  // Gõ tìm khách có debounce 400ms — giống các page danh sách khác
  useEffect(() => {
    const timer = setTimeout(() => setCustomerSearch(customerSearchInput.trim()), 400)
    return () => clearTimeout(timer)
  }, [customerSearchInput])

  const selectWheel = (w: LuckyWheel) => {
    setSelected(w)
    setChosenCustomer(null)
    setSpinPage(1)
  }

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

  /** Quay ngẫu nhiên có hiệu ứng: mở modal wheel → gọi API → wheel quay tới ô trúng rồi hiện kết quả */
  const spinRandomForCustomer = async () => {
    if (!selected || !chosenCustomer?.customer_profile_id) return
    setSpinResult(null)
    setSpinModalOpen(true)
    try {
      const res = await spinForCustomerMutation.mutateAsync({
        id: selected.id,
        data: {
          customer_profile_id: chosenCustomer.customer_profile_id ?? '',
          request_key: `admin-${selected.id}-${chosenCustomer.customer_profile_id}-${Date.now()}`,
        },
      })
      // chờ tối thiểu 1 nhịp cho hiệu ứng quay liên tục thấy rõ trước khi dừng
      await new Promise((resolve) => setTimeout(resolve, 700))
      setSpinResult((res.responseData ?? {}) as WheelSpinResult)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể quay cho khách')
      setSpinModalOpen(false)
    }
  }

  const closeSpinModal = () => {
    setSpinModalOpen(false)
    void Promise.all([eligibleQuery.refetch(), spinsQuery.refetch(), prizesQuery.refetch()])
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
        subtitle="Cấu hình vòng quay may mắn và phần thưởng"
        right={
          <Can I="CREATE" a="WHEEL">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setWheelOpen(true)}>
              Thêm vòng quay
            </Button>
          </Can>
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
              title: 'Hành động',
              key: 'actions',
              align: 'center' as const,
              width: 90,
              render: (_, row) => (
                <RowActionsMenu
                  items={[
                    ...(ability.can('UPDATE' as never, 'WHEEL')
                      ? [{ key: 'toggle', icon: row.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />, label: row.is_active ? 'Tắt' : 'Bật' }]
                      : []),
                    ...(ability.can('DELETE' as never, 'WHEEL')
                      ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true }]
                      : []),
                  ]}
                  onSelect={(key) => {
                    if (key === 'toggle') toggleWheel(row)
                    else if (key === 'delete') {
                      Modal.confirm({
                        title: 'Xóa vòng quay này?',
                        okText: 'Xóa',
                        okButtonProps: { danger: true },
                        cancelText: 'Hủy',
                        onOk: () => removeWheel(row),
                      })
                    }
                  }}
                />
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
                  title: 'Hành động',
                  key: 'actions',
                  align: 'center' as const,
                  width: 90,
                  render: (_, row: WheelPrize) => (
                    <RowActionsMenu
                      items={[
                        ...(ability.can('UPDATE' as never, 'WHEEL')
                          ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }]
                          : []),
                        ...(ability.can('DELETE' as never, 'WHEEL')
                          ? [{ key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true }]
                          : []),
                      ]}
                      onSelect={(key) => {
                        if (key === 'edit') openEditPrize(row)
                        else if (key === 'delete') {
                          Modal.confirm({
                            title: 'Xóa giải này?',
                            content: 'Chỉ xóa được khi chưa có lượt quay trúng giải.',
                            okText: 'Xóa',
                            okButtonProps: { danger: true },
                            cancelText: 'Hủy',
                            onOk: () => removePrize(row),
                          })
                        }
                      }}
                    />
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
                  <Input
                    allowClear
                    prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
                    placeholder="Tìm theo tên / SĐT"
                    className="w-[260px]!"
                    value={customerSearchInput}
                    onChange={(event) => setCustomerSearchInput(event.target.value)}
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
                  locale={{ emptyText: <TableEmpty description="Không có khách đủ điều kiện" /> }}
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
                    onClick={() => void spinRandomForCustomer()}
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
              dataSource={paginateRows(spins, spinPage, 5)}
              pagination={false}
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
            <ListPagination page={spinPage} limit={5} total={spins.length} onChange={setSpinPage} noun="lượt quay" />
          </Card>
        )}
      </Space>

      <WheelFormModal
        open={wheelOpen}
        form={wheelForm}
        branches={branches}
        onCancel={() => setWheelOpen(false)}
        onSubmit={submitWheel}
      />

      <PrizeFormModal
        open={prizeOpen}
        form={prizeForm}
        editingPrize={editingPrize}
        onCancel={() => setPrizeOpen(false)}
        onSubmit={submitPrize}
      />

      <ManualPrizeModal
        open={manualPrizeOpen}
        prizes={prizes}
        prizeId={manualPrizeId}
        onPrizeIdChange={setManualPrizeId}
        customerName={chosenCustomer?.full_name}
        loading={spinForCustomerMutation.isPending}
        onCancel={() => setManualPrizeOpen(false)}
        onSubmit={() => spinForCustomer(false)}
      />

      <WheelSpinModal
        open={spinModalOpen}
        prizes={prizes}
        customerName={chosenCustomer?.full_name}
        waiting={spinModalOpen && !spinResult}
        result={spinResult}
        onClose={closeSpinModal}
      />
    </>
  )
}