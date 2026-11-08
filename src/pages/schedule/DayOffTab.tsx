import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { Alert, Badge, Button, Checkbox, DatePicker, Divider, Form, Modal, Popconfirm, Popover, Select, Space, Table, Tag, Typography, message } from 'antd'
import { ClearOutlined, FilterOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import ListPagination from '@/components/base/ListPagination'
import ToolbarRow from '@/components/base/ToolbarRow'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'
import {
  deleteStaffDaysOffId,
  getGetStaffDaysOffQueryKey,
  postStaffDaysOff,
  putStaffDaysOffIdApprove,
  putStaffDaysOffIdReject,
  useGetShiftTemplates,
  useGetStaffDaysOff,
  useGetStaffScheduleDates,
} from '@/api/endpoints/staff'
import type { StaffDayOff, StaffScheduleDate, ShiftTemplate } from './types'
import type { SchedulePageData } from './types'
import { staffLabel } from './types'
import DayOffFormModal from './components/DayOffFormModal'
import DayOffRejectModal from './components/DayOffRejectModal'

interface Props extends SchedulePageData { loadingShared: boolean }
interface ApprovalResult { affected_appointments?: { id: string; appt_date: string; start_time: string; customer_profile?: { full_name?: string }; service?: { title?: string } }[] }
type DayOffColumnKey = 'staff' | 'date' | 'time' | 'reason' | 'status'
const DAY_OFF_COLUMN_OPTIONS: { label: string; value: DayOffColumnKey }[] = [
  { label: 'KTV', value: 'staff' },
  { label: 'Ngày nghỉ', value: 'date' },
  { label: 'Thời gian nghỉ', value: 'time' },
  { label: 'Lý do', value: 'reason' },
  { label: 'Trạng thái', value: 'status' },
]
const DEFAULT_VISIBLE_COLUMNS = DAY_OFF_COLUMN_OPTIONS.map((column) => column.value)
const STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'green' },
  rejected: { label: 'Từ chối', color: 'red' },
}

