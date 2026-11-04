import { useCallback, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  CheckOutlined,
  EditOutlined,
  EyeInvisibleOutlined,
  GiftOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useBrandDateTime } from '@/themeRuntime'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { Reward } from '@/api/models/reward'
import type { Voucher } from '@/api/models/voucher'
import type { Service } from '@/api/models/service'
import type { PostCustomerProfilesIdRedeemRewardBody } from '@/api/models/postCustomerProfilesIdRedeemRewardBody'
import type { PutRewardRedemptionsIdCancelBody } from '@/api/models/putRewardRedemptionsIdCancelBody'
import {
  deleteRewardsId,
  getGetRewardRedemptionsQueryKey,
  getGetRewardsQueryKey,
  getRewardRedemptions,
  getRewards,
  postRewards,
  putRewardRedemptionsIdCancel,
  putRewardRedemptionsIdUse,
  putRewardsId,
} from '@/api/endpoints/rewards'
import { getCustomerProfiles, postCustomerProfilesIdRedeemReward } from '@/api/endpoints/customer-profiles'
import { getVouchers } from '@/api/endpoints/vouchers'
import { getService } from '@/api/endpoints/services'
import { Can, useAbility } from '@casl/react'
import CancelRedemptionModal from './components/CancelRedemptionModal'
import RedeemModal from './components/RedeemModal'
import RewardModal from './components/RewardModal'
import {
  DEFAULT_REDEMPTION_COLUMNS,
  REDEMPTION_COLUMN_OPTIONS,
  REDEMPTION_META,
  TYPE_META,
  remainingLabel,
  type RedemptionColumnKey,
  type RewardRedemptionRow,
  type RewardRow,
  type RewardType,
} from './components/constants'

