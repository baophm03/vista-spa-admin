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
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can } from '@casl/react'
import PageTitle from '@/components/base/PageTitle'
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
  COLLABORATOR: 'Cộng tác viên',
  CUSTOMER_REFERRER: 'Khách giới thiệu',
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang hiệu lực', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  VOID: { label: 'Đã hủy (VOID)', color: 'red' },
}

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
            <PageTitle>Hoa hồng</PageTitle>
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
  const [filters, setFilters] = useState<GetCommissionsParams>({})
  const [page, setPage] = useState(1)
  const [manualOpen, setManualOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CommissionEntry | null>(null)
  const [editForm] = Form.useForm()
  const [voidTarget, setVoidTarget] = useState<CommissionEntry | null>(null)
  const [voidForm] = Form.useForm()
  const queryClient = useQueryClient()
  const branchesQuery = useGetBranches()
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const branchNameById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches])

  const listQuery = useGetCommissions({ ...filters, page, limit: 20 })
  const rows = useMemo(() => pickData<CommissionEntry[]>(listQuery.data) ?? [], [listQuery.data])
  const meta = pickMeta(listQuery.data)

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCommissionsQueryKey() })
    await queryClient.invalidateQueries({ queryKey: getGetCommissionsSummaryQueryKey() })
  }

  const updateMutation = usePutCommissionsId({ mutation: { onSuccess: invalidate } })
  const voidMutation = usePostCommissionsIdVoid({ mutation: { onSuccess: invalidate } })

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
    { title: 'Ngày', dataIndex: 'period_date', width: 110 },
    {
      title: 'Người nhận', key: 'payee', width: 160,
      render: (_v, row) => (
        <Space size={4}>
          {row.payee_type && <Tag>{PAYEE_LABEL[row.payee_type] ?? row.payee_type}</Tag>}
          <Typography.Text code>{row.payee_user_id || row.collaborator_id || row.referrer_profile_id || '—'}</Typography.Text>
        </Space>
      ),
    },
    { title: 'Nguồn', dataIndex: 'source_type', width: 100, render: (v?: string) => ({ PAYMENT: 'Thanh toán', SESSION: 'Buổi điều trị', MANUAL: 'Nhập tay' })[v ?? ''] ?? v ?? '—' },
    { title: 'Chi nhánh', dataIndex: 'branch_id', width: 140, render: (v?: string) => (v ? branchNameById.get(v) ?? v : '—') },
    { title: 'Chế độ', dataIndex: 'mode', width: 90, render: (v?: string) => <Tag color={v === 'AUTO' ? 'blue' : 'orange'}>{v === 'AUTO' ? 'Tự động' : 'Nhập tay'}</Tag> },
    {
      title: 'Căn tính', key: 'base', width: 130, align: 'right',
      render: (_v, row) => (row.base_amount != null ? formatVnd(row.base_amount) : '—'),
    },
    { title: '%', dataIndex: 'percent', width: 70, align: 'right', render: (v?: number | null) => (v != null ? `${v}%` : '—') },
    { title: 'Số tiền', dataIndex: 'amount', width: 130, align: 'right', render: (v: number) => <span style={{ fontWeight: 500 }}>{formatVnd(v)}</span> },
    { title: 'Lý do', dataIndex: 'reason', ellipsis: true },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 120,
      render: (v?: string) => {
        const meta = STATUS_META[v ?? 'ACTIVE']
        return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Tag>{v}</Tag>
      },
    },
    {
      title: 'Thao tác', key: 'actions', width: 150,
      render: (_v, row) =>
        row.status === 'VOID' ? null : (
          <Space>
            <Can I="UPDATE" a="COMMISSION">
              <Button
                size="small"
                onClick={() => {
                  setEditTarget(row)
                  editForm.setFieldsValue({ amount: row.amount, percent: row.percent ?? undefined })
                }}
              >
                Sửa
              </Button>
            </Can>
            <Can I="VOID" a="COMMISSION">
              <Button
                size="small"
                danger
                onClick={() => {
                  setVoidTarget(row)
                  voidForm.resetFields()
                }}
              >
                Hủy
              </Button>
            </Can>
          </Space>
        ),
    },
  ]

  return (
    <>
      <Space style={{ width: '100%', justifyContent: 'flex-end', marginBottom: 16 }} wrap>
        <Select
          allowClear placeholder="Người nhận" style={{ width: 170 }}
          options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))}
          value={filters.payee_type}
          onChange={(v) => { setFilters((f) => ({ ...f, payee_type: v })); setPage(1) }}
        />
        <Select
          allowClear placeholder="Chế độ" style={{ width: 120 }}
          options={[{ value: 'AUTO', label: 'Tự động' }, { value: 'MANUAL', label: 'Nhập tay' }]}
          value={filters.mode}
          onChange={(v) => { setFilters((f) => ({ ...f, mode: v })); setPage(1) }}
        />
        <Select
          allowClear placeholder="Trạng thái" style={{ width: 150 }}
          options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
          value={filters.status}
          onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1) }}
        />
        <Select
          allowClear showSearch optionFilterProp="label" placeholder="Chi nhánh" style={{ width: 180 }}
          loading={branchesQuery.isLoading}
          options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          value={filters.branch_id}
          onChange={(v) => { setFilters((f) => ({ ...f, branch_id: v })); setPage(1) }}
        />
        <DatePicker.RangePicker
          onChange={(dates) => {
            setFilters((f) => ({
              ...f,
              date_from: dates?.[0]?.format('YYYY-MM-DD'),
              date_to: dates?.[1]?.format('YYYY-MM-DD'),
            }))
            setPage(1)
          }}
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
        rowKey="id" loading={listQuery.isLoading} dataSource={rows} columns={columns}
        pagination={{
          current: page, pageSize: 20, total: meta?.total,
          showTotal: (t) => `Tổng ${t} bút toán`,
          onChange: (p) => setPage(p),
        }}
      />
      <ManualEntryModal open={manualOpen} onClose={() => setManualOpen(false)} onDone={invalidate} />
      <Modal
        title="Sửa bút toán hoa hồng"
        open={!!editTarget}
        onCancel={() => setEditTarget(null)}
        onOk={() => void submitEdit()}
        confirmLoading={updateMutation.isPending}
        okText="Lưu" cancelText="Hủy"
      >
        {editTarget?.mode === 'AUTO' && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Bút toán tự động sẽ chuyển thành NHẬP TAY vĩnh viễn sau khi sửa (không còn tính lại tự động)." />
        )}
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="amount" label="Số tiền (₫)" style={{ flex: 1 }} rules={[{ required: true, message: 'Nhập số tiền' }]}>
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="percent" label="% hoa hồng" style={{ flex: 1 }}>
              <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="reason" label="Lý do sửa" rules={[{ required: true, message: 'Nhập lý do' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Hủy bút toán hoa hồng"
        open={!!voidTarget}
        onCancel={() => setVoidTarget(null)}
        onOk={() => void submitVoid()}
        confirmLoading={voidMutation.isPending}
        okText="Hủy bút toán" okButtonProps={{ danger: true }} cancelText="Đóng"
      >
        <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Bút toán không bị xóa, chỉ đánh dấu VOID và loại khỏi tổng hợp." />
        <Form form={voidForm} layout="vertical">
          <Form.Item name="void_reason" label="Lý do hủy" rules={[{ required: true, message: 'Nhập lý do hủy' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
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
  const collaborators = useMemo(() => pickData<Collaborator[]>(collaboratorsQuery.data) ?? [], [collaboratorsQuery.data])
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
      message.success('Đã nhập bút toán hoa hồng')
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
      title="Nhập hoa hồng tay"
      open={open}
      onCancel={onClose}
      onOk={() => void submit()}
      confirmLoading={createMutation.isPending}
      okText="Lưu" cancelText="Hủy"
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
        <Form.Item label="Người nhận" required>
          <Select
            value={payeeType}
            onChange={(v) => setPayeeType(v)}
            options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
        {payeeType === 'STAFF' && (
          <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chọn nhân viên' }]}>
            <Select showSearch optionFilterProp="label" loading={usersQuery.isLoading} placeholder="Chọn KTV"
              options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
          </Form.Item>
        )}
        {payeeType === 'COLLABORATOR' && (
          <>
            <Form.Item name="collaborator_id" label="Cộng tác viên" rules={[{ required: true, message: 'Chọn cộng tác viên' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                loading={collaboratorsQuery.isLoading}
                placeholder="Chọn cộng tác viên"
                options={collaborators.map((row) => ({
                  value: row.id,
                  label: `${row.name} · ${row.referral_code}${row.commission_percent != null ? ` · ${row.commission_percent}% tham khảo` : ''}`,
                }))}
              />
            </Form.Item>
            <Alert type="info" showIcon style={{ marginBottom: 16 }} title="% hoa hồng của CTV chỉ là mức tham khảo khi nhập tay; số tiền vẫn do bạn nhập." />
            <Form.Item name="customer_profile_id" label="Khách được giới thiệu (nếu có)" extra="Gắn bút toán với khách để hiện trong lịch sử giới thiệu.">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={!selectedCollaboratorId}
                loading={referralsQuery.isLoading}
                placeholder="Chọn khách được CTV này giới thiệu"
                options={collaboratorReferrals.map((row) => ({
                  value: row.referred_profile_id,
                  label: [row.referred_profile?.full_name, row.referred_profile?.phone].filter(Boolean).join(' · ') || row.referred_profile_id,
                }))}
              />
            </Form.Item>
          </>
        )}
        {payeeType === 'CUSTOMER_REFERRER' && (
          <Form.Item name="referrer_profile_id" label="ID hồ sơ khách giới thiệu" rules={[{ required: true, message: 'Nhập ID hồ sơ khách' }]}>
            <Input placeholder="UUID của hồ sơ khách" />
          </Form.Item>
        )}
        <Form.Item name="customer_treatment_id" label="Hóa đơn / gói điều trị liên quan">
          <Select allowClear showSearch optionFilterProp="label" loading={treatmentsQuery.isLoading} placeholder="Tùy chọn: chọn gói để liên kết bút toán"
            options={treatments.map((treatment) => ({
              value: treatment.id,
              label: [treatment.customer_profile?.full_name, treatment.customer_profile?.phone, treatment.package_type?.name || (treatment.package_snapshot as Record<string, unknown> | undefined)?.name]
                .filter(Boolean).join(' · ') || treatment.id,
            }))} />
          </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="branch_id" label="Chi nhánh" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" loading={branchesQuery.isLoading} placeholder="Tự lấy theo buổi/gói nếu có"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
          </Form.Item>
          <Form.Item name="session_id" label="Buổi liên quan" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" disabled={!selectedTreatmentId} loading={sessionsQuery.isLoading}
              placeholder={selectedTreatmentId ? 'Chọn buổi điều trị' : 'Chọn gói điều trị trước'}
              options={sessions.map((session) => ({ value: session.id, label: `Buổi ${session.session_no} · ${session.status ?? '—'}` }))} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item
            name="amount" label="Số tiền hoa hồng (₫)" style={{ flex: 1 }}
            rules={[{
              validator: (_rule, value) => {
                const base = form.getFieldValue('base_amount')
                const percent = form.getFieldValue('percent')
                if ((value != null && Number(value) > 0) || (base != null && percent != null && Number(base) >= 0 && Number(percent) > 0)) return Promise.resolve()
                return Promise.reject(new Error('Nhập số tiền hoặc đủ doanh số và tỷ lệ %'))
              },
            }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="period_date" label="Kỳ" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="base_amount" label="Doanh số tham chiếu (₫)" style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="percent" label="Tỷ lệ (%)" style={{ flex: 1 }}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="reason" label="Lý do / ghi chú" rules={[{ required: true, message: 'Nhập lý do' }]}>
          <Input.TextArea rows={2} placeholder="VD: Hoa hồng bán gói thân thiết tháng 10" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

function SummaryTab() {
  const [filters, setFilters] = useState<GetCommissionsSummaryParams>({ group_by: 'month' })
  const summaryQuery = useGetCommissionsSummary(filters)
  const rawRows = useMemo(() => pickData<CommissionSummaryRow[]>(summaryQuery.data) ?? [], [summaryQuery.data])
  const rows = rawRows as Array<CommissionSummaryRow & { payee_id?: string }>
  const branchesQuery = useGetBranches()
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const collaboratorsQuery = useGetCollaborators({})
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? []) as User[]
  const collaborators = useMemo(() => pickData<Collaborator[]>(collaboratorsQuery.data) ?? [], [collaboratorsQuery.data])
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
          onChange={(v) => setFilters((current) => ({ ...current, group_by: v }))}
        />
        <Select
          allowClear placeholder="Người nhận" style={{ width: 170 }}
          options={Object.entries(PAYEE_LABEL).map(([value, label]) => ({ value, label }))}
          value={filters.payee_type}
          onChange={(v) => setFilters((current) => ({ ...current, payee_type: v, staff_id: undefined, collaborator_id: undefined }))}
        />
        {filters.payee_type === 'STAFF' && (
          <Select allowClear showSearch optionFilterProp="label" placeholder="KTV" style={{ width: 210 }} loading={usersQuery.isLoading}
            value={filters.staff_id} options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))}
            onChange={(v) => setFilters((current) => ({ ...current, staff_id: v }))} />
        )}
        {filters.payee_type === 'COLLABORATOR' && (
          <Select allowClear showSearch optionFilterProp="label" placeholder="Cộng tác viên" style={{ width: 210 }} loading={collaboratorsQuery.isLoading}
            value={filters.collaborator_id} options={collaborators.map((row) => ({ value: row.id, label: row.name }))}
            onChange={(v) => setFilters((current) => ({ ...current, collaborator_id: v }))} />
        )}
        <Select allowClear showSearch optionFilterProp="label" placeholder="Chi nhánh" style={{ width: 180 }} loading={branchesQuery.isLoading}
          value={filters.branch_id} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          onChange={(v) => setFilters((current) => ({ ...current, branch_id: v }))} />
        <DatePicker.RangePicker onChange={(dates) => setFilters((current) => ({
          ...current,
          date_from: dates?.[0]?.format('YYYY-MM-DD'),
          date_to: dates?.[1]?.format('YYYY-MM-DD'),
        }))} />
        <Button icon={<ReloadOutlined />} onClick={() => void summaryQuery.refetch()}>Tải lại</Button>
      </Space>
      <Table<CommissionSummaryRow & { payee_id?: string }>
        rowKey={(r) => `${r.period}-${r.payee_type}-${r.payee_id ?? 'unknown'}`}
        loading={summaryQuery.isLoading} dataSource={rows} columns={columns}
        pagination={{ pageSize: 15 }}
      />
    </>
  )
}
