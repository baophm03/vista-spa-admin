import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData } from '@/api/helpers'
import type { PostReferralsAdminBody, PutReferralsIdAdminBody } from '@/api/models'
import { getGetReferralsAdminQueryKey, useGetReferralsAdmin, usePostReferralsAdmin, usePutReferralsIdAdmin } from '@/api/endpoints/referrals'
import { useGetCustomerProfilesAdmin } from '@/api/endpoints/customer-profiles'
import { useGetDiscountRulesAdmin } from '@/api/endpoints/discount-rules'
import type { DiscountRule } from '@/api/models'
import ReferralModal from './components/ReferralModal'
import {
  COMMISSION_STATUS_META,
  REFERRER_TYPE_META,
  STATUS_META,
  formatVnd,
  type CustomerOption,
  type ReferralRow,
} from './components/constants'

export default function ReferralsPanel() {
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'REFERRAL')
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ReferralRow | null>(null)
  const [form] = Form.useForm()
  const queryClient = useQueryClient()

  const listQuery = useGetReferralsAdmin()
  const rows = useMemo(() => {
    const raw = pickData<unknown>(listQuery.data)
    return (Array.isArray(raw) ? raw : (raw as { rows?: ReferralRow[] } | null)?.rows ?? []) as ReferralRow[]
  }, [listQuery.data])

  // Danh sách khách hàng — dùng cho "khách được giới thiệu" và referrer (user giới thiệu)
  const customersQuery = useGetCustomerProfilesAdmin({ page: 1, limit: 200 })
  const customers = useMemo(() => {
    const raw = pickData<unknown>(customersQuery.data)
    const list = (Array.isArray(raw) ? raw : (raw as { rows?: CustomerOption[] } | null)?.rows ?? []) as CustomerOption[]
    return list
  }, [customersQuery.data])
  const discountRulesQuery = useGetDiscountRulesAdmin({ is_active: true, audience: 'NEW_BY_REFERRAL' })
  const discountRules = useMemo(() => pickData<DiscountRule[]>(discountRulesQuery.data) ?? [], [discountRulesQuery.data])

  const referrerTypeValue = Form.useWatch('referrer_type', form) as string | undefined

  // Tập hợp các customer_profile_id đã được giới thiệu (loại trừ khi tạo mới để tránh trùng)
  const alreadyReferredIds = useMemo(() => new Set(rows.map((r) => r.referred_profile_id)), [rows])

  const createMutation = usePostReferralsAdmin({
    mutation: {
      onSuccess: () => {
        message.success('Đã ghi nhận lượt giới thiệu')
        setOpen(false)
        form.resetFields()
        void queryClient.invalidateQueries({ queryKey: getGetReferralsAdminQueryKey() })
      },
      onError: (err) => message.error(errorMessage(err)),
    },
  })

  const updateMutation = usePutReferralsIdAdmin({
    mutation: {
      onSuccess: () => {
        message.success('Đã cập nhật lượt giới thiệu')
        setOpen(false)
        setEditing(null)
        form.resetFields()
        void queryClient.invalidateQueries({ queryKey: getGetReferralsAdminQueryKey() })
      },
      onError: (err) => message.error(errorMessage(err)),
    },
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ referrer_type: 'CUSTOMER' })
    setOpen(true)
  }

  const openEdit = (row: ReferralRow) => {
    setEditing(row)
    form.setFieldsValue({
      status: row.status === 'PAID' ? undefined : row.status,
      discount_rule_id: row.discount_rule_id,
      note: row.note,
    })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (editing) {
      const data: PutReferralsIdAdminBody = {
        status: values.status,
        discount_rule_id: values.discount_rule_id,
        note: values.note,
      }
      await updateMutation.mutateAsync({ id: editing.id, data })
    } else {
      const data: PostReferralsAdminBody = {
        referrer_type: values.referrer_type,
        referrer_id: values.referrer_id,
        referred_profile_id: values.referred_profile_id,
        discount_rule_id: values.discount_rule_id,
        note: values.note,
      }
      await createMutation.mutateAsync({ data })
    }
  }

  const referrerLabel = (row: ReferralRow): string => {
    // BE đã resolve tên người giới thiệu (referrer_profile) — không phụ thuộc danh sách khách phân trang
    return row.referrer_profile?.full_name || row.referrer_profile?.phone || '—'
  }

  const columns: TableColumnsType<ReferralRow> = [
    {
      title: 'Khách được giới thiệu', key: 'referred',
      render: (_v, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.referred_profile?.full_name || row.referred_profile_id}</div>
          {row.referred_profile?.phone && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.referred_profile.phone}</Typography.Text>
          )}
        </div>
      ),
    },
    {
      title: 'Người giới thiệu', key: 'referrer',
      render: (_v, row) => {
        const typeMeta = REFERRER_TYPE_META[row.referrer_type]
        return (
          <Space size={6} wrap>
            <Tag color={typeMeta?.color}>{typeMeta?.label ?? row.referrer_type}</Tag>
            <span>{referrerLabel(row)}</span>
          </Space>
        )
      },
    },
    {
      title: 'Gói mua từ giới thiệu', key: 'packages', width: 220,
      render: (_v, row) => {
        const list = row.packages ?? []
        if (list.length === 0) return <Typography.Text type="secondary">Chưa mua gói</Typography.Text>
        return (
          <Space direction="vertical" size={2}>
            {list.map((pkg) => (
              <div key={pkg.id}>
                <span style={{ fontWeight: 500 }}>{pkg.name}</span>
                <span style={{ color: '#888', marginLeft: 6 }}>({formatVnd(pkg.total_amount)})</span>
              </div>
            ))}
          </Space>
        )
      },
    },
    {
      title: 'Hoa hồng', key: 'commission', width: 140,
      render: (_v, row) => {
        const total = row.commission_total ?? 0
        const status = row.commission_status
        if (total === 0) {
          if (status === 'VOID') return <Tag color="red">Hoa hồng đã hủy</Tag>
          return row.commission_payout_status === 'RECONCILE'
            ? <Tag color="orange">Cần đối soát lượt chi cũ</Tag>
            : <Typography.Text type="secondary">—</Typography.Text>
        }
        const paid = row.commission_paid_total ?? 0
        const unpaid = row.commission_unpaid_total ?? 0
        const reconcile = row.commission_reconcile_total ?? 0
        return (
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 600, color: '#389e0d' }}>{formatVnd(total)}</span>
            {status && (
              <Tag color={COMMISSION_STATUS_META[status]?.color ?? 'default'} style={{ margin: 0 }}>
                {COMMISSION_STATUS_META[status]?.label ?? status}
              </Tag>
            )}
            {paid > 0 && <Tag color="green" style={{ margin: 0 }}>Đã chi: {formatVnd(paid)}</Tag>}
            {unpaid > 0 && <Tag color="gold" style={{ margin: 0 }}>Chưa chi: {formatVnd(unpaid)}</Tag>}
            {reconcile > 0 && <Tag color="orange" style={{ margin: 0 }}>Cần đối soát: {formatVnd(reconcile)}</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Ưu đãi nhận được', key: 'discount_rule', width: 180,
      render: (_v, row) =>
        row.discount_rule
          ? <Tag color="cyan">{row.discount_rule.code} — {row.discount_rule.name}</Tag>
          : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status', width: 120,
      render: (v: string) => {
        const meta = STATUS_META[v]
        return <Tag color={meta?.color}>{meta?.label ?? v}</Tag>
      },
    },
    {
      title: 'Hành động', key: 'actions', align: 'center', width: 90, fixed: 'right',
      render: (_v, row) => (
        <RowActionsMenu
          items={[
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa lượt giới thiệu' },
          ]}
          onSelect={(key) => {
            if (key === 'edit') openEdit(row)
          }}
        />
      ),
    },
  ]

  return (
    <Can I="READ" a="REFERRAL" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <Space className="mb-4! w-full! justify-end" wrap>
              <Can I="CREATE" a="REFERRAL">
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Ghi nhận hoa hồng</Button>
              </Can>
            </Space>
            {listQuery.isError && (
              <Alert
                className="mb-4" type="error" showIcon
                title="Không tải được lịch sử giới thiệu"
                description={errorMessage(listQuery.error)}
                action={<Button size="small" onClick={() => void listQuery.refetch()}>Thử lại</Button>}
              />
            )}
            <Table<ReferralRow>
              rowKey="id" loading={listQuery.isLoading} dataSource={paginateRows(rows, page, 10)}
              scroll={{ x: 'max-content' }}
              expandable={{
                rowExpandable: (row) => (row.commission_entries?.length ?? 0) > 0 || row.commission_payout_status === 'RECONCILE',
                expandedRowRender: (row) => {
                  const entries = row.commission_entries ?? []
                  if (entries.length === 0) {
                    return <Typography.Text type="warning">Lượt này từng được đánh dấu đã chi, nhưng không có khoản hoa hồng chi tiết để đối chiếu.</Typography.Text>
                  }
                  return (
                    <Space direction="vertical" size={6} className="w-full!">
                      {entries.map((entry) => {
                        const wasVoided = entry.status === 'VOID' || entry.status === 'CANCELLED'
                        const payoutStatus = entry.payout_status || 'UNPAID'
                        const payoutLabel = payoutStatus === 'PAID' ? 'Đã chi' : payoutStatus === 'RECONCILE' ? 'Cần đối soát' : 'Chưa chi'
                        const payoutColor = payoutStatus === 'PAID' ? 'green' : payoutStatus === 'RECONCILE' ? 'orange' : 'gold'
                        return (
                          <Space key={entry.id} wrap>
                            <Typography.Text type="secondary">{entry.period_date ? dayjs(entry.period_date).format('DD/MM/YYYY') : 'Không rõ ngày'}</Typography.Text>
                            <Typography.Text>{entry.reason || 'Hoa hồng giới thiệu'}</Typography.Text>
                            <Typography.Text strong>{formatVnd(entry.amount)}</Typography.Text>
                            <Tag color={wasVoided ? 'red' : payoutColor}>{wasVoided ? 'Đã hủy' : payoutLabel}</Tag>
                            {!wasVoided && entry.paid_at && <Typography.Text type="secondary">Ngày chi: {dayjs(entry.paid_at).format('DD/MM/YYYY')}</Typography.Text>}
                            {!wasVoided && entry.payout_note && <Typography.Text type="secondary">Ghi chú: {entry.payout_note}</Typography.Text>}
                            {wasVoided && entry.voided_at && <Typography.Text type="secondary">Ngày hủy: {dayjs(entry.voided_at).format('DD/MM/YYYY')}</Typography.Text>}
                            {wasVoided && entry.void_reason && <Typography.Text type="secondary">Lý do hủy: {entry.void_reason}</Typography.Text>}
                          </Space>
                        )
                      })}
                    </Space>
                  )
                },
              }}
              columns={columns.filter((column) => column.key !== 'actions' || canUpdate)}
              pagination={false}
            />
            <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="lượt giới thiệu" />

            <ReferralModal
              open={open}
              editing={editing}
              onCancel={() => setOpen(false)}
              onSubmit={() => void submit()}
              confirmLoading={createMutation.isPending || updateMutation.isPending}
              form={form}
              discountRulesQueryLoading={discountRulesQuery.isLoading}
              discountRules={discountRules}
              referrerTypeValue={referrerTypeValue}
              customers={customers}
              customersQueryLoading={customersQuery.isLoading}
              alreadyReferredIds={alreadyReferredIds}
            />

          </>
        ) : (
          <Alert type="warning" showIcon title="Tài khoản của bạn chưa được cấp quyền xem lịch sử giới thiệu. Vui lòng liên hệ quản trị viên." />
        )
      }
    </Can>
  )
}
