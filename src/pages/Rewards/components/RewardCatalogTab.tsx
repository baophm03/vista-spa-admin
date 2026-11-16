import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, GiftOutlined, PlusOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import ListPagination from '@/components/base/ListPagination'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import type { Reward } from '@/api/models/reward'
import {
  getGetRewardRedemptionsQueryKey,
  getGetRewardsQueryKey,
  useDeleteRewardsId,
  useGetRewards,
  usePostRewards,
  usePutRewardsId,
} from '@/api/endpoints/rewards'
import { usePostCustomerProfilesIdRedeemReward } from '@/api/endpoints/customer-profiles'
import { getVoucherCategory, type VoucherCategory, type VoucherCategoryRow } from '@/api/custom/voucherCategories'
import { Can, useAbility } from '@casl/react'
import RedeemModal from './RedeemModal'
import RewardModal, { type RewardVoucherOption } from './RewardModal'
import {
  TYPE_META,
  remainingLabel,
  type RewardRow,
  type RewardType,
} from './constants'

export default function RewardCatalogTab() {
  const ability = useAbility()
  const canRedeem = ability.can('REDEEM_ADMIN', 'REWARD')
  const canDelete = ability.can('DELETE', 'REWARD')
  const canUpdate = ability.can('UPDATE', 'REWARD')
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<RewardType | undefined>()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RewardRow | null>(null)
  const [redeemTarget, setRedeemTarget] = useState<RewardRow | null>(null)
  const [form] = Form.useForm()
  const [redeemForm] = Form.useForm()
  const queryClient = useQueryClient()
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])
  const rewardsQuery = useGetRewards({ q: search || undefined, type: typeFilter })
  const rawRewards = (pickData<RewardRow[]>(rewardsQuery.data) ?? []) as RewardRow[]
  const rewards = rawRewards.filter((r) => r.is_active !== false || canUpdate)

  const vouchersQuery = useQuery({
    queryKey: ['voucher-categories', 'reward-picker'],
    queryFn: async () => {
      const categories: VoucherCategory[] = ['treatment-package', 'academy-course', 'product']
      const lists = await Promise.all(categories.map(async (category) => {
        const payload = pickData<{ rows?: VoucherCategoryRow[] } | VoucherCategoryRow[]>(await getVoucherCategory(category))
        return { category, rows: Array.isArray(payload) ? payload : payload?.rows ?? [] }
      }))
      const today = dayjs().format('YYYY-MM-DD')
      const dateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : null)
      // BE chỉ cấp được voucher còn hiệu lực tại thời điểm đổi (issueVoucherByCategory),
      // nên voucher hết hạn / chưa tới ngày phải chặn ngay ở đây thay vì để 409 lúc đổi quà.
      return lists.flatMap(({ category, rows }) => rows
        .filter((voucher) => voucher.is_active)
        .map((voucher) => {
          const start = dateOnly(voucher.start_date)
          const end = dateOnly(voucher.end_date)
          const notStarted = Boolean(start && start > today)
          const expired = Boolean(end && end < today)
          return {
            value: `${category}:${voucher.id}`,
            label: notStarted ? `${voucher.title} (chưa hiệu lực)` : expired ? `${voucher.title} (đã hết hạn)` : voucher.title,
            category,
            disabled: notStarted || expired,
          }
        }))
    },
  })
  const vouchers: RewardVoucherOption[] = vouchersQuery.data ?? []

  const createMutation = usePostRewards()
  const updateMutation = usePutRewardsId()
  const deleteMutation = useDeleteRewardsId()
  const redeemMutation = usePostCustomerProfilesIdRedeemReward()

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetRewardsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetRewardRedemptionsQueryKey() }),
    ])
  }

  const openEditor = (row?: RewardRow) => {
    setEditing(row ?? null)
    form.resetFields()
    if (row) {
      form.setFieldsValue({
        name: row.name,
        type: row.type,
        points_cost: row.points_cost,
        quantity_total: row.quantity_total ?? undefined,
        voucher_reference: row.voucher_reference ?? (row.voucher_id ? `legacy:${row.voucher_id}` : undefined),
        voucher_kind: row.voucher_kind ?? (row.voucher_id ? 'legacy' : undefined),
        valid_from: row.valid_from ? dayjs(String(row.valid_from)) : undefined,
        valid_to: row.valid_to ? dayjs(String(row.valid_to)) : undefined,
        description: row.description ?? undefined,
        is_active: row.is_active !== false,
      })
    } else {
      form.setFieldsValue({
        type: 'VOUCHER',
        voucher_kind: undefined,
        points_cost: 100,
        is_active: true,
      })
    }
    setOpen(true)
  }

  const openRedeem = async (row: RewardRow) => {
    setRedeemTarget(row)
    redeemForm.resetFields()
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      if (values.type === 'VOUCHER') {
        const chosenVoucher = vouchers.find((voucher) => voucher.value === values.voucher_reference)
        if (chosenVoucher?.disabled) {
          message.error('Voucher đã chọn đã hết hạn hoặc chưa có hiệu lực, không cấp được cho khách')
          return
        }
      }
      const dto = {
        name: values.name,
        type: values.type,
        points_cost: values.points_cost,
        quantity_total: values.quantity_total ?? null,
        voucher_reference: values.type === 'VOUCHER' ? values.voucher_reference : null,
        voucher_kind: values.type === 'VOUCHER' ? values.voucher_kind : null,
        benefit_amount: null,
        service_id: null,
        valid_from: values.valid_from.format('YYYY-MM-DD'),
        valid_to: values.valid_to.format('YYYY-MM-DD'),
        description: values.description || null,
        is_active: values.is_active !== false,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: dto as Reward })
        message.success('Đã cập nhật quà')
      } else {
        await createMutation.mutateAsync({ data: dto as Reward })
        message.success('Đã thêm quà')
      }
      setOpen(false)
      await refresh()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  // Ẩn = PUT is_active (switch trong modal); DELETE riêng là xóa mềm is_deleted.
  const remove = async (row: RewardRow) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success('Đã xóa quà')
      await refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const submitRedeem = async () => {
    if (!redeemTarget) return
    try {
      const values = await redeemForm.validateFields()
      await redeemMutation.mutateAsync({ id: values.customer_profile_id, data: { reward_id: redeemTarget.id } as never })
      message.success(`Đã đổi "${redeemTarget.name}" hộ khách (trừ ${redeemTarget.points_cost.toLocaleString('vi-VN')} điểm)`)
      setRedeemTarget(null)
      await refresh()
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
    { key: 'points_cost', title: 'Điểm quy đổi', dataIndex: 'points_cost', width: 110, align: 'right', render: (v: number) => v.toLocaleString('vi-VN') },
    { key: 'remaining', title: 'Còn lại', width: 140, render: (_v, row) => remainingLabel(row) },
    { key: 'validity', title: 'Thời hạn', width: 200, render: (_v, row) => `${row.valid_from ? dayjs(String(row.valid_from)).format('DD/MM/YYYY') : '—'} → ${row.valid_to ? dayjs(String(row.valid_to)).format('DD/MM/YYYY') : '—'}` },
    { key: 'is_active', title: 'Trạng thái', dataIndex: 'is_active', width: 100, render: (v: boolean) => (v ? <Tag color="green">Đang đổi</Tag> : <Tag>Đã ẩn</Tag>) },
    {
      key: 'actions', title: 'Hành động', align: 'center' as const, width: 110, fixed: 'right' as const,
      render: (_v, row) => (
        <RowActionsMenu
          items={[
            ...(canRedeem && row.is_active ? [{ key: 'redeem', icon: <GiftOutlined />, label: 'Đổi hộ khách' }] : []),
            ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
          ]}
          onSelect={(key) => {
            if (key === 'redeem') void openRedeem(row)
            else if (key === 'delete') {
              Modal.confirm({
                title: 'Xóa quà này?',
                content: 'Xóa mềm (is_deleted). Không xóa được quà đã phát sinh lịch sử đổi thưởng.',
                okText: 'Xóa',
                okButtonProps: { danger: true },
                cancelText: 'Hủy',
                onOk: () => remove(row),
              })
            }
          }}
        />
      ),
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Space wrap>
        <Input.Search
          allowClear
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onSearch={(value) => { setSearchInput(value); setSearch(value.trim()); setPage(1) }}
          placeholder="Tìm theo tên quà"
          style={{ width: 320, maxWidth: '100%' }}
        />
        <Select<RewardType>
          allowClear
          value={typeFilter}
          onChange={(value) => { setTypeFilter(value); setPage(1) }}
          placeholder="Lọc theo loại quà"
          options={Object.entries(TYPE_META).map(([value, meta]) => ({ value: value as RewardType, label: meta.label }))}
          style={{ width: 200 }}
        />
        </Space>
        <Can I="CREATE" a="REWARD">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm quà</Button>
        </Can>
      </Space>
      {rewardsQuery.isError && (
        <Alert className="mb-4" type="error" showIcon message="Không tải được quà tặng" description={errorMessage(rewardsQuery.error)} action={<Button size="small" onClick={() => void rewardsQuery.refetch()}>Thử lại</Button>} />
      )}
      <Table<RewardRow>
        rowKey="id" loading={rewardsQuery.isLoading} dataSource={paginateRows(rewards, page, 10)}
        onRow={(row) => ({
          onClick: (event) => {
            if (canUpdate && !(event.target as HTMLElement).closest('button, a, input, .ant-dropdown, .ant-switch')) {
              openEditor(row)
            }
          },
          style: canUpdate ? { cursor: 'pointer' } : undefined,
        })}
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
      />

      <RedeemModal
        redeemTarget={redeemTarget}
        onCancel={() => setRedeemTarget(null)}
        onSubmit={() => void submitRedeem()}
        confirmLoading={redeemMutation.isPending}
        form={redeemForm}
      />
    </>
  )
}
