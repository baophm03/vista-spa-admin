import { useState } from 'react'
import { Alert, Button, DatePicker, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd'
import { StopOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
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
import './payments.css'

const customerOf = (row: LedgerRow) => row.customer_treatment?.customer_profile || row.appointment?.customer_profile
const packageLabel = (row: LedgerRow) => row.customer_treatment?.package_snapshot?.name || row.appointment?.service?.title || '—'
const paidAtLabel = (value?: LedgerRow['paid_at']) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—'
const amountLabel = (value: number) => `${Number(value).toLocaleString('vi-VN')} ₫`
const methodLabel = (value: string) => PAY_METHOD[value] || value || '—'

interface PaymentFilters {
  branch?: string
  staff?: string
  dates?: [Dayjs | null, Dayjs | null] | null
}

/** PM-03 — Lịch sử thanh toán toàn hệ thống + PM-04 hủy giao dịch (Admin). */
export default function Payments() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [customerSearch, setCustomerSearch] = useState<string>()
  const [searchInput, setSearchInput] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [filterForm] = Form.useForm<PaymentFilters>()
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
  const branchLabel = (row: LedgerRow) => {
    const id = row.branch_id || row.customer_treatment?.branch_id || row.appointment?.branch_id
    return (id && branchById.get(id)) || '—'
  }
  const cashierLabel = (row: LedgerRow) =>
    row.cashier_name || (row.entered_by ? staffById.get(row.entered_by) || 'Không rõ thu ngân' : '—')

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

  const openVoidDialog = (row: LedgerRow) => {
    setVoidRow(row)
    voidForm.resetFields()
  }

  const renderVoidButton = (row: LedgerRow) => row.voided_at ? null : (
    <Button danger icon={<StopOutlined />} className="payment-void-button" onClick={() => openVoidDialog(row)}>
      Hủy giao dịch
    </Button>
  )

  const filterCount = [branchFilter, staffFilter, range?.some(Boolean)].filter(Boolean).length
  const hasFilters = Boolean(filterCount || customerSearch)
  const branchOptions = branches.map((branch) => ({ value: branch.id, label: branch.name }))
  const staffOptions = staffRows.map((staff) => ({ value: staff.id, label: staff.zalo_name || staff.email }))

  const applyFilters = ({ branch, staff, dates }: PaymentFilters) => {
    setBranchFilter(branch)
    setStaffFilter(staff)
    setRange(dates ?? null)
    setPage(1)
    setFiltersOpen(false)
  }
  const columns = [
    {
      key: 'paid_at',
      title: 'Thời gian',
      dataIndex: 'paid_at',
      width: 140,
      render: paidAtLabel,
    },
    {
      key: 'customer',
      title: 'Khách hàng',
      render: (_: unknown, row: LedgerRow) => {
        const customer = customerOf(row)
        if (!customer) return '—'
        return (
          <Space direction="vertical" size={0}>
            <span style={{ fontWeight: 600 }}>{customer.full_name}</span>
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
      render: (_: unknown, row: LedgerRow) => packageLabel(row),
    },
    {
      key: 'branch',
      title: 'Cơ sở',
      width: 120,
      render: (_: unknown, row: LedgerRow) => branchLabel(row),
    },
    {
      key: 'amount',
      title: 'Số tiền',
      dataIndex: 'amount',
      width: 110,
      render: (v: number) => (
        <span style={{ fontWeight: 600, color: 'var(--brand-primary, #1890ff)' }}>
          {amountLabel(v)}
        </span>
      ),
    },
    {
      key: 'method',
      title: 'Phương thức',
      dataIndex: 'method',
      width: 120,
      render: methodLabel,
    },
    {
      key: 'entered_by',
      title: 'Thu ngân',
      dataIndex: 'entered_by',
      width: 130,
      render: (_: unknown, row: LedgerRow) => cashierLabel(row),
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: 90,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: unknown, row: LedgerRow) => (
        <RowActionsMenu
          items={[{ key: 'void', icon: <StopOutlined />, label: 'Hủy giao dịch', danger: true }]}
          onSelect={() => openVoidDialog(row)}
        />
      ),
    },
  ]

  return (
    <div className="payments-page">
      <PageTitle className="mb-3!" subtitle="Lịch sử thu tiền thực tế trên toàn chuỗi">
        Lịch sử thanh toán
      </PageTitle>

      <div className="payment-filters">
        <Input.Search
          allowClear
          aria-label="Tìm khách theo tên hoặc số điện thoại"
          placeholder="Tìm khách theo tên / SĐT"
          className="payment-filter-search"
          value={searchInput}
          onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
          onSearch={applySearch}
        />
        <div className="payment-filter-popup">
          <ListFilterPopover
            open={filtersOpen}
            onOpenChange={(open) => {
              if (open) filterForm.setFieldsValue({ branch: branchFilter, staff: staffFilter, dates: range })
              setFiltersOpen(open)
            }}
            activeFilterCount={filterCount}
            form={filterForm}
            onApply={applyFilters}
            onClear={() => applyFilters({})}
            filterItems={(
              <>
                <Form.Item name="branch" label="Cơ sở" className="mb-3!">
                  <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả cơ sở" options={branchOptions} />
                </Form.Item>
                <Form.Item name="staff" label="Thu ngân" className="mb-3!">
                  <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả thu ngân" options={staffOptions} />
                </Form.Item>
                <Form.Item name="dates" label="Khoảng ngày" className="mb-0!">
                  <DatePicker.RangePicker className="w-full min-w-0" format="DD/MM/YYYY" placeholder={['Từ ngày', 'Đến ngày']} />
                </Form.Item>
              </>
            )}
          />
        </div>
        <div className="payment-filter-options">
          <Select
            allowClear
            aria-label="Cơ sở"
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả cơ sở"
            className="payment-filter-branch"
            value={branchFilter}
            onChange={(value) => { setBranchFilter(value); setPage(1) }}
            options={branchOptions}
          />
          <Select
            allowClear
            aria-label="Thu ngân"
            showSearch
            optionFilterProp="label"
            placeholder="Thu ngân"
            className="payment-filter-staff"
            value={staffFilter}
            onChange={(value) => { setStaffFilter(value); setPage(1) }}
            options={staffOptions}
          />
          <DatePicker.RangePicker
            className="payment-filter-dates"
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
            value={range ?? undefined}
            onChange={(dates) => { setRange(dates ?? null); setPage(1) }}
          />
        </div>
      </div>

      {paymentsQuery.isError ? (
        <Alert
          className="payment-list-error"
          type="error"
          showIcon
          title="Không tải được lịch sử thanh toán"
          description={errorMessage(paymentsQuery.error)}
          action={<Button loading={paymentsQuery.isFetching} onClick={() => void paymentsQuery.refetch()}>Thử lại</Button>}
        />
      ) : (
        <>
          <Table<LedgerRow>
            className="desktop-only"
            rowKey="id"
            loading={paymentsQuery.isLoading}
            dataSource={rows}
            columns={columns.filter((column) => column.key !== 'actions' || canVoid)}
            scroll={{ x: 1100 }}
            pagination={false}
            locale={{ emptyText: <TableEmpty description="Chưa có giao dịch thanh toán nào khớp điều kiện" /> }}
          />
          <MobileCards
            rows={rows}
            rowKey={(row) => row.id}
            loading={paymentsQuery.isLoading}
            emptyText={hasFilters ? 'Không có kết quả' : 'Chưa có giao dịch thanh toán'}
            emptyDescription={hasFilters ? 'Thử đổi từ khóa hoặc bộ lọc' : undefined}
            renderCard={(row) => {
              const customer = customerOf(row)
              return (
                <>
                  <div className="mobile-card-head payment-card-head">
                    <div className="min-w-0">
                      <div className="mobile-card-title">{customer?.full_name || '—'}</div>
                      {customer?.phone && <div className="mobile-card-sub">{customer.phone}</div>}
                    </div>
                    <strong className="payment-card-amount">{amountLabel(row.amount)}</strong>
                  </div>
                  <div className="mobile-card-rows">
                    <MobileCardRow label="Thời gian" value={paidAtLabel(row.paid_at)} />
                    <MobileCardRow label="Gói / dịch vụ" value={packageLabel(row)} />
                    <MobileCardRow label="Cơ sở" value={branchLabel(row)} />
                    <MobileCardRow label="Phương thức" value={methodLabel(row.method)} />
                    <MobileCardRow label="Thu ngân" value={cashierLabel(row)} />
                    {row.note && <MobileCardRow label="Ghi chú" value={row.note} />}
                    {row.voided_at && <MobileCardRow label="Trạng thái" value={<Tag color="red">Đã hủy</Tag>} />}
                  </div>
                  {canVoid && !row.voided_at && (
                    <div className="mobile-card-actions">
                      {renderVoidButton(row)}
                    </div>
                  )}
                </>
              )
            }}
          />
          <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="khoản thanh toán" />
        </>
      )}

      <PaymentVoidModal
        open={!!voidRow}
        voidRow={voidRow}
        onCancel={() => setVoidRow(null)}
        onSubmit={() => void submitVoid()}
        confirmLoading={voidMutation.isPending}
        form={voidForm}
      />
    </div>
  )
}
