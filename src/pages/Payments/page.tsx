import { useState } from 'react'
import { Alert, Button, DatePicker, Form, Input, Select, Space, Table, Typography, message } from 'antd'
import { StopOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
import { displayName } from '@/utils/displayName'
import type { Branch } from '@/api/models/branch'
import { getGetPaymentsAdminQueryKey, useGetPaymentsAdmin, usePostPaymentsIdVoidAdmin } from '@/api/endpoints/treatment-customers'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useAbility } from '@casl/react'
import { useQueryClient } from '@tanstack/react-query'
import PaymentVoidModal from './components/PaymentVoidModal'
import {
  PAY_METHOD,
  type LedgerRow,
} from './components/constants'

/** PM-03 — Lịch sử thanh toán toàn hệ thống + PM-04 hủy giao dịch (Admin). */
export default function Payments() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [customerSearch, setCustomerSearch] = useState<string>()
  const [searchInput, setSearchInput] = useState('')
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [voidRow, setVoidRow] = useState<LedgerRow | null>(null)
  const [voidForm] = Form.useForm()

  const applySearch = (value: string) => {
    setSearchInput(value)
    setCustomerSearch(value.trim() || undefined)
    setPage(1)
  }
  const queryClient = useQueryClient()
  const canVoid = useAbility().can('DELETE', 'CUSTOMER')

  const params = {
    page,
    limit,
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    ...(staffFilter ? { entered_by: staffFilter } : {}),
    ...(customerSearch ? { q: customerSearch } : {}),
    ...(range?.[0] ? { from_date: range[0].format('YYYY-MM-DD') } : {}),
    ...(range?.[1] ? { to_date: range[1].format('YYYY-MM-DD') } : {}),
  }

  const paymentsQuery = useGetPaymentsAdmin(params as unknown as Parameters<typeof useGetPaymentsAdmin>[0])
  const branchesQuery = useGetBranchesAdmin()
  const staffQuery = useGetUsersAdmin({ currentPage: 1, pageSize: 100, has_role: true } as never)
  const voidMutation = usePostPaymentsIdVoidAdmin()

  const raw = pickData<LedgerRow[] | { rows?: LedgerRow[] }>(paymentsQuery.data)
  const rows = (Array.isArray(raw) ? raw : raw?.rows ?? []) as LedgerRow[]
  const meta = (paymentsQuery.data as unknown as { meta?: { total?: number } })?.meta
  const total = meta?.total ?? rows.length

  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const staffRows = (pickData<{ rows?: { id: string; zalo_name?: string; email?: string }[] }>(staffQuery.data) as
    | { rows?: { id: string; zalo_name?: string; email?: string }[] }
    | undefined)?.rows ?? []

  const staffById = new Map(staffRows.map((s) => [s.id, s.zalo_name || s.email]))
  const branchById = new Map(branches.map((b) => [b.id, b.name]))

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetPaymentsAdminQueryKey() })

  const submitVoid = async () => {
    if (!voidRow) return
    const values = await voidForm.validateFields()
    try {
      await voidMutation.mutateAsync({ id: voidRow.id, data: { void_reason: values.void_reason } })
      message.success('Đã hủy giao dịch thanh toán')
      setVoidRow(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const columns = [
    {
      key: 'paid_at',
      title: 'Thời gian',
      dataIndex: 'paid_at',
      width: 140,
      render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—'),
    },
    {
      key: 'customer',
      title: 'Khách hàng',
      render: (_: unknown, row: LedgerRow) => {
        const customer = row.customer_treatment?.customer_profile || row.appointment?.customer_profile
        if (!customer) return '—'
        return (
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 600 }}>{displayName(customer)}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {customer.phone}
            </Typography.Text>
          </Space>
        )
      },
    },
    {
      key: 'package',
      title: 'Gói / dịch vụ',
      render: (_: unknown, row: LedgerRow) => {
        const name = row.customer_treatment?.package_snapshot?.name || row.appointment?.service?.title
        return name || '—'
      },
    },
    {
      key: 'branch',
      title: 'Cơ sở',
      width: 120,
      render: (_: unknown, row: LedgerRow) => {
        const branchId = row.branch_id || row.customer_treatment?.branch_id || row.appointment?.branch_id
        return (branchId && branchById.get(branchId)) || '—'
      },
    },
    {
      key: 'amount',
      title: 'Số tiền',
      dataIndex: 'amount',
      width: 110,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: 'var(--brand-primary, #1890ff)' }}>
          {Number(v).toLocaleString('vi-VN')} ₫
        </span>
      ),
    },
    {
      key: 'method',
      title: 'Phương thức',
      dataIndex: 'method',
      width: 120,
      render: (v: string) => PAY_METHOD[v] || v || '—',
    },
    {
      key: 'entered_by',
      title: 'Thu ngân',
      dataIndex: 'entered_by',
      width: 130,
      render: (v: string | undefined, row: LedgerRow) => row.cashier_name || (v ? staffById.get(v) || 'Không rõ thu ngân' : '—'),
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: 90,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: unknown, row: LedgerRow) => (
        <RowActionsMenu
          items={[
            {
              key: 'void',
              icon: <StopOutlined />,
              label: 'Hủy giao dịch',
              danger: true,
            },
          ]}
          onSelect={(key) => {
            if (key === 'void') {
              setVoidRow(row)
              voidForm.resetFields()
            }
          }}
        />
      ),
    },
  ]

  return (
    <>
      <PageTitle
        subtitle="Lịch sử thu tiền thực tế trên toàn chuỗi"
        left={
          <>
            <Input.Search
              allowClear
              placeholder="Tìm khách theo tên / SĐT"
              className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
              value={searchInput}
              onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
              onSearch={applySearch}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả cơ sở"
              style={{ width: 170 }}
              value={branchFilter}
              onChange={(value) => { setBranchFilter(value); setPage(1) }}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Thu ngân"
              style={{ width: 160 }}
              value={staffFilter}
              onChange={(value) => { setStaffFilter(value); setPage(1) }}
              options={staffRows.map((s) => ({ value: s.id, label: s.zalo_name || s.email }))}
            />
            <DatePicker.RangePicker
              placeholder={['Từ ngày', 'Đến ngày']}
              value={range ?? undefined}
              onChange={(dates) => { setRange(dates ?? null); setPage(1) }}
            />
          </>
        }
      >
        Lịch sử thanh toán
      </PageTitle>

      {paymentsQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải được lịch sử thanh toán"
          description={errorMessage(paymentsQuery.error)}
          action={<Button size="small" onClick={() => void paymentsQuery.refetch()}>Thử lại</Button>}
        />
      )}

      <Table<LedgerRow>
        rowKey="id"
        loading={paymentsQuery.isLoading}
        dataSource={rows}
        columns={columns.filter((column) => column.key !== 'actions' || canVoid)}
        scroll={{ x: 1100 }}
        pagination={false}
        locale={{ emptyText: <TableEmpty description="Chưa có giao dịch thanh toán nào khớp điều kiện" /> }}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="khoản thanh toán" />

      <PaymentVoidModal
        open={!!voidRow}
        voidRow={voidRow}
        onCancel={() => setVoidRow(null)}
        onSubmit={() => void submitVoid()}
        confirmLoading={voidMutation.isPending}
        form={voidForm}
      />
    </>
  )
}
