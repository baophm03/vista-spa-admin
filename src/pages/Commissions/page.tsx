import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { EditOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import EditCommissionModal from './components/EditCommissionModal'
import VoidCommissionModal from './components/VoidCommissionModal'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ManualEntryModal from './components/ManualEntryModal'
import { PAYEE_LABEL } from './components/constants'
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import {
  getGetCommissionsQueryKey,
  getGetCommissionsSummaryQueryKey,
  useGetCommissions,
  useGetCommissionsSummary,
  usePostCommissionsIdVoid,
  usePutCommissionsId,
} from '@/api/endpoints/commissions'
import { useGetCollaborators } from '@/api/endpoints/admin'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import type {
  Branch,
  CommissionEntry,
  CommissionSummaryRow,
  Collaborator,
  GetCommissionsParams,
  GetCommissionsSummaryParams,
  User,
} from '@/api/models'

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang hiệu lực', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  VOID: { label: 'Đã hủy (VOID)', color: 'red' },
}

type CommissionColumnKey =
  | 'period_date' | 'payee' | 'source_type' | 'branch_id' | 'mode'
  | 'base' | 'percent' | 'amount' | 'reason' | 'status'

const COMMISSION_COLUMN_OPTIONS: { label: string; value: CommissionColumnKey }[] = [
  { label: 'Ngày', value: 'period_date' },
  { label: 'Người nhận', value: 'payee' },
  { label: 'Nguồn', value: 'source_type' },
  { label: 'Chi nhánh', value: 'branch_id' },
  { label: 'Chế độ', value: 'mode' },
  { label: 'Căn tính', value: 'base' },
  { label: '% hoa hồng', value: 'percent' },
  { label: 'Số tiền', value: 'amount' },
  { label: 'Lý do', value: 'reason' },
  { label: 'Trạng thái', value: 'status' },
]

const DEFAULT_VISIBLE_COLUMNS = COMMISSION_COLUMN_OPTIONS.map((column) => column.value)

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

export default function Commissions() {
  return (
    <Can I="READ" a="COMMISSION" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle subtitle="Bút toán hoa hồng và báo cáo tổng hợp">Hoa hồng</PageTitle>
            <Tabs
              defaultActiveKey="ledger"
              items={[
                { key: 'ledger', label: 'Sổ hoa hồng', children: <LedgerTab /> },
                { key: 'summary', label: 'Tổng hợp', children: <SummaryTab /> },
              ]}
            />
          </>
        ) : (
          <>
            <PageTitle>Hoa hồng</PageTitle>
            <Alert type="warning" showIcon title="Bạn không có quyền xem hoa hồng (cần quyền commission.read)" />
          </>
        )
      }
    </Can>
  )
}

