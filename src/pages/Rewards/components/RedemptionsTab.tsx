import { useState } from 'react'
import { displayName } from '@/utils/displayName'
import {
  Alert,
  Button,
  Form,
  Input,
  Select,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, StopOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { useBrandDateTime } from '@/themeRuntime'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import RewardCardActions from './RewardCardActions'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { getGetRewardRedemptionsAdminQueryKey, useGetRewardRedemptionsAdmin, usePutRewardRedemptionsIdCancelAdmin, usePutRewardRedemptionsIdUseAdmin } from '@/api/endpoints/reward-redemptions'
import { getGetRewardsAdminQueryKey } from '@/api/endpoints/rewards'
import CancelRedemptionModal from './CancelRedemptionModal'
import { REDEMPTION_META, type RewardRedemptionRow } from './constants'

export default function RedemptionsTab() {
  const { formatDateTime } = useBrandDateTime()
  const [page, setPage] = useState(1)
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [cancelTarget, setCancelTarget] = useState<RewardRedemptionRow | null>(null)
  const [cancelForm] = Form.useForm()
  const queryClient = useQueryClient()
  const applySearch = (value: string) => {
    setCustomerSearchInput(value)
    setCustomerSearch(value.trim())
    setPage(1)
  }

  const redemptionParams = { page, limit: 10, ...(statusFilter ? { status: statusFilter } : {}), ...(customerSearch ? { q: customerSearch } : {}) }
  const redemptionsQuery = useGetRewardRedemptionsAdmin(redemptionParams, { query: { placeholderData: (previous) => previous } })
  // responseData: RewardRedemptionRow[] + meta.total
  const rows = (pickData<RewardRedemptionRow[]>(redemptionsQuery.data) ?? []) as RewardRedemptionRow[]
  const total = pickMeta(redemptionsQuery.data)?.total ?? rows.length
  const loading = redemptionsQuery.isLoading || redemptionsQuery.isPlaceholderData

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetRewardRedemptionsAdminQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetRewardsAdminQueryKey() }),
    ])
  }

  const markUsedMutation = usePutRewardRedemptionsIdUseAdmin()

  const markUsed = async (row: RewardRedemptionRow) => {
    try {
      await markUsedMutation.mutateAsync({ id: row.id })
      message.success('Đã đánh dấu sử dụng')
      await invalidate()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const cancelMutation = usePutRewardRedemptionsIdCancelAdmin()

  const submitCancel = async () => {
    if (!cancelTarget) return
    try {
      const values = await cancelForm.validateFields()
      await cancelMutation.mutateAsync({ id: cancelTarget.id, data: { reason: values.reason } })
      message.success('Đã hủy lượt đổi, hoàn điểm và số lượng cho khách')
      setCancelTarget(null)
      await invalidate()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const actions = (row: RewardRedemptionRow) => row.status === 'ISSUED' ? [
    ...(Number(row.reward?.benefit_amount ?? 0) > 0 ? [] : [{ key: 'used', icon: <CheckOutlined />, label: 'Đã dùng' }]),
    { key: 'cancel', icon: <StopOutlined />, label: 'Hủy lượt đổi', danger: true },
  ] : []

  const runAction = (row: RewardRedemptionRow, key: string) => {
    if (key === 'used') void markUsed(row)
    if (key === 'cancel') {
      setCancelTarget(row)
      cancelForm.resetFields()
    }
  }

  const columns: TableColumnsType<RewardRedemptionRow> = [
    {
      key: 'customer', title: 'Khách hàng', width: 220, render: (_v, row) => (
        <div>
          <div>{displayName(row.user, 'Khách hàng không xác định')}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[row.user?.customer_code, row.user?.phone].filter(Boolean).join(' · ') || row.user_id}
          </Typography.Text>
        </div>
      ),
    },
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
      key: 'actions', title: 'Thao tác', align: 'center' as const, width: 90, fixed: 'right' as const,
      render: (_v, row) => (
        <RowActionsMenu items={actions(row)} onSelect={(key) => runAction(row, key)} />
      ),
    },
  ]

  return (
    <>
      <div className="mb-3 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-2 md:grid-cols-[minmax(0,1fr)_200px] lg:flex lg:flex-wrap">
          <Input.Search
            allowClear
            value={customerSearchInput}
            onChange={(event) => { setCustomerSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
            onSearch={applySearch}
            aria-label="Tìm theo tên khách hàng"
            placeholder="Tìm khách hàng"
            className="w-full! min-w-0 lg:w-[260px]!"
          />
          <Select
            allowClear
            value={statusFilter}
            onChange={(value) => { setStatusFilter(value); setPage(1) }}
            aria-label="Lọc theo trạng thái"
            placeholder="Trạng thái"
            options={Object.entries(REDEMPTION_META).map(([value, meta]) => ({ value, label: meta.label }))}
            className="w-full min-w-0 md:w-[200px]"
          />
      </div>
      {redemptionsQuery.isError && (
        <Alert className="mb-4" type="error" showIcon message="Không tải được lượt đổi quà" description={errorMessage(redemptionsQuery.error)} action={<Button size="small" onClick={() => void redemptionsQuery.refetch()}>Thử lại</Button>} />
      )}
      {!loading && (!redemptionsQuery.isError || rows.length > 0) && <Table<RewardRedemptionRow>
        className="desktop-only max-lg:hidden!"
        rowKey="id" dataSource={rows}
        columns={columns}
        scroll={{ x: 1050 }}
        pagination={false}
      />}
      {(!redemptionsQuery.isError || rows.length > 0) && (
        <MobileCards
          className={loading ? 'rewards-list-loading' : 'rewards-tablet-cards'}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText={customerSearch || statusFilter ? 'Không có kết quả' : 'Chưa có lượt đổi quà'}
          renderCard={(row) => {
            const options = actions(row)
            const status = REDEMPTION_META[row.status ?? '']
            return (
              <>
                <div className="mobile-card-head items-start!">
                  <div className="min-w-0">
                    <div className="mobile-card-title">{row.user?.full_name ?? 'Khách hàng không xác định'}</div>
                    <div className="mobile-card-sub">{[row.user?.customer_code, row.user?.phone].filter(Boolean).join(' · ') || row.user_id}</div>
                  </div>
                  <Tag className="me-0!" color={status?.color}>{status?.label ?? row.status ?? '—'}</Tag>
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Quà" value={row.reward?.name ?? row.reward_id} />
                  <MobileCardRow label="Điểm đã trừ" value={<strong className="text-(--brand-primary) tabular-nums">{Number(row.points_spent).toLocaleString('vi-VN')}</strong>} />
                  <MobileCardRow label="Ngày đổi" value={formatDateTime(row.created_at)} />
                  {row.customer_treatment_id && <MobileCardRow label="Gói liệu trình" value={`#${row.customer_treatment_id.slice(0, 8).toUpperCase()} · giảm ${Number(row.applied_discount_amount ?? 0).toLocaleString('vi-VN')}đ`} />}
                  {row.cancel_reason && <MobileCardRow label="Lý do hủy" value={row.cancel_reason} />}
                </div>
                <RewardCardActions ariaLabel="Thao tác lượt đổi" disabled={markUsedMutation.isPending}
                  items={options} onSelect={(key) => runAction(row, key)} />
              </>
            )
          }}
        />
      )}
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
