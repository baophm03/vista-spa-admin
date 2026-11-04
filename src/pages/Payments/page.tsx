import { useEffect, useState } from 'react'
import { Alert, Button, DatePicker, Form, Input, Select, Space, Table, Typography, message } from 'antd'
import { SearchOutlined, StopOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import { getGetPaymentsQueryKey, useGetPayments, usePostPaymentsIdVoid } from '@/api/endpoints/customer-treatments'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { useAbility } from '@casl/react'
import { useQueryClient } from '@tanstack/react-query'
import PaymentVoidModal from './components/PaymentVoidModal'
import {
  DEFAULT_VISIBLE_COLUMNS,
  PAYMENT_COLUMN_OPTIONS,
  PAY_METHOD,
  type LedgerRow,
  type PaymentColumnKey,
} from './components/constants'

/** PM-03 — Sổ thanh toán toàn hệ thống + PM-04 hủy giao dịch (Admin). */
export default function Payments() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [customerSearch, setCustomerSearch] = useState<string>()
  const [searchInput, setSearchInput] = useState('')
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<PaymentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<PaymentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [voidRow, setVoidRow] = useState<LedgerRow | null>(null)
  const [voidForm] = Form.useForm()
  const [filterForm] = Form.useForm()

  // Gõ tìm kiếm có debounce 400ms — giống các page danh sách khác
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setCustomerSearch(searchInput.trim() || undefined)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])
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

  const paymentsQuery = useGetPayments(params as unknown as Parameters<typeof useGetPayments>[0])
  const branchesQuery = useGetBranches()
  const staffQuery = useGetUsers({ currentPage: 1, pageSize: 100, has_role: true } as never)
  const voidMutation = usePostPaymentsIdVoid()

  const raw = pickData<LedgerRow[] | { rows?: LedgerRow[] }>(paymentsQuery.data)
  const rows = (Array.isArray(raw) ? raw : raw?.rows ?? []) as LedgerRow[]
  const meta = (paymentsQuery.data as unknown as { meta?: { total?: number } })?.meta
  const total = meta?.total ?? rows.length

  const branches = (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[]
  const staffRows = (pickData<{ rows?: { id: string; zalo_name?: string; email?: string }[] }>(staffQuery.data) as
    | { rows?: { id: string; zalo_name?: string; email?: string }[] }
    | undefined)?.rows ?? []

  const staffById = new Map(staffRows.map((s) => [s.id, s.zalo_name || s.email || s.id]))
  const branchById = new Map(branches.map((b) => [b.id, b.name]))

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetPaymentsQueryKey() })

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({
      branch_id: branchFilter,
      entered_by: staffFilter,
      date_range: range,
    })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    const dates = values.date_range as [Dayjs | null, Dayjs | null] | undefined
    setBranchFilter((values.branch_id as string) || undefined)
    setStaffFilter((values.entered_by as string) || undefined)
    setRange(dates ?? null)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setBranchFilter(undefined)
    setStaffFilter(undefined)
    setRange(null)
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

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

  const activeFilterCount =
    Number(Boolean(branchFilter)) + Number(Boolean(staffFilter)) + Number(Boolean(customerSearch)) + Number(Boolean(range?.[0] || range?.[1]))

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
      render: (_: unknown, row: LedgerRow) => {
        const name = row.customer_treatment?.package_snapshot?.name || row.appointment?.service?.title
        return name || '—'
      },
    },
    {
      key: 'branch',
      title: 'Cơ sở',
      render: (_: unknown, row: LedgerRow) => {
        const branchId = row.branch_id || row.customer_treatment?.branch_id || row.appointment?.branch_id
        return (branchId && branchById.get(branchId)) || '—'
      },
    },
    {
      key: 'amount',
      title: 'Số tiền',
      dataIndex: 'amount',
      width: 130,
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
      render: (v: string) => (v && staffById.get(v)) || v || '—',
    },
    {
      key: 'actions',
      title: 'Hành động',
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
            <Input
              allowClear
              prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
              placeholder="Tìm khách theo tên / SĐT"
              className="w-[220px]!"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={PAYMENT_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as PaymentColumnKey[])}
              filterItems={(
                <>
                  <Form.Item name="branch_id" label="Cơ sở" className="mb-2.5!">
                    <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
                  </Form.Item>
                  <Form.Item name="entered_by" label="Thu ngân" className="mb-2.5!">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="Tất cả"
                      options={staffRows.map((s) => ({ value: s.id, label: s.zalo_name || s.email || s.id }))}
                    />
                  </Form.Item>
                  <Form.Item name="date_range" label="Khoảng thời gian" className="mb-0!">
                    <DatePicker.RangePicker placeholder={['Từ ngày', 'Đến ngày']} className="w-full!" />
                  </Form.Item>
                </>
              )}
            />
          </>
        }
      >
        Sổ thanh toán
      </PageTitle>

      {paymentsQuery.isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải được sổ thanh toán"
          description={errorMessage(paymentsQuery.error)}
          action={<Button size="small" onClick={() => void paymentsQuery.refetch()}>Thử lại</Button>}
        />
      )}

      <Table<LedgerRow>
        rowKey="id"
        loading={paymentsQuery.isLoading}
        dataSource={rows}
        columns={columns.filter((column) =>
          (column.key !== 'actions' || canVoid) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as PaymentColumnKey)),
        )}
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
