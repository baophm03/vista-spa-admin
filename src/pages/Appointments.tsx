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
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { CalendarOutlined, CheckOutlined, EllipsisOutlined, FilterOutlined, LeftOutlined, PlusOutlined, ReloadOutlined, RightOutlined, UnorderedListOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import CustomFieldFormItems, { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
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
import { getGetCustomerProfilesQueryKey, postCustomerProfiles, useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetService } from '@/api/endpoints/services'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetBranches } from '@/api/endpoints/branches'
import { Can } from '@casl/react'

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
  customer_profile?: { id?: string; full_name?: string; phone?: string; branch_id?: string | null } | null
  service?: { title?: string; duration_minutes?: number } | null
  staff?: { zalo_name?: string } | null
}

const CALENDAR_START_HOUR = 7
const CALENDAR_END_HOUR = 22
const CALENDAR_HOURS = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => CALENDAR_START_HOUR + index)

function mondayOf(date: dayjs.Dayjs) {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
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

const CALENDAR_STATUS_STYLE: Record<AppointmentStatus, { border: string; background: string }> = {
  pending: { border: '#f5a623', background: '#fff8e8' },
  approved: { border: '#52a66b', background: '#f1fbf3' },
  in_progress: { border: '#4587c7', background: '#eff7ff' },
  completed: { border: '#8bbf69', background: '#f5fbef' },
  cancelled: { border: '#a6adb1', background: '#f4f5f6' },
  rejected: { border: '#d75a5a', background: '#fff2f0' },
  no_show: { border: '#d46b08', background: '#fff7e6' },
}

function AppointmentCalendarCard({ row, onClick }: { row: AppointmentRow; onClick: () => void }) {
  const status = row.status as AppointmentStatus
  const style = CALENDAR_STATUS_STYLE[status] ?? CALENDAR_STATUS_STYLE.pending
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}
      style={{ borderLeft: `3px solid ${style.border}`, borderRadius: 7, background: style.background, padding: '6px 8px', marginBottom: 5, lineHeight: 1.35, cursor: 'pointer' }}
    >
      <Typography.Text strong style={{ display: 'block', fontSize: 12 }}>
        {row.start_time?.slice(0, 5)} · {row.customer_profile?.full_name || 'Khách hàng'}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
        {row.service?.title || 'Chưa có dịch vụ'} · {row.service?.duration_minutes || 60} phút
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
        {row.staff?.zalo_name || 'Chưa gán KTV'} · {STATUS_META[status]?.label || status}
      </Typography.Text>
    </div>
  )
}

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
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>('calendar')
  const [calendarView, setCalendarView] = useState<'day' | 'week'>('week')
  const [calendarDate, setCalendarDate] = useState(() => dayjs())
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
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null)
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<ProfileRow | null>(null)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [startingAppointment, setStartingAppointment] = useState<AppointmentRow | null>(null)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [form] = Form.useForm()
  const [startForm] = Form.useForm()
  const [quickCustomerForm] = Form.useForm()
  const appointmentCustomFields = useCustomFieldDefinitions('APPOINTMENT')
  const sessionCustomFields = useCustomFieldDefinitions('SESSION')
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

  const appointmentsQuery = useGetAppointments(listParams as never, { query: { enabled: displayMode === 'list' } })
  const rows = useMemo(() => pickData<AppointmentRow[] | undefined>(appointmentsQuery.data) ?? [], [appointmentsQuery.data])
  const total = pickMeta(appointmentsQuery.data)?.total ?? rows.length

  const calendarStart = calendarView === 'week' ? mondayOf(calendarDate) : calendarDate.startOf('day')
  const calendarEnd = calendarView === 'week' ? calendarStart.add(6, 'day') : calendarStart
  const calendarParams = useMemo(() => {
    const viewFrom = calendarStart.format('YYYY-MM-DD')
    const viewTo = calendarEnd.format('YYYY-MM-DD')
    const params: Record<string, unknown> = {
      page: 1,
      limit: 200,
      from_date: dateFilter[0] && dateFilter[0] > viewFrom ? dateFilter[0] : viewFrom,
      to_date: dateFilter[1] && dateFilter[1] < viewTo ? dateFilter[1] : viewTo,
    }
    if (filter !== 'all') params.status = filter
    if (staffFilter) params.staff_id = staffFilter
    if (branchFilter) params.branch_id = branchFilter
    return params
  }, [calendarStart, calendarEnd, dateFilter, filter, staffFilter, branchFilter])
  const calendarAppointmentsQuery = useGetAppointments(calendarParams as never, { query: { enabled: displayMode === 'calendar' } })
  const calendarRows = useMemo(() => pickData<AppointmentRow[] | undefined>(calendarAppointmentsQuery.data) ?? [], [calendarAppointmentsQuery.data])
  const calendarDays = Array.from({ length: calendarView === 'week' ? 7 : 1 }, (_, index) => calendarStart.add(index, 'day'))

  useEffect(() => {
    const timer = window.setTimeout(() => setCustomerSearch(customerSearchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [customerSearchInput])

  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 50, q: customerSearch || undefined })
  // useMemo để giữ tham chiếu ổn định: fallback [] tạo mảng mới mỗi render, nếu đưa vào
  // deps của effect (như effect lấy slot bên dưới) sẽ dẫn tới vòng lặp setState vô hạn
  // ("Maximum update depth exceeded" → React unmount cả cây → trang trắng).
  const profiles = useMemo(() => (pickData<ProfileRow[] | undefined>(profilesQuery.data) ?? []) as ProfileRow[], [profilesQuery.data])
  const profileOptions = useMemo(() => {
    const options = [...profiles]
    if (selectedProfile && !options.some((profile) => profile.id === selectedProfile.id)) options.unshift(selectedProfile)
    return options
  }, [profiles, selectedProfile])
  const servicesQuery = useGetService({ page: 1, limit: 200, is_active: true })
  // GET /service trả { services, total, ... } trong responseData
  const services = useMemo(() => (pickData<{ services?: Service[] } | undefined>(servicesQuery.data)?.services ?? []) as Service[], [servicesQuery.data])
  const staffsQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const staffs = useMemo(() => (pickData<{ rows?: StaffRow[] } | undefined>(staffsQuery.data)?.rows ?? []) as StaffRow[], [staffsQuery.data])
  const calendarStaffs = useMemo(() => {
    const assignedIds = [...new Set(calendarRows.map((row) => row.staff_id).filter((id): id is string => !!id))]
    return assignedIds.map((id) => staffs.find((staff) => staff.id === id) ?? { id, zalo_name: 'Nhân viên' })
  }, [calendarRows, staffs])
  const branchesQuery = useGetBranches({ status: 'active' })
  const branches = useMemo(() => (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])

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
      ?? (selectedProfile && selectedProfile.id === selectedCustomerId ? selectedProfile.branch_id : undefined)
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
  }, [open, selectedCustomerId, selectedServiceId, selectedDate, profiles, selectedProfile, editing?.id, form])

  const openModal = (appointment?: Appointment) => {
    setEditing(appointment ?? null)
    setSlots([])
    slotRequest.current += 1
    previousSlotCriteria.current = ''
    form.resetFields()
    setCustomerSearchInput('')
    setCustomerSearch('')
    const profileFromAppointment = (appointment as AppointmentRow | undefined)?.customer_profile
    setSelectedProfile(appointment
      ? profiles.find((profile) => profile.id === appointment.customer_profile_id)
        ?? (profileFromAppointment?.id ? {
          id: profileFromAppointment.id,
          full_name: profileFromAppointment.full_name,
          phone: profileFromAppointment.phone,
          branch_id: profileFromAppointment.branch_id,
        } : null)
      : null)
    form.setFieldsValue(
      appointment
        ? {
            customer_profile_id: appointment.customer_profile_id,
            service_id: appointment.service_id,
            staff_id: appointment.staff_id,
            appt_date: dayjs(appointment.appt_date),
            start_time: appointment.start_time?.slice(0, 5),
            note: appointment.note,
            custom_fields: appointment.custom_fields ?? {},
          }
        : { appt_date: dayjs().add(1, 'day'), custom_fields: {} },
    )
    setOpen(true)
  }

  const openQuickCustomer = () => {
    quickCustomerForm.resetFields()
    quickCustomerForm.setFieldsValue({ branch_id: branchFilter || branches[0]?.id })
    setQuickCustomerOpen(true)
  }

  const submitQuickCustomer = async () => {
    try {
      const values = await quickCustomerForm.validateFields()
      const response = await postCustomerProfiles(values as never)
      const created = pickData<ProfileRow | undefined>(response)
      if (!created?.id) throw new Error('Không nhận được hồ sơ khách hàng vừa tạo')
      setSelectedProfile(created)
      form.setFieldValue('customer_profile_id', created.id)
      setCustomerSearchInput('')
      setCustomerSearch('')
      setQuickCustomerOpen(false)
      message.success('Đã tạo khách hàng và chọn vào lịch hẹn')
      void queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesQueryKey() })
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    const profile = profiles.find((p) => p.id === values.customer_profile_id)
      ?? (selectedProfile?.id === values.customer_profile_id ? selectedProfile : undefined)
    const payload = {
      customer_profile_id: values.customer_profile_id,
      branch_id: profile?.branch_id,
      service_id: values.service_id,
      staff_id: values.staff_id || undefined,
      appt_date: dayjs(values.appt_date).format('YYYY-MM-DD'),
      start_time: values.start_time,
      note: values.note,
      custom_fields: normalizeCustomFieldValues(appointmentCustomFields, values.custom_fields ?? {}, editing?.custom_fields ?? {}),
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

  const beginAppointment = (row: AppointmentRow) => {
    if (sessionCustomFields.length === 0) {
      void doAction(() => startMutation.mutateAsync({ id: row.id, data: {} }), 'Đã bắt đầu')
      return
    }
    startForm.resetFields()
    startForm.setFieldsValue({ custom_fields: {} })
    setStartingAppointment(row)
  }

  const submitStart = async () => {
    if (!startingAppointment) return
    try {
      const values = await startForm.validateFields()
      const sessionFields = normalizeCustomFieldValues(sessionCustomFields, values.custom_fields ?? {})
      await startMutation.mutateAsync({
        id: startingAppointment.id,
        data: sessionFields ? { session_custom_fields: sessionFields } : {},
      })
      message.success('Đã bắt đầu')
      refresh()
      setStartingAppointment(null)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
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
            <Can I="CREATE" a="APPOINTMENT">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Thêm lịch hẹn
              </Button>
            </Can>
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
        <Space style={{ marginLeft: 'auto' }} wrap>
          <Segmented
            value={displayMode}
            options={[
              { label: 'Lịch', value: 'calendar', icon: <CalendarOutlined /> },
              { label: 'Danh sách', value: 'list', icon: <UnorderedListOutlined /> },
            ]}
            onChange={(value) => setDisplayMode(value as 'calendar' | 'list')}
          />
          {displayMode === 'calendar' && (
            <Space>
              <Button
                aria-label="Khoảng thời gian trước"
                icon={<LeftOutlined />}
                onClick={() => setCalendarDate((current) => current.add(calendarView === 'week' ? -7 : -1, 'day'))}
              />
              <DatePicker
                value={calendarView === 'week' ? calendarStart : calendarDate}
                format={calendarView === 'week' ? '[Tuần bắt đầu] DD/MM/YYYY' : 'DD/MM/YYYY'}
                onChange={(value) => value && setCalendarDate(value)}
              />
              <Button onClick={() => setCalendarDate(dayjs())}>Hôm nay</Button>
              <Button
                aria-label="Khoảng thời gian tiếp theo"
                icon={<RightOutlined />}
                onClick={() => setCalendarDate((current) => current.add(calendarView === 'week' ? 7 : 1, 'day'))}
              />
              <Segmented
                value={calendarView}
                options={[{ label: 'Ngày', value: 'day' }, { label: 'Tuần', value: 'week' }]}
                onChange={(value) => setCalendarView(value as 'day' | 'week')}
              />
            </Space>
          )}
        </Space>
      </Space>
      {displayMode === 'calendar' ? (
        <div style={{ overflowX: 'auto', border: '1px solid #d9e3e7', borderRadius: 12, background: '#fff' }}>
          {calendarAppointmentsQuery.isLoading ? (
            <div style={{ padding: 32, textAlign: 'center' }}>Đang tải lịch hẹn…</div>
          ) : calendarView === 'day' ? (
            <div style={{ minWidth: Math.max(760, (calendarStaffs.length + (calendarRows.some((row) => !row.staff_id) ? 1 : 0)) * 210 + 80) }}>
              <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${Math.max(1, calendarStaffs.length + (calendarRows.some((row) => !row.staff_id) ? 1 : 0))}, minmax(190px, 1fr))`, position: 'sticky', top: 0, zIndex: 2, background: '#eef3f4', borderBottom: '1px solid #d9e3e7' }}>
                <div style={{ padding: 12, fontWeight: 600, color: '#53636a' }}>{calendarStart.format('DD/MM')}</div>
                {calendarStaffs.length || calendarRows.some((row) => !row.staff_id) ? (
                  <>
                    {calendarStaffs.map((staff) => <div key={staff.id} style={{ padding: 12, borderLeft: '1px solid #d9e3e7', fontWeight: 600 }}>{staff.zalo_name || 'Nhân viên'}</div>)}
                    {calendarRows.some((row) => !row.staff_id) && <div style={{ padding: 12, borderLeft: '1px solid #d9e3e7', fontWeight: 600 }}>Chưa gán KTV</div>}
                  </>
                ) : <div style={{ padding: 12, borderLeft: '1px solid #d9e3e7', color: '#849197' }}>Chưa có lịch hẹn</div>}
              </div>
              {CALENDAR_HOURS.map((hour) => (
                <div key={hour} style={{ display: 'grid', gridTemplateColumns: `80px repeat(${Math.max(1, calendarStaffs.length + (calendarRows.some((row) => !row.staff_id) ? 1 : 0))}, minmax(190px, 1fr))`, minHeight: 82, borderBottom: '1px solid #edf1f2' }}>
                  <div style={{ padding: '8px 12px', color: '#849197', fontSize: 12 }}>{String(hour).padStart(2, '0')}:00</div>
                  {calendarStaffs.length || calendarRows.some((row) => !row.staff_id) ? (
                    <>
                      {[
                        ...calendarStaffs.map((staff) => ({ id: staff.id, rows: calendarRows.filter((row) => row.staff_id === staff.id) })),
                        ...(calendarRows.some((row) => !row.staff_id) ? [{ id: '__unassigned', rows: calendarRows.filter((row) => !row.staff_id) }] : []),
                      ].map((column) => (
                        <div key={column.id} style={{ borderLeft: '1px solid #edf1f2', padding: 5 }}>
                          {column.rows.filter((row) => dayjs(row.appt_date).isSame(calendarStart, 'day') && Number(row.start_time?.slice(0, 2)) === hour).map((row) => (
                            <AppointmentCalendarCard key={row.id} row={row} onClick={() => setSelectedAppointment(row)} />
                          ))}
                        </div>
                      ))}
                    </>
                  ) : <div style={{ gridColumn: '2 / -1', borderLeft: '1px solid #edf1f2' }} />}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ minWidth: 1160 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(150px, 1fr))', position: 'sticky', top: 0, zIndex: 2, background: '#eef3f4', borderBottom: '1px solid #d9e3e7' }}>
                <div style={{ padding: 12, fontWeight: 600, color: '#53636a' }}>Giờ</div>
                {calendarDays.map((date) => <div key={date.format('YYYY-MM-DD')} style={{ padding: 12, borderLeft: '1px solid #d9e3e7', fontWeight: 600 }}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.day()]} {date.format('DD/MM')}</div>)}
              </div>
              {CALENDAR_HOURS.map((hour) => (
                <div key={hour} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(150px, 1fr))', minHeight: 92, borderBottom: '1px solid #edf1f2' }}>
                  <div style={{ padding: '8px 12px', color: '#849197', fontSize: 12 }}>{String(hour).padStart(2, '0')}:00</div>
                  {calendarDays.map((date) => (
                    <div key={date.format('YYYY-MM-DD')} style={{ borderLeft: '1px solid #edf1f2', padding: 5 }}>
                      {calendarRows.filter((row) => dayjs(row.appt_date).isSame(date, 'day') && Number(row.start_time?.slice(0, 2)) === hour).map((row) => (
                        <AppointmentCalendarCard key={row.id} row={row} onClick={() => setSelectedAppointment(row)} />
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : <Table<AppointmentRow>
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
              const confirmThen = (title: string, fn: () => Promise<unknown> | void) =>
                Modal.confirm({ title, okText: title, cancelText: 'Đóng', onOk: () => fn() })
              const buildExtraActions = (check: (action: string) => boolean) => [
                check('APPROVE') && row.status === 'pending' && { key: 'reject', label: 'Từ chối', danger: true, onClick: () => reject(row) },
                check('UPDATE') && ['pending', 'approved'].includes(row.status ?? '') && { key: 'reschedule', label: 'Đổi lịch', onClick: () => openModal(row) },
                row.status === 'approved' && isPastAppointment(row) && {
                  key: 'noshow',
                  label: 'Đánh dấu không đến',
                  onClick: () =>
                    confirmThen('Đánh dấu khách không đến? (Chỉ ghi nhận; không trừ buổi, không tính phí.)', () =>
                      doAction(() => noShowMutation.mutateAsync({ id: row.id }), 'Đã ghi nhận không đến')),
                },
                ['pending', 'approved'].includes(row.status ?? '') && {
                  key: 'cancel',
                  label: 'Hủy lịch hẹn',
                  danger: true,
                  onClick: () => confirmThen('Hủy lịch hẹn này?', () => doAction(() => cancelMutation.mutateAsync({ id: row.id }), 'Đã hủy')),
                },
              ].filter(Boolean) as Array<{ key: string; label: string; danger?: boolean; onClick: () => void }>
              return (
                <Space size={4}>
                  {row.status === 'pending' && (
                    <Can I="APPROVE" a="APPOINTMENT">
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approve(row)}>
                        Duyệt
                      </Button>
                    </Can>
                  )}
                  {row.status === 'approved' && (
                    <Can I="START" a="APPOINTMENT">
                      <Button size="small" onClick={() => beginAppointment(row)}>
                        Bắt đầu
                      </Button>
                    </Can>
                  )}
                  {row.status === 'in_progress' && (
                    <Button size="small" type="primary" onClick={() => doAction(() => completeMutation.mutateAsync({ id: row.id }), 'Đã hoàn tất')}>
                      Hoàn tất
                    </Button>
                  )}
                  {/* Menu dropdown là data nên không bọc <Can> từng item được — dùng children-as-function
                      của <Can> để nhận ability một cách reactive (giống useAbility của casl/react) */}
                  <Can I="READ" a="APPOINTMENT" passThrough>
                    {({ ability }) => {
                      const extraActions = buildExtraActions((action) => ability.can(action as never, 'APPOINTMENT'))
                      return extraActions.length > 0 ? (
                        <Dropdown
                          trigger={['click']}
                          menu={{ items: extraActions.map(({ key, label, danger, onClick }) => ({ key, label, danger, onClick })) }}
                        >
                          <Button size="small" icon={<EllipsisOutlined />} />
                        </Dropdown>
                      ) : null
                    }}
                  </Can>
                </Space>
              )
            },
          },
        ] satisfies TableColumnsType<AppointmentRow>).filter((column) => column.key === 'actions' || visibleColumns.includes(String(column.key)))}
      />}

      <Modal
        title="Chi tiết lịch hẹn"
        open={!!selectedAppointment}
        onCancel={() => setSelectedAppointment(null)}
        footer={selectedAppointment ? (
          <Space wrap>
            <Button onClick={() => setSelectedAppointment(null)}>Đóng</Button>
            {['pending', 'approved'].includes(selectedAppointment.status ?? '') && (
              <Can I="UPDATE" a="APPOINTMENT">
                <Button onClick={() => { const row = selectedAppointment; setSelectedAppointment(null); openModal(row) }}>Đổi lịch</Button>
              </Can>
            )}
            {selectedAppointment.status === 'pending' && (
              <Can I="APPROVE" a="APPOINTMENT">
                <Button onClick={() => { const row = selectedAppointment; setSelectedAppointment(null); void approve(row) }}>Duyệt</Button>
                <Button danger onClick={() => { const row = selectedAppointment; setSelectedAppointment(null); reject(row) }}>Từ chối</Button>
              </Can>
            )}
            {selectedAppointment.status === 'approved' && isPastAppointment(selectedAppointment) && (
              <Can I="APPROVE" a="APPOINTMENT">
                <Button onClick={() => { const row = selectedAppointment; setSelectedAppointment(null); void doAction(() => noShowMutation.mutateAsync({ id: row.id }), 'Đã ghi nhận không đến') }}>Không đến</Button>
              </Can>
            )}
            {['pending', 'approved'].includes(selectedAppointment.status ?? '') && (
              <Can I="APPROVE" a="APPOINTMENT">
                <Button danger onClick={() => { const row = selectedAppointment; setSelectedAppointment(null); void doAction(() => cancelMutation.mutateAsync({ id: row.id }), 'Đã hủy') }}>Hủy lịch</Button>
              </Can>
            )}
            {selectedAppointment.status === 'approved' && (
              <Can I="START" a="APPOINTMENT">
                <Button type="primary" onClick={() => { const row = selectedAppointment; setSelectedAppointment(null); beginAppointment(row) }}>Bắt đầu</Button>
              </Can>
            )}
            {selectedAppointment.status === 'in_progress' && (
              <Button type="primary" onClick={() => { const row = selectedAppointment; setSelectedAppointment(null); void doAction(() => completeMutation.mutateAsync({ id: row.id }), 'Đã hoàn tất') }}>Hoàn tất</Button>
            )}
          </Space>
        ) : null}
      >
        {selectedAppointment && (
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text><strong>Khách hàng:</strong> {selectedAppointment.customer_profile?.full_name || '—'} ({selectedAppointment.customer_profile?.phone || 'không có số điện thoại'})</Typography.Text>
            <Typography.Text><strong>Dịch vụ:</strong> {selectedAppointment.service?.title || '—'}</Typography.Text>
            <Typography.Text><strong>KTV:</strong> {selectedAppointment.staff?.zalo_name || 'Chưa gán'}</Typography.Text>
            <Typography.Text><strong>Thời gian:</strong> {dayjs(selectedAppointment.appt_date).format('DD/MM/YYYY')} {selectedAppointment.start_time?.slice(0, 5)}</Typography.Text>
            <Typography.Text><strong>Trạng thái:</strong> <Tag color={STATUS_META[selectedAppointment.status as AppointmentStatus]?.color}>{STATUS_META[selectedAppointment.status as AppointmentStatus]?.label || selectedAppointment.status}</Tag></Typography.Text>
            {selectedAppointment.note && <Typography.Text><strong>Ghi chú:</strong> {selectedAppointment.note}</Typography.Text>}
            {selectedAppointment.reject_reason && <Typography.Text><strong>Lý do từ chối:</strong> {selectedAppointment.reject_reason}</Typography.Text>}
          </Space>
        )}
      </Modal>

      <Modal
        title={editing ? 'Đổi lịch hẹn' : 'Thêm lịch hẹn'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="customer_profile_id"
            label={(
              <Space size={4}>
                <span>Khách hàng</span>
                <Can I="CREATE" a="CUSTOMER">
                  <Button type="link" size="small" onClick={openQuickCustomer}>+ Tạo khách mới</Button>
                </Can>
              </Space>
            )}
            rules={[{ required: true, message: 'Chọn khách' }]}
          >
            <Select
              showSearch
              filterOption={false}
              onSearch={setCustomerSearchInput}
              onChange={(id) => setSelectedProfile(profileOptions.find((profile) => profile.id === id) ?? null)}
              loading={profilesQuery.isLoading}
              placeholder="Chọn khách hàng"
              options={profileOptions.map((p) => ({
                value: p.id,
                label: `${p.full_name} — ${p.phone}`,
              }))}
              notFoundContent={profilesQuery.isLoading ? 'Đang tìm khách hàng…' : 'Không tìm thấy khách'}
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
          <CustomFieldFormItems definitions={appointmentCustomFields} />
        </Form>
      </Modal>
      <Modal
        title="Tạo nhanh khách hàng"
        open={quickCustomerOpen}
        onCancel={() => setQuickCustomerOpen(false)}
        onOk={() => void submitQuickCustomer()}
        okText="Tạo khách"
        cancelText="Hủy"
      >
        <Form form={quickCustomerForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="Tên khách hàng" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
            <Input placeholder="0901234567" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input type="email" placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
            <Select
              placeholder="Chọn cơ sở"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="Thông tin buổi điều trị"
        open={!!startingAppointment}
        onCancel={() => setStartingAppointment(null)}
        onOk={() => void submitStart()}
        okText="Bắt đầu buổi"
        cancelText="Hủy"
      >
        <Form form={startForm} layout="vertical" style={{ marginTop: 12 }}>
          <CustomFieldFormItems definitions={sessionCustomFields} />
        </Form>
      </Modal>
    </>
  )
}
