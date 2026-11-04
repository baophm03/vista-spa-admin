import { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
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
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import {
  getGetCommissionsQueryKey,
  getGetCommissionsSummaryQueryKey,
  useGetCommissions,
  useGetCommissionsSummary,
  usePostCommissions,
  usePostCommissionsIdVoid,
  usePutCommissionsId,
} from '@/api/endpoints/commissions'
import { useGetCollaborators } from '@/api/endpoints/admin'
import { useGetReferrals } from '@/api/endpoints/membership'
import { useGetBranches } from '@/api/endpoints/branches'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetCustomerTreatments, useGetCustomerTreatmentsIdSessions } from '@/api/endpoints/customer-treatments'
import type {
  Branch,
  CommissionEntry,
  CommissionEntryPayeeType,
  CommissionSummaryRow,
  Collaborator,
  CustomerTreatment,
  GetCommissionsParams,
  GetCommissionsSummaryParams,
  PostCommissionsBody,
  TreatmentSession,
  User,
} from '@/api/models'

type PayeeType = NonNullable<CommissionEntryPayeeType>
type ReferralOption = {
  referrer_type: string
  referrer_id: string
  referred_profile_id: string
  status?: string
  referred_profile?: { full_name?: string; phone?: string } | null
}
type TreatmentOption = CustomerTreatment & {
  customer_profile?: { full_name?: string; phone?: string } | null
  package_type?: { name?: string } | null
}

const PAYEE_LABEL: Record<PayeeType, string> = {
  STAFF: 'KTV',
  COLLABORATOR: 'Cá»™ng tÃ¡c viÃªn',
  CUSTOMER_REFERRER: 'KhÃ¡ch giá»›i thiá»‡u',
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Äang hiá»‡u lá»±c', color: 'green' },
  CANCELLED: { label: 'ÄÃ£ há»§y', color: 'default' },
  VOID: { label: 'ÄÃ£ há»§y (VOID)', color: 'red' },
}

type CommissionColumnKey =
  | 'period_date' | 'payee' | 'source_type' | 'branch_id' | 'mode'
  | 'base' | 'percent' | 'amount' | 'reason' | 'status'

const COMMISSION_COLUMN_OPTIONS: { label: string; value: CommissionColumnKey }[] = [
  { label: 'NgÃ y', value: 'period_date' },
  { label: 'NgÆ°á»i nháº­n', value: 'payee' },
  { label: 'Nguá»“n', value: 'source_type' },
  { label: 'Chi nhÃ¡nh', value: 'branch_id' },
  { label: 'Cháº¿ Ä‘á»™', value: 'mode' },
  { label: 'CÄƒn tÃ­nh', value: 'base' },
  { label: '% hoa há»“ng', value: 'percent' },
  { label: 'Sá»‘ tiá»n', value: 'amount' },
  { label: 'LÃ½ do', value: 'reason' },
  { label: 'Tráº¡ng thÃ¡i', value: 'status' },
]

const DEFAULT_VISIBLE_COLUMNS = COMMISSION_COLUMN_OPTIONS.map((column) => column.value)

function formatVnd(v?: number | null): string {
  if (v == null) return 'â€”'
  return `${Number(v).toLocaleString('vi-VN')} â‚«`
}