function LedgerTab() {
  const ability = useAbility()
  const canEdit = ability.can('UPDATE', 'COMMISSION')
  const canVoid = ability.can('VOID', 'COMMISSION')
  const [filters, setFilters] = useState<GetCommissionsParams>({})
  const [page, setPage] = useState(1)
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CommissionColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CommissionColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [manualOpen, setManualOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CommissionEntry | null>(null)
  const [editForm] = Form.useForm()
  const [voidTarget, setVoidTarget] = useState<CommissionEntry | null>(null)
  const [voidForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const queryClient = useQueryClient()
  const branchesQuery = useGetBranches()
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches])
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const collaboratorsQuery = useGetCollaborators({})
  const customersQuery = useGetCustomerProfiles({ page: 1, limit: 200 })

  const listQuery = useGetCommissions({ ...filters, page, limit: 20 })
  const rows = useMemo(() => pickData<CommissionEntry[]>(listQuery.data) ?? [], [listQuery.data])
  const meta = pickMeta(listQuery.data)
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as User[]
  const collaborators = (pickData<Collaborator[] | undefined>(collaboratorsQuery.data) ?? []) as Collaborator[]
  const customers = (pickData<{ items?: Array<{ id?: string; full_name?: string }> } | undefined>(customersQuery.data)?.items
    ?? (pickData<Array<{ id?: string; full_name?: string }> | undefined>(customersQuery.data) ?? [])) as Array<{ id?: string; full_name?: string }>
  const payeeName = useMemo(() => {
    const staffById = new Map(users.map((user) => [user.id, user.zalo_name || user.email || undefined]))
    const collaboratorById = new Map(collaborators.map((row) => [row.id, row.name]))
    const customerById = new Map(customers.map((row) => [row.id, row.full_name]))
    return (row: CommissionEntry): string => {
      if (row.payee_type === 'STAFF') return staffById.get(row.payee_user_id ?? row.staff_id ?? '') ?? '—'
      if (row.payee_type === 'COLLABORATOR') return collaboratorById.get(row.collaborator_id ?? '') ?? '—'
      if (row.payee_type === 'CUSTOMER_REFERRER') return customerById.get(row.referrer_profile_id ?? '') ?? '—'
      return '—'
    }
  }, [users, collaborators, customers])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCommissionsQueryKey() })
    await queryClient.invalidateQueries({ queryKey: getGetCommissionsSummaryQueryKey() })
  }

  const updateMutation = usePutCommissionsId({ mutation: { onSuccess: invalidate } })
  const voidMutation = usePostCommissionsIdVoid({ mutation: { onSuccess: invalidate } })

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({
      payee_type: filters.payee_type,
      mode: filters.mode,
      status: filters.status,
      branch_id: filters.branch_id,
      date_range: filters.date_from || filters.date_to
        ? [filters.date_from ? dayjs(filters.date_from) : null, filters.date_to ? dayjs(filters.date_to) : null]
        : undefined,
    })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    const range = values.date_range as [Dayjs | null, Dayjs | null] | null | undefined
    const next: GetCommissionsParams = {}
    if (values.payee_type) next.payee_type = values.payee_type as GetCommissionsParams['payee_type']
    if (values.mode) next.mode = values.mode as GetCommissionsParams['mode']
    if (values.status) next.status = values.status as GetCommissionsParams['status']
    if (values.branch_id) next.branch_id = values.branch_id as string
    if (range?.[0]) next.date_from = range[0].format('YYYY-MM-DD')
    if (range?.[1]) next.date_to = range[1].format('YYYY-MM-DD')
    setFilters(next)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setFilters({})
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const submitEdit = async () => {
    if (!editTarget) return
    try {
      const values = await editForm.validateFields()
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: { amount: values.amount ?? undefined, percent: values.percent ?? undefined, reason: values.reason },
      })
      message.success('Đã cập nhật bút toán hoa hồng')
      setEditTarget(null)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const submitVoid = async () => {
    if (!voidTarget) return
    try {
      const values = await voidForm.validateFields()
      await voidMutation.mutateAsync({ id: voidTarget.id, data: { void_reason: values.void_reason } })
      message.success('Đã hủy bút toán hoa hồng')
      setVoidTarget(null)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<CommissionEntry> = [
    { key: 'period_date', title: 'Ngày', dataIndex: 'period_date', width: 120, render: (v?: string) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
    {
      key: 'payee', title: 'Người nhận', width: 190,
      render: (_v, row) => (
        <Space size={4}>
          {row.payee_type && <Tag>{PAYEE_LABEL[row.payee_type] ?? row.payee_type}</Tag>}
          <Typography.Text ellipsis style={{ maxWidth: 110 }}>{payeeName(row)}</Typography.Text>
        </Space>
      ),
    },
    { key: 'source_type', title: 'Nguồn', dataIndex: 'source_type', width: 110, render: (v?: string) => ({ PAYMENT: 'Thanh toán', SESSION: 'Buổi điều trị', MANUAL: 'Nhập tay' })[v ?? ''] ?? v ?? '—' },
    { key: 'branch_id', title: 'Chi nhánh', dataIndex: 'branch_id', width: 120, ellipsis: true, render: (v?: string) => (v ? branchNameById.get(v) ?? v : '—') },
    { key: 'mode', title: 'Chế độ', dataIndex: 'mode', width: 90, render: (v?: string) => <Tag color={v === 'AUTO' ? 'blue' : 'orange'}>{v === 'AUTO' ? 'Tự động' : 'Nhập tay'}</Tag> },
    {
      key: 'base', title: 'Căn tính', width: 120, align: 'right',
      render: (_v, row) => (row.base_amount != null ? formatVnd(row.base_amount) : '—'),
    },
    { key: 'percent', title: '%', dataIndex: 'percent', width: 70, align: 'right', render: (v?: number | null) => (v != null ? `${v}%` : '—') },
    { key: 'amount', title: 'Số tiền', dataIndex: 'amount', width: 120, align: 'right', render: (v: number) => <span style={{ fontWeight: 500 }}>{formatVnd(v)}</span> },
    { key: 'reason', title: 'Lý do', dataIndex: 'reason', width: 180, ellipsis: true },
    {
      key: 'status', title: 'Trạng thái', dataIndex: 'status', width: 110,
      render: (v?: string) => {
        const meta = STATUS_META[v ?? 'ACTIVE']
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      key: 'actions', title: 'Hành động', align: 'center' as const, width: 90, fixed: 'right' as const,
      render: (_v, row) =>
        row.status === 'VOID' ? null : (
          <RowActionsMenu
            items={[
              ...(canEdit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
              ...(canVoid ? [{ key: 'void', icon: <StopOutlined />, label: 'Hủy bút toán', danger: true }] : []),
            ]}
            onSelect={(key) => {
              if (key === 'edit') {
                setEditTarget(row)
                editForm.setFieldsValue({ amount: row.amount, percent: row.percent ?? undefined })
              } else if (key === 'void') {
                setVoidTarget(row)
                voidForm.resetFields()
              }
            }}
          />
        ),
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }} wrap>
        <ListFilterPopover
          open={filterOpen}
          onOpenChange={openFilters}
          activeFilterCount={[
            filters.payee_type,
            filters.mode,
            filters.status,
            filters.branch_id,
            filters.date_from,
            filters.date_to,
          ].filter(Boolean).length}
          form={filterForm}
          onApply={applyFilters}
          onClear={clearFilters}
          columnOptions={COMMISSION_COLUMN_OPTIONS}
          draftVisibleColumns={draftVisibleColumns}
          onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CommissionColumnKey[])}
          filterItems={(
            <>
              <Form.Item name="payee_type" label="Người nhận" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="Tất cả" options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
              <Form.Item name="mode" label="Chế độ" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="Tất cả" options={[{ value: 'AUTO', label: 'Tự động' }, { value: 'MANUAL', label: 'Nhập tay' }]} />
              </Form.Item>
              <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="Tất cả" options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))} />
              </Form.Item>
              <Form.Item name="branch_id" label="Chi nhánh" style={{ marginBottom: 10 }}>
                <Select
                  allowClear showSearch optionFilterProp="label" loading={branchesQuery.isLoading}
                  placeholder="Tất cả"
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </Form.Item>
              <Form.Item name="date_range" label="Khoảng thời gian" style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker style={{ width: '100%' }} placeholder={['Từ ngày', 'Đến ngày']} />
              </Form.Item>
            </>
          )}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>Tải lại</Button>
        <Can I="CREATE" a="COMMISSION">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setManualOpen(true)}>Nhập tay</Button>
        </Can>
      </Space>
      {listQuery.isError && (
        <Alert
          className="mb-4" type="error" showIcon
          title="Không tải được sổ hoa hồng"
          description={errorMessage(listQuery.error)}
          action={<Button size="small" onClick={() => void listQuery.refetch()}>Thử lại</Button>}
        />
      )}
      <Table<CommissionEntry>
        rowKey="id" loading={listQuery.isLoading} dataSource={rows}
        scroll={{ x: 'max-content' }}
        columns={columns.filter((column) =>
          (column.key !== 'actions' || canEdit || canVoid) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as CommissionColumnKey)),
        )}
        pagination={false}
      />
      <ListPagination page={page} limit={20} total={meta?.total ?? 0} onChange={setPage} noun="bút toán hoa hồng" />
      <ManualEntryModal open={manualOpen} onClose={() => setManualOpen(false)} onDone={invalidate} />
      <EditCommissionModal
        open={!!editTarget}
        targetMode={editTarget?.mode}
        form={editForm}
        loading={updateMutation.isPending}
        onClose={() => setEditTarget(null)}
        onSubmit={() => void submitEdit()}
      />
      <VoidCommissionModal
        open={!!voidTarget}
        form={voidForm}
        loading={voidMutation.isPending}
        onClose={() => setVoidTarget(null)}
        onSubmit={() => void submitVoid()}
      />
    </>
  )
}

