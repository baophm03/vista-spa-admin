import ResponsiveTable from '@/components/base/ResponsiveTable'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input, Modal, Select, Space, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import dayjs from 'dayjs'
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { errorMessage, pickData } from '@/api/helpers'
import {
  getGetCommissionEntriesAdminQueryKey,
  useDeleteCommissionEntriesIdAdmin,
  useGetCommissionEntriesAdmin,
  usePostCommissionEntriesAdmin,
  usePutCommissionEntriesIdAdmin,
  usePutCommissionEntriesIdApproveAdmin,
  usePutCommissionEntriesIdCancelAdmin,
  usePutCommissionEntriesIdRejectAdmin,
} from '@/api/endpoints/commissions'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import type { Branch, CommissionEntry, User } from '@/api/models'
import type { UserWithRoleAssignments } from '@/utils/userRoles'
import CommissionEntryModal from './components/CommissionEntryModal'

type EntryRow = CommissionEntry & {
  staff?: { id?: string; zalo_name?: string | null; email?: string | null } | null
  branch?: { id?: string; name?: string | null } | null
  payment?: { id?: string; amount?: number | null; method?: string | null; paid_at?: string | null; voided_at?: string | null } | null
  session?: {
    id?: string
    session_no?: number
    session_value?: number | null
    is_warranty?: boolean
    customer_treatment?: {
      id?: string
      package_snapshot?: Record<string, unknown> | null
      customer_profile?: { id?: string; full_name?: string | null; zalo_name?: string | null } | null
    } | null
  } | null
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'orange' },
  APPROVED: { label: 'Đã duyệt', color: 'green' },
  REJECTED: { label: 'Đã từ chối', color: 'red' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

const STATUS_FILTER_OPTIONS = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

type ReasonAction = { kind: 'reject' | 'cancel'; row: EntryRow }

function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

const ruleRateText = (snapshot?: Record<string, unknown> | null): string => {
  if (!snapshot) return '—'
  const fixed = snapshot.fixed_amount
  if (fixed != null && Number(fixed) > 0) return `${formatVnd(Number(fixed))}/lượt`
  const percent = snapshot.percent
  return percent != null ? `${Number(percent)}%` : '—'
}

const snapshotText = (snapshot?: Record<string, unknown> | null): string | undefined => {
  const name = snapshot?.name
  return typeof name === 'string' && name.trim() ? name : undefined
}

export default function CommissionEntriesPanel() {
  const [page, setPage] = useState(1)
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [reasonTarget, setReasonTarget] = useState<ReasonAction | null>(null)
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<{ id: string; amount?: number | null; status?: string | null } | null>(null)
  const [reasonForm] = Form.useForm()
  const [entryForm] = Form.useForm()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'COMMISSION')
  const canDelete = ability.can('DELETE', 'COMMISSION')
  const branchesQuery = useGetBranchesAdmin()
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]
  const staffsQuery = useGetUsersAdmin({ currentPage: 1, pageSize: 200, has_role: true, scope: 'all' })
  const staffOptions = useMemo(() => {
    const users = (pickData<{ rows?: User[] } | undefined>(staffsQuery.data)?.rows ?? []) as (User & UserWithRoleAssignments)[]
    return users.map((u) => ({
      value: u.id,
      label: `${u.full_name || u.zalo_name || '—'} · ${u.phone_number || u.email || u.id.slice(0, 8)}`,
    }))
  }, [staffsQuery.data])

  const entriesQuery = useGetCommissionEntriesAdmin({
    page,
    limit: 10,
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    ...(staffFilter ? { staff_id: staffFilter } : {}),
    ...(statusFilter ? { status: statusFilter as never } : {}),
  })
  const rows = (pickData<EntryRow[] | undefined>(entriesQuery.data) ?? []) as EntryRow[]
  const total = (entriesQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rows.length
  const stats = (entriesQuery.data as unknown as { meta?: { stats?: { status: string; count: number; sum: number }[] } })?.meta?.stats ?? []
  const statOf = (status: string) => stats.find((s) => s.status === status)
  const pendingSum = statOf('PENDING')?.sum ?? 0
  const pendingCount = statOf('PENDING')?.count ?? 0

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCommissionEntriesAdminQueryKey() })
  }

  const approveMutation = usePutCommissionEntriesIdApproveAdmin()
  const rejectMutation = usePutCommissionEntriesIdRejectAdmin()
  const cancelMutation = usePutCommissionEntriesIdCancelAdmin()
  const createMutation = usePostCommissionEntriesAdmin()
  const editMutation = usePutCommissionEntriesIdAdmin()
  const deleteMutation = useDeleteCommissionEntriesIdAdmin()
  const reasonSubmitting = rejectMutation.isPending || cancelMutation.isPending

  const askApprove = (row: EntryRow) => {
    Modal.confirm({
      title: 'Duyệt hoa hồng',
      content: `Xác nhận duyệt hoa hồng ${formatVnd(row.amount)} cho "${row.staff?.zalo_name || '—'}"? Hoa hồng sẽ chính thức được cộng vào số dư của họ.`,
      okText: 'Duyệt',
      okButtonProps: { icon: <CheckOutlined /> },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await approveMutation.mutateAsync({ id: row.id })
          message.success('Đã duyệt hoa hồng')
          await invalidate()
        } catch (err) {
          message.error(errorMessage(err))
        }
      },
    })
  }

  const submitReason = async () => {
    if (!reasonTarget) return
    try {
      const values = await reasonForm.validateFields()
      if (reasonTarget.kind === 'reject') {
        await rejectMutation.mutateAsync({ id: reasonTarget.row.id, data: { reject_reason: values.reason } })
        message.success('Đã từ chối bản ghi hoa hồng')
      } else {
        await cancelMutation.mutateAsync({ id: reasonTarget.row.id, data: { cancel_reason: values.reason } })
        message.success('Đã hủy bản ghi hoa hồng')
      }
      setReasonTarget(null)
      await invalidate()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const packageLabel = (row: EntryRow): string => {
    const snapshot = row.session?.customer_treatment?.package_snapshot
    const name = snapshot && typeof snapshot.name === 'string' && snapshot.name.trim() ? snapshot.name : undefined
    return name ?? row.customer_treatment_id?.slice(0, 8).toUpperCase() ?? '—'
  }

  const submitEntryModal = async () => {
    try {
      const values = await entryForm.validateFields()
      if (editingEntry) {
        await editMutation.mutateAsync({ id: editingEntry.id, data: { amount: values.amount } })
        message.success('Đã cập nhật số tiền hoa hồng')
      } else {
        await createMutation.mutateAsync({
          data: {
            staff_id: values.staff_id,
            branch_id: values.branch_id,
            amount: values.amount,
            customer_treatment_id: values.customer_treatment_id || undefined,
            period_date: values.period_date ? (values.period_date as dayjs.Dayjs).format('YYYY-MM-DD') : undefined,
            note: values.note?.trim() || undefined,
          } as never,
        })
        message.success('Đã thêm hoa hồng thủ công (chờ duyệt)')
      }
      setEntryModalOpen(false)
      setEditingEntry(null)
      await invalidate()
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const askDelete = (row: EntryRow) => {
    Modal.confirm({
      title: 'Xóa bản ghi hoa hồng?',
      content: `Xóa hẳn hoa hồng ${formatVnd(row.amount)} của "${row.staff?.zalo_name || '—'}"${
        row.status === 'APPROVED' ? ' — bản ghi ĐÃ DUYỆT sẽ bị trừ khỏi số dư' : ''
      }. Không thể hoàn tác.`,
      okText: 'Xóa',
      okButtonProps: { danger: true, icon: <DeleteOutlined /> },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync({ id: row.id })
          message.success('Đã xóa bản ghi hoa hồng')
          await invalidate()
        } catch (err) {
          message.error(errorMessage(err))
        }
      },
    })
  }

  const customerLabel = (row: EntryRow): string => {
    const profile = row.session?.customer_treatment?.customer_profile
    return profile?.full_name || profile?.zalo_name || 'Khách hàng'
  }

  const columns: TableColumnsType<EntryRow> = [
    {
      key: 'staff', title: 'Người nhận', width: 200,
      render: (_v, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{row.staff?.zalo_name || '—'}</div>
          {row.staff?.email && <div style={{ fontSize: 12, opacity: 0.65 }}>{row.staff.email}</div>}
        </div>
      ),
    },
    { key: 'branch', title: 'Cơ sở', width: 130, render: (_v, row) => row.branch?.name || '—' },
    {
      key: 'session', title: 'Nguồn phát sinh', ellipsis: true,
      render: (_v, row) => {
        const label = row.session
          ? `Buổi #${row.session.session_no ?? '—'} · ${packageLabel(row)}`
          : row.payment
            ? `Thanh toán ${formatVnd(row.payment.amount)}${row.payment.voided_at ? ' (đã hủy)' : ''} · ${packageLabel(row)}`
            : `Thủ công${row.note ? ` · ${row.note}` : ''}`
        const treatmentId = row.customer_treatment_id
        if (!treatmentId) return <span>{label}</span>
        return (
          <Typography.Link
            onClick={(event) => {
              event.stopPropagation()
              navigate(`/treatment-customers?treatment_id=${encodeURIComponent(treatmentId)}`)
            }}
          >
            {label}
          </Typography.Link>
        )
      },
    },
    { key: 'customer', title: 'Khách hàng', width: 160, render: (_v, row) => customerLabel(row) },
    { key: 'base', title: 'Tiền nền', width: 120, align: 'right', render: (_v, row) => formatVnd(row.base_amount) },
    {
      key: 'rule', title: 'Quy tắc', width: 220, ellipsis: true,
      render: (_v, row) => (
        <div>
          <div>{snapshotText(row.rule_snapshot) ?? row.rule_id?.slice(0, 8).toUpperCase() ?? '—'}</div>
          <div style={{ fontSize: 12, opacity: 0.65 }}>{ruleRateText(row.rule_snapshot)}</div>
        </div>
      ),
    },
    {
      key: 'amount', title: 'Hoa hồng', width: 130, align: 'right',
      render: (_v, row) => <span style={{ fontWeight: 600 }}>{formatVnd(row.amount)}</span>,
    },
    {
      key: 'period', title: 'Ngày tính', width: 110,
      render: (_v, row) => (row.period_date ? String(row.period_date).slice(0, 10).split('-').reverse().join('/') : '—'),
    },
    {
      key: 'status', title: 'Trạng thái', width: 110,
      render: (_v, row) => {
        const meta = STATUS_META[row.status]
        return <Tag color={meta?.color}>{meta?.label ?? row.status}</Tag>
      },
    },
    {
      key: 'actions', title: 'Thao tác', align: 'center', width: 200, fixed: 'right',
      render: (_v, row) => {
        const canEdit = canUpdate && ['PENDING', 'APPROVED'].includes(row.status)
        const menuItems = [
          ...(canEdit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa số tiền' }] : []),
          ...(canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
        ]
        return (
          <Space size={4} wrap>
            {row.status === 'PENDING' && canUpdate && (
              <>
                <Button size="small" type="primary" onClick={() => askApprove(row)}>Duyệt</Button>
                <Button size="small" danger icon={<CloseOutlined />} onClick={() => { setReasonTarget({ kind: 'reject', row }); reasonForm.resetFields() }}>
                  Từ chối
                </Button>
              </>
            )}
            {row.status === 'APPROVED' && canUpdate && (
              <Button size="small" icon={<StopOutlined />} onClick={() => { setReasonTarget({ kind: 'cancel', row }); reasonForm.resetFields() }}>
                Hủy
              </Button>
            )}
            {menuItems.length > 0 && (
              <RowActionsMenu
                items={menuItems}
                onSelect={(key) => {
                  if (key === 'edit') {
                    setEditingEntry({ id: row.id, amount: row.amount, status: row.status })
                    setEntryModalOpen(true)
                  } else if (key === 'delete') {
                    askDelete(row)
                  }
                }}
              />
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <>
      <Space className="mb-4! w-full! justify-end" wrap>
        <Select
          showSearch optionFilterProp="label" allowClear
          className="w-[220px]!"
          placeholder="Cơ sở"
          loading={branchesQuery.isLoading}
          value={branchFilter}
          onChange={(v) => { setBranchFilter(v); setPage(1) }}
          options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
        />
        <Select
          showSearch optionFilterProp="label" allowClear
          className="w-[220px]!"
          placeholder="Người nhận"
          loading={staffsQuery.isLoading}
          value={staffFilter}
          onChange={(v) => { setStaffFilter(v); setPage(1) }}
          options={staffOptions}
        />
        <Select
          allowClear className="w-[150px]!"
          placeholder="Trạng thái"
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1) }}
          options={STATUS_FILTER_OPTIONS}
        />
        <Can I="CREATE" a="COMMISSION">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingEntry(null); entryForm.setFieldsValue({}); setEntryModalOpen(true) }}
          >
            Thêm thủ công
          </Button>
        </Can>
      </Space>

      {entriesQuery.isError && (
        <Alert
          className="mb-4" type="error" showIcon
          message="Không tải được sổ hoa hồng"
          description={errorMessage(entriesQuery.error)}
          action={<Button size="small" onClick={() => void entriesQuery.refetch()}>Thử lại</Button>}
        />
      )}
      {pendingCount > 0 && statusFilter === undefined && (
        <Alert className="mb-4" type="warning" showIcon message={`Có ${pendingCount} bản ghi hoa hồng chờ duyệt (tổng ${formatVnd(pendingSum)}).`} />
      )}

      <ResponsiveTable<EntryRow>
        rowKey="id" loading={entriesQuery.isLoading} dataSource={rows} columns={columns}
        scroll={{ x: 1300 }}
        pagination={false}
      />
      <ListPagination page={page} limit={10} total={total} onChange={setPage} noun="bản ghi hoa hồng" />

      <Modal
        title={reasonTarget?.kind === 'reject' ? 'Từ chối hoa hồng' : 'Hủy hoa hồng'}
        open={!!reasonTarget}
        onCancel={() => setReasonTarget(null)}
        onOk={() => void submitReason()}
        okText={reasonTarget?.kind === 'reject' ? 'Từ chối' : 'Hủy bản ghi'}
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
        confirmLoading={reasonSubmitting}
      >
        <Form form={reasonForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="reason"
            label={reasonTarget?.kind === 'reject' ? 'Lý do từ chối' : 'Lý do hủy'}
            rules={[{ required: true, message: 'Bắt buộc nhập lý do' }]}
          >
            <Input.TextArea rows={3} maxLength={1000} placeholder={reasonTarget?.kind === 'reject' ? 'Nhập lý do từ chối cụ thể' : 'Nhập lý do hủy cụ thể'} />
          </Form.Item>
        </Form>
      </Modal>

      <CommissionEntryModal
        form={entryForm}
        open={entryModalOpen}
        editing={editingEntry}
        branches={branches}
        defaultBranchId={branchFilter}
        submitting={createMutation.isPending || editMutation.isPending}
        onCancel={() => { setEntryModalOpen(false); setEditingEntry(null) }}
        onOk={() => void submitEntryModal()}
      />
    </>
  )
}