export default function DayOffTab({ branches, staff, access, loadingShared }: Props) {
  const queryClient = useQueryClient()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [statusFilter, setStatusFilter] = useState<string>()
  const [branchFilter, setBranchFilter] = useState<string>()
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [open, setOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<DayOffColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<DayOffColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [rejecting, setRejecting] = useState<StaffDayOff | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [page, setPage] = useState(1)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  const selectedStaff = Form.useWatch('staff_id', form)
  const selectedDate = Form.useWatch('off_date', form) as Dayjs | undefined
  const isTechnician = access.isTechnician && !access.isAdmin
  const activeFilterCount = [branchFilter, staffFilter, statusFilter, range?.[0] ?? range?.[1]].filter(Boolean).length
  const clearFilters = () => {
    filterForm.resetFields()
    setBranchFilter(undefined)
    setStaffFilter(undefined)
    setStatusFilter(undefined)
    setRange(null)
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ branch_id: branchFilter, staff_id: staffFilter, range, status: statusFilter })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setBranchFilter(typeof values.branch_id === 'string' ? values.branch_id : undefined)
    setStaffFilter(typeof values.staff_id === 'string' ? values.staff_id : undefined)
    setStatusFilter(typeof values.status === 'string' ? values.status : undefined)
    setRange((values.range as [Dayjs | null, Dayjs | null] | null | undefined) ?? null)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const daysOffParams: Record<string, unknown> = {}
  if (access.isAdmin && branchFilter) daysOffParams.branch_id = branchFilter
  if (staffFilter) daysOffParams.staff_id = staffFilter
  if (statusFilter) daysOffParams.status = statusFilter
  if (range?.[0]) daysOffParams.from_date = range[0].format('YYYY-MM-DD')
  if (range?.[1]) daysOffParams.to_date = range[1].format('YYYY-MM-DD')
  const daysOffQuery = useGetStaffDaysOff(daysOffParams as never)
  const templatesQuery = useGetShiftTemplates(branchFilter ? { branch_id: branchFilter } : {})

  const rows = (pickData<StaffDayOff[] | undefined>(daysOffQuery.data) ?? []) as StaffDayOff[]
  const templates = (pickData<ShiftTemplate[] | undefined>(templatesQuery.data) ?? []) as ShiftTemplate[]
  const error = [daysOffQuery.isError ? errorMessage(daysOffQuery.error) : '', templatesQuery.isError ? `Danh mục ca: ${errorMessage(templatesQuery.error)}` : '']
    .filter(Boolean)
    .join(' · ')

  // Gợi ý ca mà KTV được xếp trong ngày nghỉ đã chọn (lịch 100% theo ngày cụ thể)
  const schedulesQuery = useGetStaffScheduleDates(
    selectedStaff && selectedDate
      ? { staff_id: selectedStaff, from_date: selectedDate.format('YYYY-MM-DD'), to_date: selectedDate.format('YYYY-MM-DD') }
      : undefined,
    { query: { enabled: !!selectedStaff && !!selectedDate } },
  )
  const staffSchedules = (pickData<StaffScheduleDate[] | undefined>(schedulesQuery.data) ?? []) as StaffScheduleDate[]

  const scheduledTemplates = useMemo(() => {
    if (!selectedStaff || !selectedDate) return []
    const iso = selectedDate.format('YYYY-MM-DD')
    const ids = new Set(staffSchedules.filter((schedule) => schedule.work_date?.slice(0, 10) === iso && schedule.is_active !== false).map((schedule) => schedule.shift_template_id))
    return templates.filter((template) => ids.has(template.id) && template.is_active !== false)
  }, [selectedStaff, selectedDate, staffSchedules, templates])

  const openCreate = () => {
    form.resetFields()
    form.setFieldsValue({ staff_id: isTechnician ? access.currentUserId : staffFilter, off_date: dayjs() })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await postStaffDaysOff({
        staff_id: values.staff_id,
        off_date: values.off_date.format('YYYY-MM-DD'),
        shift_template_id: values.shift_template_id || null,
        reason: values.reason?.trim() || undefined,
      } as never)
      message.success('Đã gửi đăng ký ngày nghỉ')
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: getGetStaffDaysOffQueryKey() })
    } catch (err) { message.error(errorMessage(err)) }
  }

  const approve = async (row: StaffDayOff) => {
    try {
      const result = pickData<ApprovalResult>(await putStaffDaysOffIdApprove(row.id))
      message.success('Đã duyệt ngày nghỉ')
      const appointments = result?.affected_appointments ?? []
      if (appointments.length) Modal.info({
        title: `Có ${appointments.length} lịch hẹn cần xử lý`,
        width: 700,
        content: <div>
          <p>Hệ thống giữ nguyên lịch hẹn. Vui lòng xử lý từng lịch ở tab Lịch hẹn.</p>
          <Table<NonNullable<ApprovalResult["affected_appointments"]>[number]> rowKey="id" size="small" pagination={false} scroll={{ y: 260 }} dataSource={appointments} columns={[
            { title: 'Ngày', dataIndex: 'appt_date', render: (value: string) => dayjs(value).format('DD/MM/YYYY') },
            { title: 'Giờ', dataIndex: 'start_time', render: (value: string) => value?.slice(0, 5) },
            { title: 'Khách', dataIndex: ['customer_profile', 'full_name'], render: (value) => value || '—' },
            { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (value) => value || '—' },
          ]} />
        </div>,
      })
      void queryClient.invalidateQueries({ queryKey: getGetStaffDaysOffQueryKey() })
    } catch (err) { message.error(errorMessage(err)) }
  }

  const reject = async () => {
    if (!rejecting) return
    const reason = rejectReason.trim()
    if (!reason) { message.error('Nhập lý do từ chối'); return }
    try {
      await putStaffDaysOffIdReject(rejecting.id, { reason })
      message.success('Đã từ chối đăng ký nghỉ')
      setRejecting(null)
      setRejectReason('')
      void queryClient.invalidateQueries({ queryKey: getGetStaffDaysOffQueryKey() })
    } catch (err) { message.error(errorMessage(err)) }
  }

  const withdraw = async (row: StaffDayOff) => {
    try { await deleteStaffDaysOffId(row.id); message.success('Đã rút đăng ký nghỉ'); void queryClient.invalidateQueries({ queryKey: getGetStaffDaysOffQueryKey() }) }
    catch (err) { message.error(errorMessage(err)) }
  }

  const columns = [
    { title: 'KTV', dataIndex: 'staff_id', key: 'staff', render: (id: string, row: StaffDayOff) => staffLabel((row as StaffDayOff & { staff?: { id: string; zalo_name?: string; email?: string; phone_number?: string } }).staff ?? staff.find((person) => person.id === id)) },
    { title: 'Ngày nghỉ', dataIndex: 'off_date', key: 'date', render: (value: string) => dayjs(value).format('DD/MM/YYYY') },
    { title: 'Thời gian nghỉ', key: 'time', render: (_: unknown, row: StaffDayOff) => (row as StaffDayOff & { shift_template?: { name?: string } }).shift_template?.name || templates.find((template) => template.id === row.shift_template_id)?.name || 'Cả ngày' },
    { title: 'Lý do', dataIndex: 'reason', key: 'reason', render: (value?: string) => value || '—' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (value: string, row: StaffDayOff) => <Space direction="vertical" size={0}><Tag color={STATUS[value]?.color}>{STATUS[value]?.label ?? value}</Tag>{row.reject_reason && <span style={{ color: '#cf1322', fontSize: 12 }}>Lý do: {row.reject_reason}</span>}</Space> },
    { title: 'Thao tác', align: 'center' as const, key: 'actions', width: 230, render: (_: unknown, row: StaffDayOff) => <Space wrap>
      {access.isAdmin && row.status === 'pending' && <>
        <Button size="small" type="primary" onClick={() => void approve(row)}>Duyệt</Button>
        <Button size="small" danger onClick={() => { setRejecting(row); setRejectReason('') }}>Từ chối</Button>
      </>}
      {isTechnician && row.status === 'pending' && row.staff_id === access.currentUserId && <Popconfirm title="Rút đăng ký nghỉ này?" okText="Rút" cancelText="Hủy" onConfirm={() => void withdraw(row)}><Button size="small">Rút đơn</Button></Popconfirm>}
    </Space> },
  ]

  return <div>
    <ToolbarRow>
      <Popover
        trigger="click" placement="bottomLeft" open={filterOpen} onOpenChange={openFilters}
        title="Bộ lọc"
        content={<div style={{ width: 300, maxHeight: 'min(70vh, 580px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowY: 'auto', paddingRight: 4 }}>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
              <Typography.Text strong>Cột hiển thị</Typography.Text>
              <Tag style={{ marginInlineEnd: 0 }}>{draftVisibleColumns.length}/{DAY_OFF_COLUMN_OPTIONS.length} cột</Tag>
            </Space>
            <Checkbox.Group
              value={draftVisibleColumns}
              onChange={(values) => setDraftVisibleColumns(values as DayOffColumnKey[])}
              style={{ display: 'grid', gap: 10 }}
              options={DAY_OFF_COLUMN_OPTIONS}
            />

            <Divider style={{ margin: '14px 0' }} />
            <Typography.Text strong>Điều kiện lọc</Typography.Text>
            <Form form={filterForm} layout="vertical" onFinish={applyFilters} style={{ marginTop: 10 }}>
              {access.isAdmin && <Form.Item name="branch_id" label="Cơ sở" style={{ marginBottom: 10 }}>
                <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
              </Form.Item>}
              {!isTechnician && <Form.Item name="staff_id" label="KTV" style={{ marginBottom: 10 }}>
                <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả KTV" options={staff.map((person) => ({ value: person.id, label: staffLabel(person) }))} />
              </Form.Item>}
              <Form.Item name="range" label="Khoảng ngày nghỉ" style={{ marginBottom: 10 }}>
                <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 0 }}>
                <Select allowClear placeholder="Tất cả trạng thái" options={Object.entries(STATUS).map(([value, item]) => ({ value, label: item.label }))} />
              </Form.Item>
            </Form>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--brand-border-soft)' }}>
            <Button icon={<ClearOutlined />} disabled={!activeFilterCount && visibleColumns.length === DEFAULT_VISIBLE_COLUMNS.length} onClick={clearFilters}>Xóa lọc</Button>
            <Button type="primary" onClick={() => filterForm.submit()}>Xác nhận</Button>
          </div>
        </div>}
      >
        <Badge count={activeFilterCount} size="small">
          <Button icon={<FilterOutlined />}>Bộ lọc</Button>
        </Badge>
      </Popover>
      {(access.isAdmin || access.isReceptionist || access.isTechnician) && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Đăng ký nghỉ</Button>}
    </ToolbarRow>
    {!!error && <Alert type="error" showIcon message="Không tải được danh sách ngày nghỉ" description={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => void daysOffQuery.refetch()}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
    <Table<StaffDayOff>
      className="desktop-only"
      rowKey="id" size="middle" pagination={false}
      loading={loadingShared || daysOffQuery.isLoading || templatesQuery.isLoading} dataSource={paginateRows(rows, page, 10)}
      columns={columns.filter((column) => column.key === 'actions' || visibleColumns.includes(column.key as DayOffColumnKey))}
      locale={{ emptyText: <TableEmpty description="Chưa có đăng ký nghỉ trong điều kiện đã chọn" /> }}
    />
    <MobileCards
      rows={paginateRows(rows, page, 10)}
      rowKey={(row) => row.id}
      loading={loadingShared || daysOffQuery.isLoading || templatesQuery.isLoading}
      emptyText="Chưa có đăng ký nghỉ trong điều kiện đã chọn"
      renderCard={(row) => {
        const staffInfo = (row as StaffDayOff & { staff?: { id: string; zalo_name?: string; email?: string; phone_number?: string } }).staff ?? staff.find((person) => person.id === row.staff_id)
        return (
          <>
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">{staffLabel(staffInfo)}</div>
                <div className="mobile-card-sub">{dayjs(row.off_date).format('DD/MM/YYYY')} · {(row as StaffDayOff & { shift_template?: { name?: string } }).shift_template?.name || templates.find((template) => template.id === row.shift_template_id)?.name || 'Cả ngày'}</div>
              </div>
              <Tag color={STATUS[row.status ?? '']?.color}>{STATUS[row.status ?? '']?.label ?? row.status}</Tag>
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Lý do" value={row.reason || '—'} />
              {row.reject_reason && <MobileCardRow label="Lý do từ chối" value={<span style={{ color: '#cf1322' }}>{row.reject_reason}</span>} />}
            </div>
            {((access.isAdmin && row.status === 'pending') || (isTechnician && row.status === 'pending' && row.staff_id === access.currentUserId)) && (
              <div className="mobile-card-actions">
                {access.isAdmin && <>
                  <Button size="small" type="primary" onClick={() => void approve(row)}>Duyệt</Button>
                  <Button size="small" danger onClick={() => { setRejecting(row); setRejectReason('') }}>Từ chối</Button>
                </>}
                {isTechnician && row.status === 'pending' && row.staff_id === access.currentUserId && <Popconfirm title="Rút đăng ký nghỉ này?" okText="Rút" cancelText="Hủy" onConfirm={() => void withdraw(row)}><Button size="small">Rút đơn</Button></Popconfirm>}
              </div>
            )}
          </>
        )
      }}
    />
    <ListPagination page={page} limit={10} total={rows.length} onChange={setPage} noun="đăng ký nghỉ" />

    <DayOffFormModal
      open={open}
      form={form}
      staff={staff}
      scheduledTemplates={scheduledTemplates}
      isTechnician={isTechnician}
      onCancel={() => setOpen(false)}
      onSubmit={() => void submit()}
    />

    <DayOffRejectModal
      open={!!rejecting}
      reason={rejectReason}
      onReasonChange={setRejectReason}
      onCancel={() => setRejecting(null)}
      onSubmit={() => void reject()}
    />
  </div>
}