function RewardCatalogTab({ onChanged }: { onChanged: () => void }) {
  const ability = useAbility()
  const canRedeem = ability.can('REDEEM_ADMIN', 'REWARD')
  const canUpdate = ability.can('UPDATE', 'REWARD')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RewardRow | null>(null)
  const [redeemTarget, setRedeemTarget] = useState<RewardRow | null>(null)
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [form] = Form.useForm()
  const [redeemForm] = Form.useForm()
  const queryClient = useQueryClient()
  const servicesQuery = useQuery({
    queryKey: ['services', 'reward-benefit-picker'],
    queryFn: async () => {
      const response = await getService({ page: 1, limit: 200, is_active: true })
      const payload = pickData<{ services?: Service[] } | Service[]>(response)
      if (Array.isArray(payload)) return payload
      if (payload && typeof payload === 'object' && Array.isArray(payload.services)) return payload.services
      return []
    },
  })
  const services = servicesQuery.data ?? []

  const rewardsQuery = useQuery({
    queryKey: getGetRewardsQueryKey(),
    queryFn: async () => getRewards(),
  })
  const rawRewards = (pickData<RewardRow[]>(rewardsQuery.data) ?? []) as RewardRow[]
  const rewards = rawRewards.filter((r) => r.is_active !== false || canUpdate)

  const vouchersQuery = useQuery({
    queryKey: ['vouchers', 'catalog'],
    queryFn: async () => pickData<{ rows?: Voucher[] }>(await getVouchers({ currentPage: 1, pageSize: 100 })),
  })
  const vouchers = vouchersQuery.data?.rows ?? []

  const createMutation = useMutation({
    mutationFn: async (dto: Partial<Reward>) => postRewards(dto as never),
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<Reward> }) => putRewardsId(id, dto as never),
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => deleteRewardsId(id),
  })
  const redeemMutation = useMutation({
    mutationFn: async ({ profileId, rewardId }: { profileId: string; rewardId: string }) =>
      postCustomerProfilesIdRedeemReward(profileId, { reward_id: rewardId } as PostCustomerProfilesIdRedeemRewardBody),
  })

  const openEditor = (row?: RewardRow) => {
    setEditing(row ?? null)
    form.resetFields()
    if (row) {
      form.setFieldsValue({
        name: row.name,
        type: row.type,
        points_cost: row.points_cost,
        quantity_total: row.quantity_total ?? undefined,
        voucher_id: row.voucher_id ?? undefined,
        benefit_amount: row.benefit_amount ?? undefined,
        service_id: row.service_id ?? undefined,
        valid_from: row.valid_from ? dayjs(String(row.valid_from)) : undefined,
        valid_to: row.valid_to ? dayjs(String(row.valid_to)) : undefined,
        description: row.description ?? undefined,
        is_active: row.is_active !== false,
      })
    } else {
      form.setFieldsValue({
        type: 'VOUCHER',
        points_cost: 100,
        is_active: true,
      })
    }
    setOpen(true)
  }

  const openRedeem = async (row: RewardRow) => {
    setRedeemTarget(row)
    redeemForm.resetFields()
    if (customers.length === 0) {
      try {
        const response = await getCustomerProfiles({ page: 1, limit: 200 })
        const payload = pickData<{ items?: CustomerProfile[] } | CustomerProfile[]>(response)
        const list = Array.isArray(payload) ? payload : payload?.items ?? []
        setCustomers(list)
      } catch (err) {
        message.error(errorMessage(err))
      }
    }
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto = {
        name: values.name,
        type: values.type,
        points_cost: values.points_cost,
        quantity_total: values.quantity_total ?? null,
        voucher_id: values.type === 'VOUCHER' ? values.voucher_id : null,
        benefit_amount: values.type === 'BENEFIT' ? (values.benefit_amount ?? null) : null,
        service_id: values.type === 'BENEFIT' ? (values.service_id ?? null) : null,
        valid_from: values.valid_from ? values.valid_from.format('YYYY-MM-DD') : null,
        valid_to: values.valid_to ? values.valid_to.format('YYYY-MM-DD') : null,
        description: values.description || null,
        is_active: values.is_active !== false,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, dto })
        message.success('Đã cập nhật quà')
      } else {
        await createMutation.mutateAsync(dto)
        message.success('Đã thêm quà')
      }
      setOpen(false)
      onChanged()
      await queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() })
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const hide = async (row: RewardRow) => {
    try {
      await deleteMutation.mutateAsync(row.id)
      message.success('Đã ẩn quà')
      onChanged()
      await queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const submitRedeem = async () => {
    if (!redeemTarget) return
    try {
      const values = await redeemForm.validateFields()
      await redeemMutation.mutateAsync({ profileId: values.customer_profile_id, rewardId: redeemTarget.id })
      message.success(`Đã đổi "${redeemTarget.name}" hộ khách (trừ ${redeemTarget.points_cost.toLocaleString('vi-VN')} điểm)`)
      setRedeemTarget(null)
      onChanged()
      await queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() })
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<RewardRow> = [
    {
      key: 'name',
      title: 'Quà', dataIndex: 'name',
      render: (v: string, row) => <div>
        <div style={{ fontWeight: 500 }}>{v}</div>
        {row.description ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.description}</Typography.Text> : null}
        {row.type === 'BENEFIT' && row.benefit_amount != null ? (
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            Giảm {Number(row.benefit_amount).toLocaleString('vi-VN')}đ · áp dụng trong gói đúng dịch vụ
          </Typography.Text>
        ) : null}
      </div>,
    },
    {
      key: 'type', title: 'Loại', dataIndex: 'type', width: 130,
      render: (v: RewardType, row) => (
        <div>
          <Tag color={TYPE_META[v]?.color}>{TYPE_META[v]?.label ?? v}</Tag>
          {v === 'VOUCHER' && row.voucher ? (
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12, display: 'block' }}>{row.voucher.title}</Typography.Text>
          ) : null}
        </div>
      ),
    },
    { key: 'points_cost', title: 'Điểm đổi', dataIndex: 'points_cost', width: 90, align: 'right', render: (v: number) => v.toLocaleString('vi-VN') },
    { key: 'remaining', title: 'Còn lại', width: 110, render: (_v, row) => remainingLabel(row) },
    { key: 'validity', title: 'Thời hạn', width: 200, render: (_v, row) => `${row.valid_from ? dayjs(String(row.valid_from)).format('DD/MM/YYYY') : '—'} → ${row.valid_to ? dayjs(String(row.valid_to)).format('DD/MM/YYYY') : '—'}` },
    { key: 'is_active', title: 'Trạng thái', dataIndex: 'is_active', width: 100, render: (v: boolean) => (v ? <Tag color="green">Đang đổi</Tag> : <Tag>Đã ẩn</Tag>) },
    {
      key: 'actions', title: 'Hành động', align: 'center' as const, width: 90, fixed: 'right' as const,
      render: (_v, row) => (
        <RowActionsMenu
          items={[
            ...(canRedeem && row.is_active ? [{ key: 'redeem', icon: <GiftOutlined />, label: 'Đổi hộ khách' }] : []),
            ...(canUpdate ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
            ...(canUpdate && row.is_active ? [{ key: 'hide', icon: <EyeInvisibleOutlined />, label: 'Ẩn', danger: true }] : []),
          ]}
          onSelect={(key) => {
            if (key === 'redeem') void openRedeem(row)
            else if (key === 'edit') openEditor(row)
            else if (key === 'hide') {
              Modal.confirm({
                title: 'Ẩn quà này?',
                content: 'Lượt đổi cũ vẫn được giữ.',
                okText: 'Ẩn',
                okButtonProps: { danger: true },
                cancelText: 'Hủy',
                onOk: () => hide(row),
              })
            }
          }}
        />
      ),
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => void rewardsQuery.refetch()}>Tải lại</Button>
        <Can I="CREATE" a="REWARD">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm quà</Button>
        </Can>
      </Space>
      {rewardsQuery.isError && (
        <Alert className="mb-4" type="error" showIcon message="Không tải được danh mục quà" description={errorMessage(rewardsQuery.error)} action={<Button size="small" onClick={() => void rewardsQuery.refetch()}>Thử lại</Button>} />
      )}
      <Table<RewardRow>
        rowKey="id" loading={rewardsQuery.isLoading} dataSource={paginateRows(rewards, page, 10)}
        columns={columns.filter((column) => column.key !== 'actions' || canRedeem || canUpdate)}
        scroll={{ x: 950 }}
        pagination={false}
      />
      <ListPagination page={page} limit={10} total={rewards.length} onChange={setPage} noun="quà" />

      <RewardModal
        open={open}
        editing={editing}
        onCancel={() => setOpen(false)}
        onSubmit={() => void submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        form={form}
        vouchers={vouchers}
        services={services}
        servicesQueryLoading={servicesQuery.isLoading}
      />

      <RedeemModal
        redeemTarget={redeemTarget}
        onCancel={() => setRedeemTarget(null)}
        onSubmit={() => void submitRedeem()}
        confirmLoading={redeemMutation.isPending}
        form={redeemForm}
        customers={customers}
      />
    </>
  )
}

