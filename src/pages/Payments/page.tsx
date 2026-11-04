import { useState } from 'react'
import { Alert, Button, DatePicker, Form, Input, Modal, Select, Space, Table, Typography, message } from 'antd'
import { ReloadOutlined, StopOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData } from '@/api/helpers'
import type { Branch } from '@/api/models/branch'
import type { PaymentLog } from '@/api/models/paymentLog'
import { getGetPaymentsQueryKey, useGetPayments, usePostPaymentsIdVoid } from '@/api/endpoints/customer-treatments'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { useAbility } from '@casl/react'
import { useQueryClient } from '@tanstack/react-query'

const PAY_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'Quẹt thẻ',
  OTHER: 'Khác',
}

type PaymentColumnKey = 'paid_at' | 'customer' | 'package' | 'branch' | 'amount' | 'method' | 'entered_by'

const PAYMENT_COLUMN_OPTIONS: { label: string; value: PaymentColumnKey }[] = [
  { label: 'Thời gian', value: 'paid_at' },
  { label: 'Khách hàng', value: 'customer' },
  { label: 'Gói / dịch vụ', value: 'package' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Số tiền', value: 'amount' },
  { label: 'Phương thức', value: 'method' },
  { label: 'Thu ngân', value: 'entered_by' },
]

const DEFAULT_VISIBLE_COLUMNS = PAYMENT_COLUMN_OPTIONS.map((column) => column.value)

interface LedgerRow extends PaymentLog {
  branch_id?: string
  customer_treatment?: {
    customer_profile?: { full_name?: string; phone?: string }
    package_snapshot?: { name?: string }
    branch_id?: string
  } | null
  appointment?: {
    branch_id?: string
    service?: { title?: string }
    customer_profile?: { full_name?: string; phone?: string }
  } | null
}

/** PM-03 — Sổ thanh toán toàn hệ thống + PM-04 hủy giao dịch (Admin). */
export default function Payments() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<PaymentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<PaymentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [voidRow, setVoidRow] = useState<LedgerRow | null>(null)
  const [voidForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const queryClient = useQueryClient()
  const canVoid = useAbility().can('DELETE', 'CUSTOMER')

  const params = {
    page,
    limit,
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    ...(staffFilter ? { entered_by: staffFilter } : {}),
    ...(range?.[0] ? { from_date: range[0].format('YYYY-MM-DD') } : {}),
    ...(range?.[1] ? { to_date: range[1].format('YYYY-MM-DD') } : {}),
  }

  const paymentsQuery = useGetPayments(params)
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
    filterForm.setFieldsValue({ branch_id: branchFilter, entered_by: staffFilter, date_range: range })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setBranchFilter(typeof values.branch_id === 'string' && values.branch_id ? values.branch_id : undefined)
    setStaffFilter(typeof values.entered_by === 'string' && values.entered_by ? values.entered_by : undefined)
    setRange((values.date_range as [Dayjs | null, Dayjs | null] | undefined) ?? null)
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
    Number(Boolean(branchFilter)) + Number(Boolean(staffFilter)) + Number(Boolean(range?.[0] || range?.[1]))

  const columns = [
    {
      key: 'paid_at',
      title: 'Thời gian',
      dataIndex: 'paid_at',
      width: 140,
      render: (v: string) => dayjs(v).format('DD/MM/YYYY HH:mm'),
    },
    {
      key: 'customer',
      title: 'Khách hàng',
      render: (_: unknown, row: LedgerRow) => {
        const profile = row.customer_treatment?.customer_profile ?? row.appointment?.customer_profile
        return (
          <div>
            <div style={{ fontWeight: 500 }}>{profile?.full_name || '—'}</div>
            <div style={{ fontSize: 12, color: '#6F7071' }}>{profile?.phone || ''}</div>
          </div>
        )
      },
    },
    {
      key: 'package',
      title: 'Gói / dịch vụ',
      render: (_: unknown, row: LedgerRow) => row.customer_treatment?.package_snapshot?.name
        || (row.appointment?.service?.title ? `Dịch vụ lẻ · ${row.appointment.service.title}` : '—'),
    },
    {
      key: 'branch',
      title: 'Cơ sở',
      width: 150,
      render: (_: unknown, row: LedgerRow) => branchById.get(row.branch_id ?? row.customer_treatment?.branch_id ?? row.appointment?.branch_id ?? '') || '—',
    },
    {
      key: 'amount',
      title: 'Số tiền',
      dataIndex: 'amount',
      width: 140,
      render: (v: number) => <Typography.Text strong>{Number(v).toLocaleString('vi-VN')} ₫</Typography.Text>,
    },
    {
      key: 'method',
      title: 'Phương thức',
      dataIndex: 'method',
      width: 130,
      render: (v: string) => PAY_METHOD[v] ?? v,
    },
    {
      key: 'entered_by',
      title: 'Thu ngân',
      width: 150,
      render: (_: unknown, row: LedgerRow) => staffById.get(row.entered_by ?? '') || '—',
    },
    {
      key: 'actions',
      title: 'Hành động', align: 'center' as const,
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, row: LedgerRow) => (
        <RowActionsMenu
          items={canVoid ? [{ key: 'void', icon: <StopOutlined />, label: 'Hủy giao dịch', danger: true }] : []}
          onSelect={(key) => {
            if (key === 'void') {
              voidForm.resetFields()
              setVoidRow(row)
            }
          }}
        />
      ),
    },
  ]

  return (
    <>
      <PageTitle
        subtitle="Lịch sử giao dịch thanh toán của khách hàng"
        extra={
          <Space wrap>
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
                  <Form.Item name="branch_id" label="Cơ sở" style={{ marginBottom: 10 }}>
                    <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((b) => ({ value: b.id, label: b.name }))} />
                  </Form.Item>
                  <Form.Item name="entered_by" label="Thu ngân" style={{ marginBottom: 10 }}>
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      placeholder="Tất cả"
                      options={staffRows.map((s) => ({ value: s.id, label: s.zalo_name || s.email || s.id }))}
                    />
                  </Form.Item>
                  <Form.Item name="date_range" label="Khoảng thời gian" style={{ marginBottom: 0 }}>
                    <DatePicker.RangePicker placeholder={['Từ ngày', 'Đến ngày']} style={{ width: '100%' }} />
                  </Form.Item>
                </>
              )}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refresh()}>Tải lại</Button>
          </Space>
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

      <Modal
        title="Hủy giao dịch thanh toán"
        open={!!voidRow}
        onCancel={() => setVoidRow(null)}
        onOk={() => void submitVoid()}
        okText="Hủy giao dịch"
        okButtonProps={{ danger: true }}
        cancelText="Không"
        confirmLoading={voidMutation.isPending}
        destroyOnHidden
      >
        {voidRow && (
          <div style={{ marginBottom: 12 }}>
            <Typography.Paragraph>
              Giao dịch <Typography.Text strong>{Number(voidRow.amount).toLocaleString('vi-VN')} ₫</Typography.Text> —
              ngày {dayjs(String(voidRow.paid_at)).format('DD/MM/YYYY HH:mm')}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              Hủy mềm: giao dịch được giữ vết (người hủy, lý do), số nợ của khách được tính lại tự động.
            </Typography.Paragraph>
          </div>
        )}
        <Form form={voidForm} layout="vertical">
          <Form.Item name="void_reason" label="Lý do hủy (bắt buộc)" rules={[{ required: true, whitespace: true, message: 'Nhập lý do hủy' }]}>
            <Input.TextArea rows={2} maxLength={500} placeholder="VD: Thu nhầm tiền, khách yêu cầu hoàn trả" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}