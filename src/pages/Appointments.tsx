import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Badge,
  Button,
  Checkbox,
  Col,
  DatePicker,
  Divider,
  Dropdown,
  Form,
  Input,
  Modal,
  Popover,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckOutlined, EllipsisOutlined, FilterOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { Appointment } from '@/api/models/appointment'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import type { Service } from '@/api/models/service'
import type { Branch } from '@/api/models/branch'
import {
  getAppointmentsAvailableSlots,
  getGetAppointmentsQueryKey,
  useGetAppointments,
  usePostAppointments,
  usePostAppointmentsIdComplete,
  usePostAppointmentsIdStart,
  usePutAppointmentsId,
  usePutAppointmentsIdApprove,
  usePutAppointmentsIdCancel,
  usePutAppointmentsIdNoShow,
  usePutAppointmentsIdReject,
} from '@/api/endpoints/appointments'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetService } from '@/api/endpoints/services'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetBranches } from '@/api/endpoints/branches'

interface Slot {
  date?: string
  start_time: string
  end_time?: string
  staff_ids: string[]
}

interface ProfileRow {
  id: string
  full_name?: string
  phone?: string
  branch_id?: string | null
}

interface StaffRow {
  id: string
  zalo_name?: string
  email?: string
}

type AppointmentRow = Appointment & {
  customer_profile?: { full_name?: string; phone?: string } | null
  service?: { title?: string } | null
  staff?: { zalo_name?: string } | null
}

const STATUS_META: Record<AppointmentStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'purple' },
  in_progress: { label: 'Đang thực hiện', color: 'blue' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
  no_show: { label: 'Không đến', color: 'volcano' },
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'in_progress', label: 'Đang làm' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'no_show', label: 'Không đến' },
]

const APPOINTMENT_COLUMNS = [
  { value: 'customer', label: 'Khách hàng' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'staff', label: 'KTV' },
  { value: 'time', label: 'Thời gian' },
  { value: 'source', label: 'Nguồn' },
  { value: 'status', label: 'Trạng thái' },
]
const DEFAULT_APPOINTMENT_COLUMNS = APPOINTMENT_COLUMNS.map((column) => column.value)