function RedemptionsTab({ onChanged }: { onChanged: () => void }) {
  const { formatDateTime } = useBrandDateTime()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<RedemptionColumnKey[]>(DEFAULT_REDEMPTION_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<RedemptionColumnKey[]>(DEFAULT_REDEMPTION_COLUMNS)
  const [cancelTarget, setCancelTarget] = useState<RewardRedemptionRow | null>(null)
  const [cancelForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const queryClient = useQueryClient()

  const redemptionsQuery = useQuery({
    queryKey: getGetRewardRedemptionsQueryKey({ page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}) }),
    queryFn: async () => getRewardRedemptions({ page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}) }),
  })
  // responseData: RewardRedemptionRow[] + meta.total
  const rows = (pickData<RewardRedemptionRow[]>(redemptionsQuery.data) ?? []) as RewardRedemptionRow[]
  const total = pickMeta(redemptionsQuery.data)?.total ?? rows.length
  const loading = redemptionsQuery.isLoading

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['reward-redemptions'] })
  }

  const markUsedMutation = useMutation({
    mutationFn: async (id: string) => putRewardRedemptionsIdUse(id),
  })

  const markUsed = async (row: RewardRedemptionRow) => {
    try {
      await markUsedMutation.mutateAsync(row.id)
      message.success('Đã đánh dấu sử dụng')
      await invalidate()
      onChanged()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      putRewardRedemptionsIdCancel(id, { reason } as PutRewardRedemptionsIdCancelBody),
  })

  const submitCancel = async () => {
    if (!cancelTarget) return
    try {
      const values = await cancelForm.validateFields()
      await cancelMutation.mutateAsync({ id: cancelTarget.id, reason: values.reason })
      message.success('Đã hủy lượt đổi, hoàn điểm và số lượng cho khách')
      setCancelTarget(null)
      await invalidate()
      onChanged()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ status: statusFilter })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setStatusFilter(typeof values.status === 'string' && values.status ? values.status : undefined)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setStatusFilter(undefined)
    setDraftVisibleColumns(DEFAULT_REDEMPTION_COLUMNS)
    setVisibleColumns(DEFAULT_REDEMPTION_COLUMNS)
    setPage(1)
  }

  const columns: TableColumnsType<RewardRedemptionRow> = [
    {
      key: 'reward', title: 'Quà', render: (_v, row) => (
        <div>
          <div>{row.reward?.name ?? row.reward_id}</div>
          {row.customer_treatment_id && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Gói #{row.customer_treatment_id.slice(0, 8).toUpperCase()} · giảm {Number(row.applied_discount_amount ?? 0).toLocaleString('vi-VN')}đ
            </Typography.Text>
          )}
        </div>
      ),
    },
    { key: 'points_spent', title: 'Điểm đã trừ', dataIndex: 'points_spent', width: 110, render: (v: number) => Number(v).toLocaleString('vi-VN') },
    { key: 'status', title: 'Trạng thái', dataIndex: 'status', width: 110, render: (v: string) => <Tag color={REDEMPTION_META[v]?.color}>{REDEMPTION_META[v]?.label ?? v}</Tag> },
    { key: 'created_at', title: 'Ngày đổi', dataIndex: 'created_at', width: 150, render: (v: string) => formatDateTime(v) },
    { key: 'cancel_reason', title: 'Lý do hủy', dataIndex: 'cancel_reason', ellipsis: true, render: (v?: string) => v || '—' },
    {
      key: 'actions', title: 'Hành động', align: 'center' as const, width: 90, fixed: 'right' as const,
      render: (_v, row) => (
        <RowActionsMenu
          items={row.status === 'ISSUED'
            ? [
                ...(Number(row.reward?.benefit_amount ?? 0) > 0 ? [] : [{ key: 'used', icon: <CheckOutlined />, label: 'Đã dùng' }]),
                { key: 'cancel', icon: <StopOutlined />, label: 'Hủy lượt đổi', danger: true },
              ]
            : []}
          onSelect={(key) => {
            if (key === 'used') void markUsed(row)
            else if (key === 'cancel') {
              setCancelTarget(row)
              cancelForm.resetFields()
            }
          }}
        />
      ),
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
        <ListFilterPopover
          open={filterOpen}
          onOpenChange={openFilters}
          activeFilterCount={statusFilter ? 1 : 0}
          form={filterForm}
          onApply={applyFilters}
          onClear={clearFilters}
          columnOptions={REDEMPTION_COLUMN_OPTIONS}
          draftVisibleColumns={draftVisibleColumns}
          onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as RedemptionColumnKey[])}
          filterItems={(
            <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 0 }}>
              <Select allowClear placeholder="Tất cả" options={Object.entries(REDEMPTION_META).map(([value, meta]) => ({ value, label: meta.label }))} />
            </Form.Item>
          )}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void redemptionsQuery.refetch()}>Tải lại</Button>
      </Space>
      {redemptionsQuery.isError && (
        <Alert className="mb-4" type="error" showIcon message="Không tải được lượt đổi quà" description={errorMessage(redemptionsQuery.error)} action={<Button size="small" onClick={() => void redemptionsQuery.refetch()}>Thử lại</Button>} />
      )}
      {rows.some((row) => row.status === 'ISSUED' && Number(row.reward?.benefit_amount ?? 0) > 0) && (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="Quà giảm tiền phải áp vào gói liệu trình"
          description="Mở Liệu trình của khách → chọn đúng gói của khách → Ưu đãi & điểm → Quà đã đổi. Hệ thống sẽ trừ công nợ và đánh dấu quà đã dùng cùng lúc."
        />
      )}
      <Table<RewardRedemptionRow>
        rowKey="id" loading={loading} dataSource={rows}
        columns={columns.filter((column) =>
          column.key === 'actions' || visibleColumns.includes(column.key as RedemptionColumnKey),
        )}
        scroll={{ x: 850 }}
        pagination={false}
      />
      <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="lượt đổi quà" />

      <CancelRedemptionModal
        cancelTarget={cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onSubmit={() => void submitCancel()}
        confirmLoading={cancelMutation.isPending}
        form={cancelForm}
      />
    </>
  )
}

export default function Rewards() {
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])

  return (
    <>
      <PageTitle subtitle="Danh mục quà đổi điểm và lịch sử đổi thưởng">Quà đổi điểm</PageTitle>
      <Tabs
        key={tick}
        items={[
          { key: 'catalog', label: 'Danh mục quà', children: <RewardCatalogTab onChanged={bump} /> },
          { key: 'redemptions', label: 'Lượt đổi', children: <RedemptionsTab onChanged={bump} /> },
        ]}
      />
    </>
  )
}
