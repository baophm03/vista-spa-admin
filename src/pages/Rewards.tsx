import { useCallback, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { Reward } from '@/api/models/reward'
import type { RewardRedemption } from '@/api/models/rewardRedemption'
import type { Voucher } from '@/api/models/voucher'
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
import { Can } from '@casl/react'

/** GET /rewards trả kèm voucher cấp khi type = VOUCHER (model gen thiếu — mở rộng cục bộ). */
type RewardRow = Reward & { voucher?: { id?: string; title?: string; description?: string } | null }
/** GET /reward-redemptions trả kèm reward (model gen thiếu — mở rộng cục bộ). */
type RewardRedemptionRow = RewardRedemption & { reward?: RewardRow | null }
type RewardType = 'VOUCHER' | 'GIFT' | 'BENEFIT'

const TYPE_META: Record<RewardType, { label: string; color: string }> = {
  VOUCHER: { label: 'Voucher', color: 'purple' },
  GIFT: { label: 'Quà vật phẩm', color: 'gold' },
  BENEFIT: { label: 'Quyền lợi', color: 'cyan' },
}
const REDEMPTION_META: Record<string, { label: string; color: string }> = {
  ISSUED: { label: 'Chưa dùng', color: 'orange' },
  USED: { label: 'Đã dùng', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

function remainingLabel(row: RewardRow) {
  if (row.quantity_total == null) return 'Không giới hạn'
  return `${Math.max(Number(row.quantity_total) - Number(row.quantity_given ?? 0), 0)}/${row.quantity_total}`
}

function RewardCatalogTab({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RewardRow | null>(null)
  const [redeemTarget, setRedeemTarget] = useState<RewardRow | null>(null)
  const [customers, setCustomers] = useState<CustomerProfile[]>([])
  const [form] = Form.useForm()
  const [redeemForm] = Form.useForm()
  const queryClient = useQueryClient()

  const rewardsQuery = useQuery({
    queryKey: getGetRewardsQueryKey(),
    queryFn: async () => (pickData<RewardRow[]>(await getRewards()) ?? []) as RewardRow[],
  })
  // Legacy /vouchers: phân trang currentPage/pageSize, responseData = { count, rows, ... }
  const vouchersQuery = useQuery({
    queryKey: ['vouchers', 'rewards-page'],
    queryFn: async () => pickData<{ rows?: Voucher[] }>(await getVouchers({ currentPage: 1, pageSize: 100 })),
  })
  const rewards = rewardsQuery.data ?? []
  const vouchers = vouchersQuery.data?.rows ?? []

  const createMutation = useMutation({
    mutationFn: async (dto: Record<string, unknown>) => postRewards(dto as unknown as Reward),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() })
    },
  })
  const updateMutation = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Record<string, unknown> }) => putRewardsId(id, dto as unknown as Reward),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() })
    },
  })
  const hideMutation = useMutation({
    mutationFn: async (id: string) => deleteRewardsId(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() })
    },
  })

  const openEditor = (row?: RewardRow) => {
    setEditing(row ?? null)
    form.setFieldsValue(row ? {
      ...row,
      valid_from: row.valid_from ? dayjs(row.valid_from) : undefined,
      valid_to: row.valid_to ? dayjs(row.valid_to) : undefined,
      quantity_total: row.quantity_total ?? undefined,
    } : { name: '', type: 'GIFT', points_cost: 100, quantity_total: undefined, is_active: true })
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const dto = {
        name: values.name,
        type: values.type,
        voucher_id: values.type === 'VOUCHER' ? values.voucher_id : null,
        points_cost: values.points_cost,
        quantity_total: values.quantity_total ?? null,
        valid_from: values.valid_from ? values.valid_from.format('YYYY-MM-DD') : null,
        valid_to: values.valid_to ? values.valid_to.format('YYYY-MM-DD') : null,
        description: values.description || null,
        is_active: values.is_active,
      }
      if (editing) await updateMutation.mutateAsync({ id: editing.id, dto })
      else await createMutation.mutateAsync(dto)
      setOpen(false)
      message.success(editing ? 'Đã cập nhật quà' : 'Đã tạo quà')
      onChanged()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const hide = async (row: RewardRow) => {
    try {
      await hideMutation.mutateAsync(row.id)
      message.success('Đã ẩn quà; lượt đổi cũ vẫn giữ nguyên')
      onChanged()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openRedeem = async (row: RewardRow) => {
    setRedeemTarget(row)
    redeemForm.resetFields()
    try {
      setCustomers((pickData<CustomerProfile[]>(await getCustomerProfiles({ page: 1, limit: 50 })) ?? []) as CustomerProfile[])
    } catch {
      setCustomers([])
    }
  }

  const redeemMutation = useMutation({
    mutationFn: async ({ profileId, rewardId }: { profileId: string; rewardId: string }) =>
      postCustomerProfilesIdRedeemReward(profileId, { reward_id: rewardId } as PostCustomerProfilesIdRedeemRewardBody),
  })

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

  const selectedType = Form.useWatch('type', form) as RewardType | undefined

  const columns: TableColumnsType<RewardRow> = [
    {
      title: 'Quà', dataIndex: 'name',
      render: (v: string, row) => <div>
        <div style={{ fontWeight: 500 }}>{v}</div>
        {row.description ? <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.description}</Typography.Text> : null}
      </div>,
    },
    { title: 'Loại', dataIndex: 'type', width: 120, render: (v: RewardType, row) => <Tag color={TYPE_META[v]?.color}>{TYPE_META[v]?.label ?? v}{v === 'VOUCHER' && row.voucher ? `: ${row.voucher.title}` : ''}</Tag> },
    { title: 'Điểm đổi', dataIndex: 'points_cost', width: 100, render: (v: number) => v.toLocaleString('vi-VN') },
    { title: 'Còn lại', key: 'remaining', width: 130, render: (_v, row) => remainingLabel(row) },
    { title: 'Thời hạn', key: 'validity', width: 180, render: (_v, row) => `${row.valid_from ? dayjs(String(row.valid_from)).format('DD/MM/YYYY') : '—'} → ${row.valid_to ? dayjs(String(row.valid_to)).format('DD/MM/YYYY') : '—'}` },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 110, render: (v: boolean) => (v ? <Tag color="green">Đang đổi</Tag> : <Tag>Đã ẩn</Tag>) },
    {
      title: 'Thao tác', key: 'actions', width: 220,
      render: (_v, row) => <Space>
        {row.is_active && <Can I="REDEEM_ADMIN" a="REWARD"><Button size="small" type="primary" onClick={() => void openRedeem(row)}>Đổi hộ khách</Button></Can>}
        <Can I="UPDATE" a="REWARD">
          <Button size="small" onClick={() => openEditor(row)}>Sửa</Button>
          {row.is_active && (
            <Popconfirm title="Ẩn quà này?" description="Lượt đổi cũ vẫn được giữ." onConfirm={() => void hide(row)}>
              <Button size="small" danger>Ẩn</Button>
            </Popconfirm>
          )}
        </Can>
      </Space>,
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
      <Table<RewardRow> rowKey="id" loading={rewardsQuery.isLoading} dataSource={rewards} columns={columns} pagination={{ pageSize: 10 }} />

      <Modal
        title={editing ? 'Sửa quà' : 'Thêm quà'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên quà" rules={[{ required: true, message: 'Nhập tên quà' }]}>
            <Input maxLength={255} placeholder="VD: Nước tẩy trang Kahanna" />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="type" label="Loại" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
            </Form.Item>
            {selectedType === 'VOUCHER' && (
              <Form.Item name="voucher_id" label="Voucher cấp" rules={[{ required: true, message: 'Chọn voucher sẽ cấp' }]} style={{ flex: 1 }}>
                <Select
                  showSearch optionFilterProp="label"
                  options={vouchers.filter((v) => v.is_active !== false).map((v) => ({ value: v.id, label: v.title }))}
                />
              </Form.Item>
            )}
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="points_cost" label="Điểm đổi" rules={[{ required: true }, { type: 'number', min: 1, message: 'Tối thiểu 1 điểm' }]} style={{ flex: 1 }}>
              <InputNumber min={1} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="quantity_total" label="Số lượng (trống = không giới hạn)" rules={[{ type: 'number', min: 0 }]} style={{ flex: 1 }}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="valid_from" label="Bắt đầu" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="valid_to" label="Kết thúc" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
          <Form.Item name="is_active" label="Đang đổi" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Đổi hộ khách: ${redeemTarget?.name ?? ''}`}
        open={!!redeemTarget}
        onCancel={() => setRedeemTarget(null)}
        onOk={() => void submitRedeem()}
        confirmLoading={redeemMutation.isPending}
        okText="Đổi quà"
        cancelText="Đóng"
      >
        <Typography.Paragraph type="secondary">
          Sẽ trừ <strong>{redeemTarget?.points_cost.toLocaleString('vi-VN')} điểm</strong> của khách và tạo lượt đổi Chưa dùng.
        </Typography.Paragraph>
        <Form form={redeemForm} layout="vertical">
          <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách' }]}>
            <Select
              showSearch optionFilterProp="label"
              placeholder="Tìm theo tên hoặc SĐT"
              options={customers.map((c) => ({ value: c.id, label: `${c.full_name} — ${c.phone}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function RedemptionsTab({ onChanged }: { onChanged: () => void }) {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [cancelTarget, setCancelTarget] = useState<RewardRedemptionRow | null>(null)
  const [cancelForm] = Form.useForm()
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

  const columns: TableColumnsType<RewardRedemptionRow> = [
    { title: 'Quà', key: 'reward', render: (_v, row) => row.reward?.name ?? row.reward_id },
    { title: 'Điểm đã trừ', dataIndex: 'points_spent', width: 110, render: (v: number) => Number(v).toLocaleString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', width: 110, render: (v: string) => <Tag color={REDEMPTION_META[v]?.color}>{REDEMPTION_META[v]?.label ?? v}</Tag> },
    { title: 'Ngày đổi', dataIndex: 'created_at', width: 150, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
    { title: 'Lý do hủy', dataIndex: 'cancel_reason', ellipsis: true, render: (v?: string) => v || '—' },
    {
      title: 'Thao tác', key: 'actions', width: 170,
      render: (_v, row) => <Space>
        {row.status === 'ISSUED' && <Button size="small" type="primary" onClick={() => void markUsed(row)}>Đã dùng</Button>}
        {row.status === 'ISSUED' && <Button size="small" danger onClick={() => { setCancelTarget(row); cancelForm.resetFields() }}>Hủy</Button>}
      </Space>,
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Select
          allowClear value={statusFilter} placeholder="Trạng thái" style={{ width: 160 }}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
          options={Object.entries(REDEMPTION_META).map(([value, meta]) => ({ value, label: meta.label }))}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void redemptionsQuery.refetch()}>Tải lại</Button>
      </Space>
      {redemptionsQuery.isError && (
        <Alert className="mb-4" type="error" showIcon message="Không tải được lượt đổi quà" description={errorMessage(redemptionsQuery.error)} action={<Button size="small" onClick={() => void redemptionsQuery.refetch()}>Thử lại</Button>} />
      )}
      <Table<RewardRedemptionRow>
        rowKey="id" loading={loading} dataSource={rows} columns={columns}
        pagination={{ current: page, pageSize: 10, total, showTotal: (c) => `${c} lượt` }}
        onChange={(p) => { if (p.current) setPage(p.current) }}
      />
      <Modal
        title={`Hủy lượt đổi: ${cancelTarget?.reward?.name ?? ''}`}
        open={!!cancelTarget}
        onCancel={() => setCancelTarget(null)}
        onOk={() => void submitCancel()}
        confirmLoading={cancelMutation.isPending}
        okText="Hủy lượt đổi"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
      >
        <Typography.Paragraph type="secondary">
          Sẽ hoàn <strong>{Number(cancelTarget?.points_spent ?? 0).toLocaleString('vi-VN')} điểm</strong> và trả lại số lượng quà. Chỉ hủy được lượt chưa sử dụng.
        </Typography.Paragraph>
        <Form form={cancelForm} layout="vertical">
          <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, message: 'Nhập lý do hủy' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function Rewards() {
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick((t) => t + 1), [])

  return (
    <>
      <PageTitle>Quà đổi điểm</PageTitle>
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