function SummaryTab() {
  const [filters, setFilters] = useState<GetCommissionsSummaryParams>({ group_by: 'month' })
  const [page, setPage] = useState(1)
  const summaryQuery = useGetCommissionsSummary(filters)
  const rawRows = useMemo(() => pickData<CommissionSummaryRow[]>(summaryQuery.data) ?? [], [summaryQuery.data])
  const rows = rawRows as Array<CommissionSummaryRow & { payee_id?: string }>
  const branchesQuery = useGetBranches()
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const collaboratorsQuery = useGetCollaborators({})
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as User[]
  const collaborators = useMemo(() => pickData<(Collaborator & { commission_percent?: number })[]>(collaboratorsQuery.data) ?? [], [collaboratorsQuery.data])
  const staffNameById = useMemo(() => new Map(users.map((user) => [user.id, user.zalo_name || user.email || user.id])), [users])
  const collaboratorNameById = useMemo(() => new Map(collaborators.map((collaborator) => [collaborator.id, collaborator.name])), [collaborators])
  const groupBy = filters.group_by ?? 'month'

  const columns: TableColumnsType<CommissionSummaryRow & { payee_id?: string }> = [
    {
      title: 'Kỳ', dataIndex: 'period', width: 240,
      render: (v: string) => {
        const start = new Date(v)
        if (groupBy === 'day') return start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
        if (groupBy === 'week') {
          const end = new Date(start)
          end.setDate(end.getDate() + 6)
          const dayMonth = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' })
          return `Tuần ${dayMonth.format(start)} – ${dayMonth.format(end)} ${end.getFullYear()}`
        }
        return start.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })
      },
    },
    {
      title: 'Người nhận', key: 'payee', width: 240,
      render: (_v, row) => {
        const id = row.payee_id
        const name = row.payee_type === 'STAFF' ? staffNameById.get(id ?? '')
          : row.payee_type === 'COLLABORATOR' ? collaboratorNameById.get(id ?? '')
            : undefined
        return <Space><Tag>{row.payee_type ? PAYEE_LABEL[row.payee_type] : '—'}</Tag><span>{name || id || '—'}</span></Space>
      },
    },
    { title: 'Số bút toán', dataIndex: 'entries', width: 120, align: 'right', render: (v: string | number) => Number(v).toLocaleString('vi-VN') },
    {
      title: 'Tổng hoa hồng', dataIndex: 'total_amount', width: 180, align: 'right',
      render: (v: string | number) => <span style={{ fontWeight: 500 }}>{formatVnd(Number(v))}</span>,
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', marginBottom: 16 }} wrap>
        <Select
          value={groupBy} style={{ width: 140 }}
          options={[{ value: 'day', label: 'Theo ngày' }, { value: 'week', label: 'Theo tuần' }, { value: 'month', label: 'Theo tháng' }]}
          onChange={(v) => { setFilters((current) => ({ ...current, group_by: v })); setPage(1) }}
        />
        <Select
          allowClear placeholder="Người nhận" style={{ width: 170 }}
          options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))}
          value={filters.payee_type}
          onChange={(v) => { setFilters((current) => ({ ...current, payee_type: v, staff_id: undefined, collaborator_id: undefined })); setPage(1) }}
        />
        {filters.payee_type === 'STAFF' && (
          <Select allowClear showSearch optionFilterProp="label" placeholder="KTV" style={{ width: 210 }} loading={usersQuery.isLoading}
            value={filters.staff_id} options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))}
            onChange={(v) => { setFilters((current) => ({ ...current, staff_id: v })); setPage(1) }} />
        )}
        {filters.payee_type === 'COLLABORATOR' && (
          <Select allowClear showSearch optionFilterProp="label" placeholder="Cộng tác viên" style={{ width: 210 }} loading={collaboratorsQuery.isLoading}
            value={filters.collaborator_id} options={collaborators.map((row) => ({ value: row.id, label: row.name }))}
            onChange={(v) => { setFilters((current) => ({ ...current, collaborator_id: v })); setPage(1) }} />
        )}
        <Select allowClear showSearch optionFilterProp="label" placeholder="Chi nhánh" style={{ width: 180 }} loading={branchesQuery.isLoading}
          value={filters.branch_id} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          onChange={(v) => { setFilters((current) => ({ ...current, branch_id: v })); setPage(1) }} />
        <DatePicker.RangePicker onChange={(dates) => {
          setFilters((current) => ({
            ...current,
            date_from: dates?.[0]?.format('YYYY-MM-DD'),
            date_to: dates?.[1]?.format('YYYY-MM-DD'),
          })); setPage(1)
        }} />
        <Button icon={<ReloadOutlined />} onClick={() => void summaryQuery.refetch()}>Tải lại</Button>
      </Space>
      <Table<CommissionSummaryRow & { payee_id?: string }>
        rowKey={(r) => `${r.period}-${r.payee_type}-${r.payee_id ?? 'unknown'}`}
        loading={summaryQuery.isLoading} dataSource={paginateRows(rows, page, 15)} columns={columns}
        pagination={false}
      />
      <ListPagination page={page} limit={15} total={rows.length} onChange={setPage} noun="bút toán tổng hợp" />
    </>
  )
}