export default function Commissions() {
  return (
    <Can I="READ" a="COMMISSION" passThrough>
      {(allowed) =>
        allowed ? (
          <>
            <PageTitle subtitle="BÃºt toÃ¡n hoa há»“ng vÃ  bÃ¡o cÃ¡o tá»•ng há»£p">Hoa há»“ng</PageTitle>
            <Tabs
              defaultActiveKey="ledger"
              items={[
                { key: 'ledger', label: 'Sá»• hoa há»“ng', children: <LedgerTab /> },
                { key: 'summary', label: 'Tá»•ng há»£p', children: <SummaryTab /> },
              ]}
            />
          </>
        ) : (
          <>
            <PageTitle>Hoa há»“ng</PageTitle>
            <Alert type="warning" showIcon title="Báº¡n khÃ´ng cÃ³ quyá»n xem hoa há»“ng (cáº§n quyá»n commission.read)" />
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
      if (row.payee_type === 'STAFF') return staffById.get(row.payee_user_id ?? row.staff_id ?? '') ?? 'â€”'
      if (row.payee_type === 'COLLABORATOR') return collaboratorById.get(row.collaborator_id ?? '') ?? 'â€”'
      if (row.payee_type === 'CUSTOMER_REFERRER') return customerById.get(row.referrer_profile_id ?? '') ?? 'â€”'
      return 'â€”'
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
      message.error('HÃ£y giá»¯ láº¡i Ã­t nháº¥t má»™t cá»™t hiá»ƒn thá»‹')
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
      message.success('ÄÃ£ cáº­p nháº­t bÃºt toÃ¡n hoa há»“ng')
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
      message.success('ÄÃ£ há»§y bÃºt toÃ¡n hoa há»“ng')
      setVoidTarget(null)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const columns: TableColumnsType<CommissionEntry> = [
    { key: 'period_date', title: 'NgÃ y', dataIndex: 'period_date', width: 120, render: (v?: string) => (v ? dayjs(v).format('DD/MM/YYYY') : 'â€”') },
    {
      key: 'payee', title: 'NgÆ°á»i nháº­n', width: 190,
      render: (_v, row) => (
        <Space size={4}>
          {row.payee_type && <Tag>{PAYEE_LABEL[row.payee_type] ?? row.payee_type}</Tag>}
          <Typography.Text ellipsis style={{ maxWidth: 110 }}>{payeeName(row)}</Typography.Text>
        </Space>
      ),
    },
    { key: 'source_type', title: 'Nguá»“n', dataIndex: 'source_type', width: 110, render: (v?: string) => ({ PAYMENT: 'Thanh toÃ¡n', SESSION: 'Buá»•i Ä‘iá»u trá»‹', MANUAL: 'Nháº­p tay' })[v ?? ''] ?? v ?? 'â€”' },
    { key: 'branch_id', title: 'Chi nhÃ¡nh', dataIndex: 'branch_id', width: 120, ellipsis: true, render: (v?: string) => (v ? branchNameById.get(v) ?? v : 'â€”') },
    { key: 'mode', title: 'Cháº¿ Ä‘á»™', dataIndex: 'mode', width: 90, render: (v?: string) => <Tag color={v === 'AUTO' ? 'blue' : 'orange'}>{v === 'AUTO' ? 'Tá»± Ä‘á»™ng' : 'Nháº­p tay'}</Tag> },
    {
      key: 'base', title: 'CÄƒn tÃ­nh', width: 120, align: 'right',
      render: (_v, row) => (row.base_amount != null ? formatVnd(row.base_amount) : 'â€”'),
    },
    { key: 'percent', title: '%', dataIndex: 'percent', width: 70, align: 'right', render: (v?: number | null) => (v != null ? `${v}%` : 'â€”') },
    { key: 'amount', title: 'Sá»‘ tiá»n', dataIndex: 'amount', width: 120, align: 'right', render: (v: number) => <span style={{ fontWeight: 500 }}>{formatVnd(v)}</span> },
    { key: 'reason', title: 'LÃ½ do', dataIndex: 'reason', width: 180, ellipsis: true },
    {
      key: 'status', title: 'Tráº¡ng thÃ¡i', dataIndex: 'status', width: 110,
      render: (v?: string) => {
        const meta = STATUS_META[v ?? 'ACTIVE']
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      key: 'actions', title: 'HÃ nh Ä‘á»™ng', align: 'center' as const, width: 90, fixed: 'right' as const,
      render: (_v, row) =>
        row.status === 'VOID' ? null : (
          <RowActionsMenu
            items={[
              ...(canEdit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sá»­a' }] : []),
              ...(canVoid ? [{ key: 'void', icon: <StopOutlined />, label: 'Há»§y bÃºt toÃ¡n', danger: true }] : []),
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
              <Form.Item name="payee_type" label="NgÆ°á»i nháº­n" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="Táº¥t cáº£" options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
              <Form.Item name="mode" label="Cháº¿ Ä‘á»™" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="Táº¥t cáº£" options={[{ value: 'AUTO', label: 'Tá»± Ä‘á»™ng' }, { value: 'MANUAL', label: 'Nháº­p tay' }]} />
              </Form.Item>
              <Form.Item name="status" label="Tráº¡ng thÃ¡i" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="Táº¥t cáº£" options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))} />
              </Form.Item>
              <Form.Item name="branch_id" label="Chi nhÃ¡nh" style={{ marginBottom: 10 }}>
                <Select
                  allowClear showSearch optionFilterProp="label" loading={branchesQuery.isLoading}
                  placeholder="Táº¥t cáº£"
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </Form.Item>
              <Form.Item name="date_range" label="Khoáº£ng thá»i gian" style={{ marginBottom: 0 }}>
                <DatePicker.RangePicker style={{ width: '100%' }} placeholder={['Tá»« ngÃ y', 'Äáº¿n ngÃ y']} />
              </Form.Item>
            </>
          )}
        />
        <Button icon={<ReloadOutlined />} onClick={() => void listQuery.refetch()}>Táº£i láº¡i</Button>
        <Can I="CREATE" a="COMMISSION">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setManualOpen(true)}>Nháº­p tay</Button>
        </Can>
      </Space>
      {listQuery.isError && (
        <Alert
          className="mb-4" type="error" showIcon
          title="KhÃ´ng táº£i Ä‘Æ°á»£c sá»• hoa há»“ng"
          description={errorMessage(listQuery.error)}
          action={<Button size="small" onClick={() => void listQuery.refetch()}>Thá»­ láº¡i</Button>}
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
      <ListPagination page={page} limit={20} total={meta?.total ?? 0} onChange={setPage} noun="bÃºt toÃ¡n hoa há»“ng" />
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

function ManualEntryModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form] = Form.useForm()
  const [payeeType, setPayeeType] = useState<PayeeType>('STAFF')
  const createMutation = usePostCommissions()
  const collaboratorsQuery = useGetCollaborators({})
  const branchesQuery = useGetBranches()
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const treatmentsQuery = useGetCustomerTreatments({ page: 1, limit: 100 })
  const collaborators = useMemo(() => pickData<(Collaborator & { commission_percent?: number })[]>(collaboratorsQuery.data) ?? [], [collaboratorsQuery.data])
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as User[]
  const treatments = (pickData<TreatmentOption[] | undefined>(treatmentsQuery.data) ?? []) as TreatmentOption[]
  const referralsQuery = useGetReferrals()
  const referrals = useMemo(() => pickData<ReferralOption[]>(referralsQuery.data) ?? [], [referralsQuery.data])
  const selectedCollaboratorId = Form.useWatch('collaborator_id', form)
  const selectedTreatmentId = Form.useWatch('customer_treatment_id', form) as string | undefined
  const sessionsQuery = useGetCustomerTreatmentsIdSessions(selectedTreatmentId ?? '', { query: { enabled: !!selectedTreatmentId } })
  const sessions = (pickData<TreatmentSession[] | undefined>(sessionsQuery.data) ?? []) as TreatmentSession[]
  const collaboratorReferrals = useMemo(
    () => referrals.filter((row) => row.referrer_type === 'COLLABORATOR' && row.referrer_id === selectedCollaboratorId && ['APPROVED', 'PAID'].includes(row.status ?? '')),
    [referrals, selectedCollaboratorId],
  )

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const data: PostCommissionsBody = {
        payee_type: payeeType,
        reason: values.reason,
        base_amount: values.base_amount ?? undefined,
        percent: values.percent ?? undefined,
        period_date: values.period_date?.format('YYYY-MM-DD'),
        staff_id: payeeType === 'STAFF' ? values.staff_id || undefined : undefined,
        collaborator_id: payeeType === 'COLLABORATOR' ? values.collaborator_id || undefined : undefined,
        referrer_profile_id: payeeType === 'CUSTOMER_REFERRER' ? values.referrer_profile_id || undefined : undefined,
        customer_profile_id: payeeType === 'COLLABORATOR' ? values.customer_profile_id || undefined : undefined,
        customer_treatment_id: values.customer_treatment_id || undefined,
        session_id: values.session_id || undefined,
        branch_id: values.branch_id || undefined,
        amount: values.amount ?? Math.round(Number(values.base_amount) * Number(values.percent) / 100),
      }
      await createMutation.mutateAsync({ data })
      message.success('ÄÃ£ nháº­p bÃºt toÃ¡n hoa há»“ng')
      form.resetFields()
      onDone()
      onClose()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  return (
    <Modal
      title="Nháº­p hoa há»“ng tay"
      open={open}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={createMutation.isPending}
      okText="LÆ°u" cancelText="Há»§y"
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 12 }}
        onValuesChange={(changed) => {
          if (Object.prototype.hasOwnProperty.call(changed, 'customer_treatment_id')) {
            const treatment = treatments.find((row) => row.id === changed.customer_treatment_id)
            form.setFieldValue('branch_id', treatment?.branch_id)
            form.setFieldValue('session_id', undefined)
          }
          if (Object.prototype.hasOwnProperty.call(changed, 'collaborator_id')) {
            const collaborator = collaborators.find((row) => row.id === changed.collaborator_id)
            form.setFieldValue('percent', collaborator?.commission_percent ?? undefined)
            form.setFieldValue('customer_profile_id', undefined)
          }
        }}
      >
        <Form.Item label="NgÆ°á»i nháº­n" required>
          <Select
            value={payeeType}
            onChange={(v) => setPayeeType(v)}
            options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
        {payeeType === 'STAFF' && (
          <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chá»n nhÃ¢n viÃªn' }]}>
            <Select showSearch optionFilterProp="label" loading={usersQuery.isLoading} placeholder="Chá»n KTV"
              options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
          </Form.Item>
        )}
        {payeeType === 'COLLABORATOR' && (
          <>
            <Form.Item name="collaborator_id" label="Cá»™ng tÃ¡c viÃªn" rules={[{ required: true, message: 'Chá»n cá»™ng tÃ¡c viÃªn' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                loading={collaboratorsQuery.isLoading}
                placeholder="Chá»n cá»™ng tÃ¡c viÃªn"
                options={collaborators.map((row) => ({
                  value: row.id,
                  label: `${row.name} Â· ${row.referral_code}${row.commission_percent != null ? ` Â· ${row.commission_percent}% tham kháº£o` : ''}`,
                }))}
              />
            </Form.Item>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} title="% hoa há»“ng cá»§a CTV chá»‰ lÃ  má»©c tham kháº£o khi nháº­p tay; sá»‘ tiá»n váº«n do báº¡n nháº­p." />
            <Form.Item name="customer_profile_id" label="KhÃ¡ch Ä‘Æ°á»£c giá»›i thiá»‡u (náº¿u cÃ³)" extra="Gáº¯n bÃºt toÃ¡n vá»›i khÃ¡ch Ä‘á»ƒ hiá»‡n trong lá»‹ch sá»­ giá»›i thiá»‡u.">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={!selectedCollaboratorId}
                loading={referralsQuery.isLoading}
                placeholder="Chá»n khÃ¡ch Ä‘Æ°á»£c CTV nÃ y giá»›i thiá»‡u"
                options={collaboratorReferrals.map((row) => ({
                  value: row.referred_profile_id,
                  label: [row.referred_profile?.full_name, row.referred_profile?.phone].filter(Boolean).join(' Â· ') || row.referred_profile_id,
                }))}
              />
            </Form.Item>
          </>
        )}
        {payeeType === 'CUSTOMER_REFERRER' && (
          <Form.Item name="referrer_profile_id" label="ID há»“ sÆ¡ khÃ¡ch giá»›i thiá»‡u" rules={[{ required: true, message: 'Nháº­p ID há»“ sÆ¡ khÃ¡ch' }]}>
            <Input placeholder="UUID cá»§a há»“ sÆ¡ khÃ¡ch" />
          </Form.Item>
        )}
        <Form.Item name="customer_treatment_id" label="HÃ³a Ä‘Æ¡n / gÃ³i Ä‘iá»u trá»‹ liÃªn quan">
          <Select allowClear showSearch optionFilterProp="label" loading={treatmentsQuery.isLoading} placeholder="TÃ¹y chá»n: chá»n gÃ³i Ä‘á»ƒ liÃªn káº¿t bÃºt toÃ¡n"
            options={treatments.map((treatment) => ({
              value: treatment.id,
              label: [treatment.customer_profile?.full_name, treatment.customer_profile?.phone, treatment.package_type?.name || (treatment.package_snapshot as Record<string, unknown> | undefined)?.name]
                .filter(Boolean).join(' Â· ') || treatment.id,
            }))} />
          </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="branch_id" label="Chi nhÃ¡nh" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" loading={branchesQuery.isLoading} placeholder="Tá»± láº¥y theo buá»•i/gÃ³i náº¿u cÃ³"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
          </Form.Item>
          <Form.Item name="session_id" label="Buá»•i liÃªn quan" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" disabled={!selectedTreatmentId} loading={sessionsQuery.isLoading}
              placeholder={selectedTreatmentId ? 'Chá»n buá»•i Ä‘iá»u trá»‹' : 'Chá»n gÃ³i Ä‘iá»u trá»‹ trÆ°á»›c'}
              options={sessions.map((session) => ({ value: session.id, label: `Buá»•i ${session.session_no} Â· ${session.status ?? 'â€”'}` }))} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item
            name="amount" label="Sá»‘ tiá»n hoa há»“ng (â‚«)" style={{ flex: 1 }}
            rules={[{
              validator: (_rule, value) => {
                const base = form.getFieldValue('base_amount')
                const percent = form.getFieldValue('percent')
                if ((value != null && Number(value) > 0) || (base != null && percent != null && Number(base) >= 0 && Number(percent) > 0)) return Promise.resolve()
                return Promise.reject(new Error('Nháº­p sá»‘ tiá»n hoáº·c Ä‘á»§ doanh sá»‘ vÃ  tá»· lá»‡ %'))
              },
            }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="period_date" label="Ká»³" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="base_amount" label="Doanh sá»‘ tham chiáº¿u (â‚«)" style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="percent" label="Tá»· lá»‡ (%)" style={{ flex: 1 }}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="reason" label="LÃ½ do / ghi chÃº" rules={[{ required: true, message: 'Nháº­p lÃ½ do' }]}>
          <Input.TextArea rows={2} placeholder="VD: Hoa há»“ng bÃ¡n gÃ³i thÃ¢n thiáº¿t thÃ¡ng 10" />
        </Form.Item>
      </Form>
    </Modal>
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
      title: 'Ká»³', dataIndex: 'period', width: 240,
      render: (v: string) => {
        const start = new Date(v)
        if (groupBy === 'day') return start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })
        if (groupBy === 'week') {
          const end = new Date(start)
          end.setDate(end.getDate() + 6)
          const dayMonth = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'short' })
          return `Tuáº§n ${dayMonth.format(start)} â€“ ${dayMonth.format(end)} ${end.getFullYear()}`
        }
        return start.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })
      },
    },
    {
      title: 'NgÆ°á»i nháº­n', key: 'payee', width: 240,
      render: (_v, row) => {
        const id = row.payee_id
        const name = row.payee_type === 'STAFF' ? staffNameById.get(id ?? '')
          : row.payee_type === 'COLLABORATOR' ? collaboratorNameById.get(id ?? '')
            : undefined
        return <Space><Tag>{row.payee_type ? PAYEE_LABEL[row.payee_type] : 'â€”'}</Tag><span>{name || id || 'â€”'}</span></Space>
      },
    },
    { title: 'Sá»‘ bÃºt toÃ¡n', dataIndex: 'entries', width: 120, align: 'right', render: (v: string | number) => Number(v).toLocaleString('vi-VN') },
    {
      title: 'Tá»•ng hoa há»“ng', dataIndex: 'total_amount', width: 180, align: 'right',
      render: (v: string | number) => <span style={{ fontWeight: 500 }}>{formatVnd(Number(v))}</span>,
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', marginBottom: 16 }} wrap>
        <Select
          value={groupBy} style={{ width: 140 }}
          options={[{ value: 'day', label: 'Theo ngÃ y' }, { value: 'week', label: 'Theo tuáº§n' }, { value: 'month', label: 'Theo thÃ¡ng' }]}
          onChange={(v) => { setFilters((current) => ({ ...current, group_by: v })); setPage(1) }}
        />
        <Select
          allowClear placeholder="NgÆ°á»i nháº­n" style={{ width: 170 }}
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
          <Select allowClear showSearch optionFilterProp="label" placeholder="Cá»™ng tÃ¡c viÃªn" style={{ width: 210 }} loading={collaboratorsQuery.isLoading}
            value={filters.collaborator_id} options={collaborators.map((row) => ({ value: row.id, label: row.name }))}
            onChange={(v) => { setFilters((current) => ({ ...current, collaborator_id: v })); setPage(1) }} />
        )}
        <Select allowClear showSearch optionFilterProp="label" placeholder="Chi nhÃ¡nh" style={{ width: 180 }} loading={branchesQuery.isLoading}
          value={filters.branch_id} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          onChange={(v) => { setFilters((current) => ({ ...current, branch_id: v })); setPage(1) }} />
        <DatePicker.RangePicker onChange={(dates) => { setFilters((current) => ({
          ...current,
          date_from: dates?.[0]?.format('YYYY-MM-DD'),
          date_to: dates?.[1]?.format('YYYY-MM-DD'),
        })); setPage(1) }} />
        <Button icon={<ReloadOutlined />} onClick={() => void summaryQuery.refetch()}>Táº£i láº¡i</Button>
      </Space>
      <Table<CommissionSummaryRow & { payee_id?: string }>
        rowKey={(r) => `${r.period}-${r.payee_type}-${r.payee_id ?? 'unknown'}`}
        loading={summaryQuery.isLoading} dataSource={paginateRows(rows, page, 15)} columns={columns}
        pagination={false}
      />
      <ListPagination page={page} limit={15} total={rows.length} onChange={setPage} noun="bÃºt toÃ¡n tá»•ng há»£p" />
    </>
  )
}