export default function Appointments() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<[string | null, string | null]>([null, null])
  const [staffFilter, setStaffFilter] = useState<string | undefined>()
  const [branchFilter, setBranchFilter] = useState<string | undefined>()
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_APPOINTMENT_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[]>(DEFAULT_APPOINTMENT_COLUMNS)
  const [draftDateFilter, setDraftDateFilter] = useState<[string | null, string | null]>([null, null])
  const [draftStaffFilter, setDraftStaffFilter] = useState<string | null>(null)
  const [draftBranchFilter, setDraftBranchFilter] = useState<string | null>(null)
  const [draftFilter, setDraftFilter] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [form] = Form.useForm()
  const slotRequest = useRef(0)
  const previousSlotCriteria = useRef('')
  const selectedCustomerId = Form.useWatch('customer_profile_id', form)
  const selectedServiceId = Form.useWatch('service_id', form)
  const selectedDateValue = Form.useWatch('appt_date', form)
  const selectedDate = selectedDateValue ? dayjs(selectedDateValue).format('YYYY-MM-DD') : ''
  const selectedStartTime = Form.useWatch('start_time', form)

  const listParams = useMemo(() => {
    const params: Record<string, unknown> = { page, limit }
    if (filter !== 'all') params.status = filter
    if (dateFilter[0]) params.from_date = dateFilter[0]
    if (dateFilter[1]) params.to_date = dateFilter[1]
    if (staffFilter) params.staff_id = staffFilter
    if (branchFilter) params.branch_id = branchFilter
    return params
  }, [page, limit, filter, dateFilter, staffFilter, branchFilter])

  const appointmentsQuery = useGetAppointments(listParams as never)
  const rows = pickData<AppointmentRow[] | undefined>(appointmentsQuery.data) ?? []
  const total = pickMeta(appointmentsQuery.data)?.total ?? rows.length

  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const profiles = (pickData<ProfileRow[] | undefined>(profilesQuery.data) ?? []) as ProfileRow[]
  const servicesQuery = useGetService({ page: 1, limit: 200, is_active: true })
  // GET /service trả { services, total, ... } trong responseData
  const services = (pickData<{ services?: Service[] } | undefined>(servicesQuery.data)?.services ?? []) as Service[]
  const staffsQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const staffs = (pickData<{ rows?: StaffRow[] } | undefined>(staffsQuery.data)?.rows ?? []) as StaffRow[]
  const branchesQuery = useGetBranches({ status: 'active' })
  const branches = (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[]

  const createMutation = usePostAppointments()
  const rescheduleMutation = usePutAppointmentsId()
  const approveMutation = usePutAppointmentsIdApprove()
  const rejectMutation = usePutAppointmentsIdReject()
  const noShowMutation = usePutAppointmentsIdNoShow()
  const cancelMutation = usePutAppointmentsIdCancel()
  const startMutation = usePostAppointmentsIdStart()
  const completeMutation = usePostAppointmentsIdComplete()

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetAppointmentsQueryKey() })
  }, [queryClient])

  useEffect(() => {
    const requestId = ++slotRequest.current
    const branchId = profiles.find((p) => p.id === selectedCustomerId)?.branch_id
    const criteria = selectedCustomerId && selectedServiceId && selectedDate
      ? `${selectedCustomerId}|${selectedServiceId}|${selectedDate}`
      : ''
    if (previousSlotCriteria.current && criteria && criteria !== previousSlotCriteria.current) {
      form.setFieldsValue({ start_time: undefined, staff_id: undefined })
    }
    previousSlotCriteria.current = criteria
    setSlots([])
    if (!open || !branchId || !selectedServiceId || !selectedDate) {
      setSlotsLoading(false)
      return
    }

    setSlotsLoading(true)
    getAppointmentsAvailableSlots({
      branch_id: branchId,
      service_id: selectedServiceId,
      date: selectedDate,
      exclude_appointment_id: editing?.id,
    })
      .then((response) => {
        if (requestId !== slotRequest.current) return
        const available = (pickData<Slot[] | undefined>(response) ?? []) as Slot[]
        setSlots(available)
        const currentTime = form.getFieldValue('start_time')?.slice(0, 5)
        const currentStaff = form.getFieldValue('staff_id')
        const slot = available.find((candidate) => candidate.start_time.slice(0, 5) === currentTime)
        if (currentTime && !slot) {
          form.setFieldsValue({ start_time: undefined, staff_id: undefined })
          // BR-10: hết chỗ khung giờ đã chọn → gợi ý giờ còn trống
          const suggestions = available.slice(0, 3).map((s) => s.start_time.slice(0, 5)).join(', ')
          message.warning(suggestions ? `Khung giờ ${currentTime} đã hết chỗ. Còn trống: ${suggestions}` : 'Khung giờ đã chọn không còn trống')
        }
        else if (currentStaff && !slot?.staff_ids.includes(currentStaff)) form.setFieldsValue({ staff_id: undefined })
      })
      .catch((err) => {
        if (requestId === slotRequest.current) {
          setSlots([])
          message.warning(errorMessage(err))
        }
      })
      .finally(() => {
        if (requestId === slotRequest.current) setSlotsLoading(false)
      })
  }, [open, selectedCustomerId, selectedServiceId, selectedDate, profiles, editing?.id, form])

  const openModal = (appointment?: Appointment) => {
    setEditing(appointment ?? null)
    setSlots([])
    slotRequest.current += 1
    previousSlotCriteria.current = ''
    form.resetFields()
    form.setFieldsValue(
      appointment
        ? {
            customer_profile_id: appointment.customer_profile_id,
            service_id: appointment.service_id,
            staff_id: appointment.staff_id,
            appt_date: dayjs(appointment.appt_date),
            start_time: appointment.start_time?.slice(0, 5),
            note: appointment.note,
          }
        : { appt_date: dayjs().add(1, 'day') },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const profile = profiles.find((p) => p.id === values.customer_profile_id)
    const payload = {
      customer_profile_id: values.customer_profile_id,
      branch_id: profile?.branch_id,
      service_id: values.service_id,
      staff_id: values.staff_id || undefined,
      appt_date: dayjs(values.appt_date).format('YYYY-MM-DD'),
      start_time: values.start_time,
      note: values.note,
    }
    try {
      if (editing) {
        await rescheduleMutation.mutateAsync({ id: editing.id, data: payload as never })
        message.success('Đã cập nhật lịch hẹn')
      } else {
        await createMutation.mutateAsync({ data: payload as never })
        message.success('Đã tạo lịch hẹn')
      }
      setOpen(false)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const doAction = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn()
      message.success(msg)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const approve = async (row: AppointmentRow) => {
    let availableStaffIds: string[] = []
    try {
      if (!row.service_id) {
        message.warning('Lịch hẹn chưa có dịch vụ để kiểm tra KTV rảnh')
        return
      }
      const response = await getAppointmentsAvailableSlots({
        branch_id: row.branch_id,
        service_id: row.service_id,
        date: dayjs(row.appt_date).format('YYYY-MM-DD'),
        exclude_appointment_id: row.id,
      })
      const availableSlots = (pickData<Slot[] | undefined>(response) ?? []) as Slot[]
      availableStaffIds = availableSlots.find((slot) => slot.start_time.slice(0, 5) === row.start_time?.slice(0, 5))?.staff_ids ?? []
    } catch (err) {
      message.error(errorMessage(err))
      return
    }
    if (row.staff_id && availableStaffIds.includes(row.staff_id)) {
      await doAction(() => approveMutation.mutateAsync({ id: row.id, data: { staff_id: row.staff_id } as never }), 'Đã duyệt')
      return
    }
    const availableStaff = availableStaffIds.map((id) => staffs.find((staff) => staff.id === id) ?? { id, zalo_name: 'KTV' })
    if (!availableStaff.length) {
      message.warning('Không có KTV rảnh ở giờ này. Hãy đổi lịch hẹn trước khi duyệt.')
      return
    }
    let staffId: string | undefined = row.staff_id && availableStaffIds.includes(row.staff_id) ? row.staff_id : undefined
    Modal.confirm({
      title: 'Chọn KTV đang rảnh ở khung giờ này',
      content: (
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          value={staffId}
          placeholder="Chọn KTV rảnh"
          options={availableStaff.map((s) => ({
            value: s.id,
            label: `${s.zalo_name || 'Nhân viên'} · ${s.email || s.id.slice(0, 8)}`,
          }))}
          onChange={(v) => {
            staffId = v
          }}
        />
      ),
      onOk: () => {
        if (!staffId) {
          message.warning('Cần chọn KTV để duyệt')
          return Promise.reject(new Error('no staff'))
        }
        return doAction(() => approveMutation.mutateAsync({ id: row.id, data: { staff_id: staffId! } as never }), 'Đã duyệt')
      },
    })
  }

  const reject = (row: AppointmentRow) => {
    let reason = 'Không thể sắp xếp'
    Modal.confirm({
      title: 'Từ chối lịch hẹn',
      content: (
        <Input
          placeholder="Lý do"
          onChange={(e) => {
            reason = e.target.value
          }}
        />
      ),
      onOk: () => doAction(() => rejectMutation.mutateAsync({ id: row.id, data: { reason } as never }), 'Đã từ chối'),
    })
  }

  const isPastAppointment = (row: AppointmentRow) =>
    new Date(`${row.appt_date}T${row.start_time}`).getTime() < Date.now()

  const activeFilterCount = [dateFilter.some(Boolean), staffFilter, branchFilter, filter !== 'all'].filter(Boolean).length
  const hasCustomColumns = DEFAULT_APPOINTMENT_COLUMNS.some((column) => !visibleColumns.includes(column))

  const clearFilters = () => {
    const emptyRange: [string | null, string | null] = [null, null]
    setDateFilter(emptyRange)
    setDraftDateFilter(emptyRange)
    setStaffFilter(undefined)
    setDraftStaffFilter(null)
    setBranchFilter(undefined)
    setDraftBranchFilter(null)
    setFilter('all')
    setDraftFilter('all')
    setVisibleColumns(DEFAULT_APPOINTMENT_COLUMNS)
    setDraftVisibleColumns(DEFAULT_APPOINTMENT_COLUMNS)
    setPage(1)
  }

  const applyFilters = () => {
    setDateFilter(draftDateFilter)
    setStaffFilter(draftStaffFilter ?? undefined)
    setBranchFilter(draftBranchFilter ?? undefined)
    setFilter(draftFilter)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refresh} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm lịch hẹn
            </Button>
          </Space>
        }
      >
        Lịch hẹn
      </PageTitle>
      <Space style={{ width: '100%', marginBottom: 16 }} wrap>
        <Popover
          open={filterOpen}
          onOpenChange={(next) => {
            setFilterOpen(next)
            if (next) {
              setDraftDateFilter(dateFilter)
              setDraftStaffFilter(staffFilter ?? null)
              setDraftBranchFilter(branchFilter ?? null)
              setDraftFilter(filter)
              setDraftVisibleColumns(visibleColumns)
            }
          }}
          trigger="click"
          placement="bottomLeft"
          content={(
            <div style={{ width: 340 }}>
              <Typography.Text strong>Cột hiển thị ({draftVisibleColumns.length}/{APPOINTMENT_COLUMNS.length})</Typography.Text>
              <Checkbox.Group
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: 8, gap: 6 }}
                value={draftVisibleColumns}
                options={APPOINTMENT_COLUMNS}
                onChange={(values) => { if (values.length) setDraftVisibleColumns(values as string[]) }}
              />
              <Divider style={{ margin: '14px 0' }} />
              <Typography.Text strong>Điều kiện lọc</Typography.Text>
              <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                <DatePicker.RangePicker
                  allowEmpty={[true, true]}
                  value={[draftDateFilter[0] ? dayjs(draftDateFilter[0]) : null, draftDateFilter[1] ? dayjs(draftDateFilter[1]) : null]}
                  onChange={(range) => setDraftDateFilter([range?.[0] ? range[0].format('YYYY-MM-DD') : null, range?.[1] ? range[1].format('YYYY-MM-DD') : null])}
                  placeholder={['Từ ngày', 'Đến ngày']}
                  style={{ width: '100%' }}
                />
                <Select
                  allowClear
                  value={draftStaffFilter}
                  onChange={(value) => setDraftStaffFilter(value ?? null)}
                  placeholder="KTV"
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  options={staffs.map((staff) => ({ value: staff.id, label: staff.zalo_name || staff.email }))}
                />
                <Select
                  allowClear
                  value={draftBranchFilter}
                  onChange={(value) => setDraftBranchFilter(value ?? null)}
                  placeholder="Cơ sở"
                  style={{ width: '100%' }}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
                <Select value={draftFilter} onChange={setDraftFilter} options={FILTERS} style={{ width: '100%' }} />
              </Space>
              <Space style={{ marginTop: 14, width: '100%', justifyContent: 'space-between' }}>
                <Button disabled={!activeFilterCount && !hasCustomColumns} onClick={clearFilters}>Xóa lọc</Button>
                <Button type="primary" onClick={applyFilters}>Xác nhận</Button>
              </Space>
            </div>
          )}
        >
          <Badge count={activeFilterCount} size="small"><Button icon={<FilterOutlined />}>Bộ lọc</Button></Badge>
        </Popover>
      </Space>
      <Table<AppointmentRow>
        rowKey="id"
        loading={appointmentsQuery.isLoading}
        dataSource={rows}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage }}
        columns={([
          {
            title: 'Khách hàng',
            key: 'customer',
            dataIndex: ['customer_profile', 'full_name'],
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v || '—'}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.customer_profile?.phone}</div>
              </div>
            ),
          },
          { title: 'Dịch vụ', key: 'service', dataIndex: ['service', 'title'] },
          { title: 'KTV', key: 'staff', dataIndex: ['staff', 'zalo_name'], render: (v) => v || 'Chưa gán' },
          {
            title: 'Thời gian',
            key: 'time',
            dataIndex: 'appt_date',
            width: 160,
            render: (v, row) => `${dayjs(v).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`,
          },
          { title: 'Nguồn', key: 'source', dataIndex: 'created_via', width: 100, render: (v) => (v === 'APP' ? <Tag>Mini App</Tag> : <Tag>Nhân viên</Tag>) },
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'status',
            width: 130,
            render: (v: AppointmentStatus) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
          {
            title: '',
            key: 'actions',
            width: 150,
            render: (_, row) => {
              const confirmThen = (title: string, fn: () => void) =>
                Modal.confirm({ title, okText: title, cancelText: 'Đóng', onOk: fn })
              const extraActions = [
                row.status === 'pending' && { key: 'reject', label: 'Từ chối', danger: true, onClick: () => reject(row) },
                ['pending', 'approved'].includes(row.status ?? '') && { key: 'reschedule', label: 'Đổi lịch', onClick: () => openModal(row) },
                row.status === 'approved' && isPastAppointment(row) && {
                  key: 'noshow',
                  label: 'Đánh dấu không đến',
                  onClick: () =>
                    confirmThen('Đánh dấu khách không đến? (Chỉ ghi nhận; không trừ buổi, không tính phí.)', () =>
                      doAction(() => noShowMutation.mutateAsync({ id: row.id }), 'Đã ghi nhận không đến')),
                },
                row.status === 'approved' && {
                  key: 'cancel',
                  label: 'Hủy lịch hẹn',
                  danger: true,
                  onClick: () => confirmThen('Hủy lịch hẹn này?', () => doAction(() => cancelMutation.mutateAsync({ id: row.id }), 'Đã hủy')),
                },
              ].filter(Boolean) as Array<{ key: string; label: string; danger?: boolean; onClick: () => void }>
              return (
                <Space size={4}>
                  {row.status === 'pending' && (
                    <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approve(row)}>
                      Duyệt
                    </Button>
                  )}
                  {row.status === 'approved' && (
                    <Button size="small" onClick={() => doAction(() => startMutation.mutateAsync({ id: row.id }), 'Đã bắt đầu')}>
                      Bắt đầu
                    </Button>
                  )}
                  {row.status === 'in_progress' && (
                    <Button size="small" type="primary" onClick={() => doAction(() => completeMutation.mutateAsync({ id: row.id }), 'Đã hoàn tất')}>
                      Hoàn tất
                    </Button>
                  )}
                  {extraActions.length > 0 && (
                    <Dropdown
                      trigger={['click']}
                      menu={{ items: extraActions.map(({ key, label, danger, onClick }) => ({ key, label, danger, onClick })) }}
                    >
                      <Button size="small" icon={<EllipsisOutlined />} />
                    </Dropdown>
                  )}
                </Space>
              )
            },
          },
        ] satisfies TableColumnsType<AppointmentRow>).filter((column) => column.key === 'actions' || visibleColumns.includes(String(column.key)))}
      />

      <Modal
        title={editing ? 'Đổi lịch hẹn' : 'Thêm lịch hẹn'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khách hàng"
              options={profiles.map((p) => ({
                value: p.id,
                label: `${p.full_name} — ${p.phone}`,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="service_id"
                label="Dịch vụ"
                rules={[{ required: true, message: 'Chọn dịch vụ khách đặt' }]}
                extra="Dịch vụ quyết định thời lượng và giờ/KTV còn trống."
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  loading={servicesQuery.isLoading}
                  placeholder="Chọn dịch vụ"
                  style={{ width: '100%' }}
                  options={services.map((s) => ({ value: s.id, label: s.title }))}
                  notFoundContent={servicesQuery.isLoading ? 'Đang tải dịch vụ…' : 'Chưa có dịch vụ đang hoạt động'}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="appt_date" label="Ngày hẹn" rules={[{ required: true, message: 'Chọn ngày hẹn' }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="start_time"
                label="Giờ hẹn"
                rules={[{ required: true, message: 'Chọn giờ hẹn còn trống' }]}
                extra="Chỉ hiện giờ có KTV rảnh, không trùng lịch."
              >
                <Select
                  disabled={slotsLoading || !selectedDate || !selectedServiceId || !selectedCustomerId}
                  loading={slotsLoading}
                  placeholder={
                    !selectedCustomerId || !selectedServiceId || !selectedDate
                      ? 'Chọn khách, dịch vụ và ngày trước'
                      : slotsLoading
                        ? 'Đang tìm giờ trống…'
                        : slots.length
                          ? 'Chọn giờ còn trống'
                          : 'Không có giờ trống ngày này'
                  }
                  options={slots.map((slot) => ({ value: slot.start_time.slice(0, 5), label: slot.start_time.slice(0, 5) }))}
                  onChange={(time) => {
                    const slot = slots.find((candidate) => candidate.start_time.slice(0, 5) === time)
                    if (!slot?.staff_ids.includes(form.getFieldValue('staff_id'))) form.setFieldsValue({ staff_id: undefined })
                  }}
                  allowClear
                  notFoundContent={
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Không có giờ trống — thử ngày khác
                    </Typography.Text>
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="staff_id" label="KTV phụ trách" extra="Có thể gán KTV ngay hoặc khi duyệt lịch.">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={!selectedStartTime || slotsLoading}
                  loading={slotsLoading}
                  placeholder={selectedStartTime ? 'Chọn KTV rảnh' : 'Chọn giờ trước'}
                  style={{ width: '100%' }}
                  options={slots
                    .find((slot) => slot.start_time.slice(0, 5) === selectedStartTime?.slice(0, 5))
                    ?.staff_ids.map((id) => staffs.find((staff) => staff.id === id))
                    .filter((staff): staff is StaffRow => !!staff)
                    .map((staff) => ({
                      value: staff.id,
                      label: `${staff.zalo_name || 'Nhân viên'} · ${staff.email || staff.id.slice(0, 8)}`,
                    }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
