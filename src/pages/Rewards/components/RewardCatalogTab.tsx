import { useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
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
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import RewardCardActions from './RewardCardActions'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import { errorMessage, pickData } from '@/api/helpers'
import type { Reward } from '@/api/models/reward'
import { getGetRewardRedemptionsAdminQueryKey } from '@/api/endpoints/reward-redemptions'
import { getGetRewardsAdminQueryKey, useDeleteRewardsIdAdmin, useGetRewardsAdmin, usePostRewardsAdmin, usePutRewardsIdAdmin } from '@/api/endpoints/rewards'
import { usePostUsersCustomersIdRedeemRewardAdmin } from '@/api/endpoints/customers'
import { getAcademyCourseVouchersAdmin } from '@/api/endpoints/academy-course-vouchers'
import { getProductVouchersAdmin } from '@/api/endpoints/product-vouchers'
import { getTreatmentPackageVouchersAdmin } from '@/api/endpoints/treatment-package-vouchers'
import type { VoucherCategory, VoucherCategoryRow } from '@/pages/Vouchers/components/constants'
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
  const [limit] = useState(10)
  const applySearch = (value: string) => {
    setSearchInput(value)
    setSearch(value.trim())
    setPage(1)
  }
  // Admin (canUpdate) xem cả quà đã ẩn → không gửi is_active; người thường chỉ thấy quà đang hoạt động
  const rewardsQuery = useGetRewardsAdmin({
    page,
    limit,
    q: search || undefined,
    type: typeFilter,
    ...(canUpdate ? {} : { is_active: true }),
  } as never, { query: { placeholderData: (previous) => previous } })
  const rawRewards = (pickData<RewardRow[] | undefined>(rewardsQuery.data) ?? []) as RewardRow[]
  const rewards = rawRewards.filter((r) => r.is_active !== false || canUpdate)
  const total = (rewardsQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rewards.length
  const loading = rewardsQuery.isLoading || rewardsQuery.isPlaceholderData

  const vouchersQuery = useQuery({
    queryKey: ['voucher-categories', 'reward-picker'],
    queryFn: async () => {
      const categories: VoucherCategory[] = ['treatment-package', 'academy-course', 'product']
      const lists = await Promise.all(categories.map(async (category) => {
        const payload = pickData<VoucherCategoryRow[] | undefined>(await (category === 'treatment-package'
          ? getTreatmentPackageVouchersAdmin({ page: 1, limit: 200 } as never)
          : category === 'academy-course'
            ? getAcademyCourseVouchersAdmin({ page: 1, limit: 200 } as never)
            : getProductVouchersAdmin({ page: 1, limit: 200 } as never)))
        return { category, rows: payload ?? [] }
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

  const createMutation = usePostRewardsAdmin()
  const updateMutation = usePutRewardsIdAdmin()
  const deleteMutation = useDeleteRewardsIdAdmin()
  const redeemMutation = usePostUsersCustomersIdRedeemRewardAdmin()

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetRewardsAdminQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetRewardRedemptionsAdminQueryKey() }),
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
      await redeemMutation.mutateAsync({ id: values.user_id, data: { reward_id: redeemTarget.id } as never })
      message.success(`Đã đổi "${redeemTarget.name}" hộ khách (trừ ${redeemTarget.points_cost.toLocaleString('vi-VN')} điểm)`)
      setRedeemTarget(null)
      await refresh()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const validity = (row: RewardRow) => [row.valid_from, row.valid_to]
    .map((date) => date ? dayjs(String(date)).format('DD/MM/YYYY') : '—').join(' → ')
  const statusTag = (active?: boolean) => <Tag className="me-0!" color={active ? 'green' : 'default'}>{active ? 'Đang đổi' : 'Đã ẩn'}</Tag>
  const actions = (row: RewardRow) => [
    ...(canRedeem && row.is_active ? [{ key: 'redeem', icon: <GiftOutlined />, label: 'Đổi hộ khách' }] : []),
    ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
  ]
  const runAction = (row: RewardRow, key: string) => {
    if (key === 'edit') openEditor(row)
    if (key === 'redeem') void openRedeem(row)
    if (key === 'delete') {
      Modal.confirm({
        title: 'Xóa quà này?',
        content: 'Không xóa được quà đã phát sinh lịch sử đổi thưởng.',
        width: 'min(416px, calc(100vw - 24px))',
        okText: 'Xóa',
        okButtonProps: { danger: true },
        cancelText: 'Hủy',
        onOk: () => remove(row),
      })
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
      render: (v: RewardType | 'BENEFIT', row) => (
        <div>
          {v === 'BENEFIT'
            ? <Tag color="blue">Quyền lợi</Tag>
            : <Tag color={TYPE_META[v]?.color}>{TYPE_META[v]?.label ?? v}</Tag>}
          {v === 'VOUCHER' && row.voucher ? (
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12, display: 'block' }}>{row.voucher.title}</Typography.Text>
          ) : null}
        </div>
      ),
    },
    { key: 'points_cost', title: <span className="whitespace-nowrap">Điểm quy đổi</span>, dataIndex: 'points_cost', width: 130, align: 'right', render: (v: number) => v.toLocaleString('vi-VN') },
    { key: 'remaining', title: 'Còn lại', width: 140, render: (_v, row) => remainingLabel(row) },
    { key: 'validity', title: 'Thời hạn', width: 200, render: (_v, row) => validity(row) },
    { key: 'is_active', title: 'Trạng thái', dataIndex: 'is_active', width: 100, render: (v: boolean) => statusTag(v) },
    {
      key: 'actions', title: 'Thao tác', align: 'center' as const, width: 110, fixed: 'right' as const,
      render: (_v, row) => (
        <RowActionsMenu items={actions(row)} onSelect={(key) => runAction(row, key)} />
      ),
    },
  ]

  return (
    <>
      {/* docs 6.2.1: mobile → [Tìm] / [Loại quà][+] */}
      <div className="toolbar-row mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:flex md:flex-wrap md:justify-between">
        <div className="contents md:flex md:min-w-0 md:flex-1 md:gap-2 lg:flex-none">
        <Input.Search
          allowClear
          value={searchInput}
          onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
          onSearch={applySearch}
          placeholder="Tìm theo tên quà"
          aria-label="Tìm theo tên quà"
          className="col-span-2 w-full! min-w-0 md:flex-1 lg:w-[260px]!"
        />
        <Select<RewardType>
          allowClear
          value={typeFilter}
          onChange={(value) => { setTypeFilter(value); setPage(1) }}
          aria-label="Lọc theo loại quà"
          placeholder="Loại quà"
          options={Object.entries(TYPE_META).map(([value, meta]) => ({ value: value as RewardType, label: meta.label }))}
          className="w-full min-w-0 md:w-[200px] md:shrink-0"
        />
        </div>
        <Can I="CREATE" a="REWARD">
          <Button type="primary" className="shrink-0" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm quà</Button>
        </Can>
      </div>
      {rewardsQuery.isError && (
        <Alert className="mb-4! max-lg:mb-3!" type="error" showIcon message="Không tải được quà tặng" description={errorMessage(rewardsQuery.error)} action={<Button size="small" onClick={() => void rewardsQuery.refetch()}>Thử lại</Button>} />
      )}
      {!loading && (!rewardsQuery.isError || rewards.length > 0) && <Table<RewardRow>
        className="desktop-only max-lg:hidden!"
        rowKey="id" dataSource={rewards}
        onRow={(row) => ({
          onClick: (event) => {
            if (canUpdate && !(event.target as HTMLElement).closest('button, a, input, .ant-dropdown, .ant-switch')) {
              openEditor(row)
            }
          },
          style: canUpdate ? { cursor: 'pointer' } : undefined,
        })}
        columns={columns.filter((column) => column.key !== 'actions' || canRedeem || canDelete)}
        scroll={{ x: 950 }}
        pagination={false}
      />}
      {(!rewardsQuery.isError || rewards.length > 0) && (
        <MobileCards
          className={loading ? 'rewards-list-loading' : 'rewards-tablet-cards'}
          rows={rewards}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText={search || typeFilter ? 'Không có kết quả' : 'Chưa có quà tặng'}
          renderCard={(row) => {
            const options = [
              ...(canUpdate ? [{ key: 'edit', label: 'Sửa quà' }] : []),
              ...actions(row),
            ]
            return (
              <>
                <div className="mobile-card-head items-start!">
                  <div className="mobile-card-title min-w-0">{row.name}</div>
                  {statusTag(row.is_active)}
                </div>
                {row.description && <p className="mobile-card-sub mt-0 mb-2">{row.description}</p>}
                <div className="mobile-card-rows">
                  <MobileCardRow label="Loại quà" value={row.type === 'BENEFIT' ? 'Quyền lợi' : TYPE_META[row.type as RewardType]?.label ?? row.type ?? '—'} />
                  {row.type === 'VOUCHER' && row.voucher && <MobileCardRow label="Voucher" value={row.voucher.title} />}
                  <MobileCardRow label="Điểm quy đổi" value={<strong className="text-(--brand-primary) tabular-nums">{row.points_cost.toLocaleString('vi-VN')}</strong>} />
                  <MobileCardRow label="Còn lại" value={remainingLabel(row)} />
                  <MobileCardRow label="Thời hạn" value={row.valid_from || row.valid_to ? validity(row) : '—'} />
                </div>
                <RewardCardActions ariaLabel={`Thao tác cho ${row.name}`} items={options} onSelect={(key) => runAction(row, key)} />
              </>
            )
          }}
        />
      )}
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="quà" />

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
