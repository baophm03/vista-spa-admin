import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Can, useAbility } from '@casl/react'
import {
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Select,
  Segmented,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  CalendarOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  StopOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { Appointment } from '@/api/models/appointment'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import type { Branch } from '@/api/models/branch'
import {
  getAppointmentsAvailableSlots,
  getGetAppointmentsQueryKey,
  useGetAppointments,
  usePostAppointments,
  usePostAppointmentsIdStart,
  usePutAppointmentsId,
  usePutAppointmentsIdApprove,
  usePutAppointmentsIdCancel,
  usePutAppointmentsIdNoShow,
  usePutAppointmentsIdReject,
  getAppointmentsId,
} from '@/api/endpoints/appointments'
import { getGetCustomerProfilesQueryKey, postCustomerProfiles, useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetBranches } from '@/api/endpoints/branches'
import AppointmentDetailModal from './components/AppointmentDetailModal'
import AppointmentFormModal from './components/AppointmentFormModal'

interface UsersRowsPick {
  rows?: {
    id: string
    zalo_name?: string
    email?: string
    branch_id?: string
    user_roles?: { role?: { role_name?: string } }[]
  }[]
}
import QuickCustomerModal from './components/QuickCustomerModal'
import { STATUS_META, treatmentCode, treatmentPackageName } from './components/constants'
import type { AppointmentRow, ProfileRow, Slot } from './components/constants'

const CALENDAR_START_HOUR = 7
const CALENDAR_END_HOUR = 22
const CALENDAR_HOURS = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => CALENDAR_START_HOUR + index)

function mondayOf(date: dayjs.Dayjs) {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
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
        {row.service?.title || (row.treatment_package?.name ? 'Lịch hẹn liệu trình' : 'Hẹn tư vấn')} · {row.service?.duration_minutes || 60} phút
      </Typography.Text>
      {treatmentPackageName(row) && (
        <Typography.Text style={{ display: 'block', fontSize: 11, color: '#71005C' }}>
          Gói: {treatmentPackageName(row)}{treatmentCode(row) ? ` · ${treatmentCode(row)}` : ''}
        </Typography.Text>
      )}
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
        {STATUS_META[status]?.label || status}
      </Typography.Text>
    </div>
  )
}

const APPOINTMENT_COLUMNS = [
  { value: 'customer', label: 'Khách hàng' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'time', label: 'Thời gian' },
  { value: 'source', label: 'Nguồn' },
  { value: 'status', label: 'Trạng thái' },
]
const DEFAULT_APPOINTMENT_COLUMNS = APPOINTMENT_COLUMNS.map((column) => column.value)

export default function Appointments() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const ability = useAbility()
  const canApprove = ability.can('APPROVE' as never, 'APPOINTMENT')
  const canUpdate = ability.can('UPDATE' as never, 'APPOINTMENT')
  const canStart = ability.can('START' as never, 'APPOINTMENT')
  // Mặc định mở ở dạng lịch
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>('calendar')
  const [calendarView, setCalendarView] = useState<'day' | 'week'>('week')
  const [calendarDate] = useState(() => dayjs())
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<[string | null, string | null]>([null, null])
  const [branchFilter, setBranchFilter] = useState<string | undefined>()
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_APPOINTMENT_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<string[]>(DEFAULT_APPOINTMENT_COLUMNS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null)
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<ProfileRow | null>(null)
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [form] = Form.useForm()
  const [quickCustomerForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const appointmentCustomFields = useCustomFieldDefinitions('APPOINTMENT')
  const slotRequest = useRef(0)
  const previousSlotCriteria = useRef('')
  const appointmentSubmitInFlightRef = useRef(false)
  const selectedCustomerId = Form.useWatch('customer_profile_id', form)
  const selectedStaffId = Form.useWatch('staff_id', form) as string | undefined
  const selectedDateValue = Form.useWatch('appt_date', form)
  const selectedDate = selectedDateValue ? dayjs(selectedDateValue).format('YYYY-MM-DD') : ''

  const listParams = useMemo(() => {
    const params: Record<string, unknown> = { page, limit }
    if (filter !== 'all') params.status = filter
    if (dateFilter[0]) params.from_date = dateFilter[0]
    if (dateFilter[1]) params.to_date = dateFilter[1]
    if (branchFilter) params.branch_id = branchFilter
    return params
  }, [page, limit, filter, dateFilter, branchFilter])

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
    if (branchFilter) params.branch_id = branchFilter
    return params
  }, [calendarStart, calendarEnd, dateFilter, filter, branchFilter])
  const calendarAppointmentsQuery = useGetAppointments(calendarParams as never, { query: { enabled: displayMode === 'calendar' } })
  const calendarRows = useMemo(() => pickData<AppointmentRow[] | undefined>(calendarAppointmentsQuery.data) ?? [], [calendarAppointmentsQuery.data])
  const calendarDays = Array.from({ length: calendarView === 'week' ? 7 : 1 }, (_, index) => calendarStart.add(index, 'day'))

  useEffect(() => {
    const timer = window.setTimeout(() => setCustomerSearch(customerSearchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [customerSearchInput])

  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 50, q: customerSearch || undefined })

  const profiles = useMemo(() => (pickData<ProfileRow[] | undefined>(profilesQuery.data) ?? []) as ProfileRow[], [profilesQuery.data])
  const profileOptions = useMemo(() => {
    const options = [...profiles]
    if (selectedProfile && !options.some((profile) => profile.id === selectedProfile.id)) options.unshift(selectedProfile)
    return options
  }, [profiles, selectedProfile])
  const branchesQuery = useGetBranches({ status: 'active' })
  const branches = useMemo(() => (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])

  // Danh sách KTV để gán/đổi người phụ trách lịch hẹn (luồng xin nghỉ của KTV cũ)
  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 500, has_role: true })
  const allUsers = (pickData<UsersRowsPick | undefined>(usersQuery.data)?.rows ?? [])
  const staffOptions = useMemo(() => allUsers
    .filter((person) => (person.user_roles ?? []).some(({ role }) => {
      const roleName = String(role?.role_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
      return roleName.includes('ktv') || roleName.includes('ky thuat vien') || roleName === 'technician'
    }))
    .map((person) => ({ id: person.id, label: person.zalo_name || person.email || person.id, branchId: person.branch_id })), [allUsers])

  const createMutation = usePostAppointments()
  const rescheduleMutation = usePutAppointmentsId()
  const approveMutation = usePutAppointmentsIdApprove()
  const rejectMutation = usePutAppointmentsIdReject()
  const noShowMutation = usePutAppointmentsIdNoShow()
  const cancelMutation = usePutAppointmentsIdCancel()
  const startMutation = usePostAppointmentsIdStart()

  const isSavingAppointment = createMutation.isPending || rescheduleMutation.isPending

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetAppointmentsQueryKey() })
  }, [queryClient])

  useEffect(() => {
    const requestId = ++slotRequest.current
    const branchId = profiles.find((p) => p.id === selectedCustomerId)?.branch_id
      ?? (selectedProfile && selectedProfile.id === selectedCustomerId ? selectedProfile.branch_id : undefined)
    const selectedStaffId = form.getFieldValue('staff_id') as string | undefined
    const staffIdForSlots = selectedStaffId
    const criteria = selectedCustomerId && selectedDate ? `${selectedCustomerId}|${selectedDate}|${staffIdForSlots ?? ''}` : ''
    if (previousSlotCriteria.current && criteria && criteria !== previousSlotCriteria.current) {
      form.setFieldsValue({ start_time: undefined })
    }
    previousSlotCriteria.current = criteria
    setSlots([])
    if (!open || !branchId || !selectedDate) {
      setSlotsLoading(false)
      return
    }

    setSlotsLoading(true)
    // Lịch hẹn chỉ là hẹn tư vấn — slot không phụ thuộc dịch vụ; có chọn KTV thì lọc theo KTV
    getAppointmentsAvailableSlots({
      branch_id: branchId,
      date: selectedDate,
      ...(staffIdForSlots ? { staff_id: staffIdForSlots } : {}),
      exclude_appointment_id: editing?.id,
    })
      .then((response) => {
        if (requestId !== slotRequest.current) return
        const available = (pickData<Slot[] | undefined>(response) ?? []) as Slot[]
        setSlots(available)
        const currentTime = form.getFieldValue('start_time')?.slice(0, 5)
        const slot = available.find((candidate) => candidate.start_time.slice(0, 5) === currentTime)
        if (currentTime && !slot) {
          form.setFieldsValue({ start_time: undefined })
          // BR-10: hết chỗ khung giờ đã chọn → gợi ý giờ còn trống
          const suggestions = available.slice(0, 3).map((s) => s.start_time.slice(0, 5)).join(', ')
          message.warning(suggestions ? `Khung giờ ${currentTime} đã hết chỗ. Còn trống: ${suggestions}` : 'Khung giờ đã chọn không còn trống')
        }
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
  }, [open, selectedCustomerId, selectedDate, selectedStaffId, profiles, selectedProfile, editing?.id, form])

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
          staff_id: appointment.staff_id ?? undefined,
          appt_date: dayjs(appointment.appt_date),
          start_time: appointment.start_time?.slice(0, 5),
          note: appointment.note,
          custom_fields: appointment.custom_fields ?? {},
        }
        : { appt_date: dayjs().add(1, 'day'), custom_fields: {} },
    )
    setOpen(true)
  }

  useEffect(() => {
    if (searchParams.get('create') !== '1') return
    const next = new URLSearchParams(searchParams)
    next.delete('create')
    setSearchParams(next, { replace: true })
    openModal()
  }, [])

  // Deep-link từ tab Xin nghỉ: ?appointment_id=<id> → mở modal đổi lịch hẹn (đổi KTV phụ trách)
  useEffect(() => {
    const appointmentIdParam = searchParams.get('appointment_id')
    if (!appointmentIdParam) return
    const next = new URLSearchParams(searchParams)
    next.delete('appointment_id')
    setSearchParams(next, { replace: true })
    void (async () => {
      try {
        const item = pickData<Appointment | undefined>(await getAppointmentsId(appointmentIdParam))
        if (!item) { message.warning('Không tìm thấy lịch hẹn'); return }
        openModal(item)
        message.info('Đổi KTV phụ trách sang người khác rồi lưu để hoàn tất chuyển giao lịch hẹn.')
      } catch (err) {
        message.error(errorMessage(err))
      }
    })()
  }, [])

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
    if (appointmentSubmitInFlightRef.current || isSavingAppointment) return
    appointmentSubmitInFlightRef.current = true
    try {
      const values = await form.validateFields()
      const profile = profiles.find((p) => p.id === values.customer_profile_id)
        ?? (selectedProfile?.id === values.customer_profile_id ? selectedProfile : undefined)
      const branchId = profile?.branch_id ?? branchFilter ?? branches[0]?.id
      const payload = {
        customer_profile_id: values.customer_profile_id,
        branch_id: branchId,
        // Gửi staff_id để BE gán/đổi KTV (nếu không gửi thì BE bỏ gán KTV)
        staff_id: values.staff_id || null,
        appt_date: dayjs(values.appt_date).format('YYYY-MM-DD'),
        start_time: values.start_time,
        note: values.note,
        custom_fields: normalizeCustomFieldValues(appointmentCustomFields, values.custom_fields ?? {}, editing?.custom_fields ?? {}),
      }
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
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      appointmentSubmitInFlightRef.current = false
    }
  }

  const doAction = async (fn: () => Promise<unknown>, msg: string) => {
    const key = 'appointments-action'
    message.open({ type: 'loading', content: 'Đang xử lý lịch hẹn, vui lòng chờ…', key, duration: 0 })
    try {
      await fn()
      message.open({ type: 'success', content: msg, key, duration: 2 })
      refresh()
    } catch (err) {
      message.open({ type: 'error', content: errorMessage(err), key, duration: 3 })
    }
  }

  // Lịch hẹn chỉ là hẹn tư vấn — start chỉ chuyển trạng thái, không gắn buổi điều trị
  // nên không cần hỏi custom fields của buổi.
  const beginAppointment = (row: AppointmentRow) => {
    if (!canStartAppointmentToday(row)) {
      message.warning('Chỉ bắt đầu được trong ngày hẹn, sau giờ hẹn')
      return
    }
    void doAction(() => startMutation.mutateAsync({ id: row.id, data: {} }), 'Đã bắt đầu')
  }

  const approve = (row: AppointmentRow) => {
    void doAction(() => approveMutation.mutateAsync({ id: row.id }), 'Đã duyệt')
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

  const appointmentScheduledAt = (row: AppointmentRow) => {
    const date = String(row.appt_date ?? '').slice(0, 10)
    const time = String(row.start_time ?? '').slice(0, 5)
    const scheduledAt = dayjs(`${date}T${time}`)
    return scheduledAt.isValid() ? scheduledAt : null
  }

  const isPastAppointment = (row: AppointmentRow) => {
    const scheduledAt = appointmentScheduledAt(row)
    return !!scheduledAt && scheduledAt.isBefore(dayjs())
  }

  const canStartAppointmentToday = (row: AppointmentRow) => {
    const scheduledAt = appointmentScheduledAt(row)
    return !!scheduledAt && scheduledAt.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD') && !scheduledAt.isAfter(dayjs())
  }

  const activeFilterCount = [dateFilter.some(Boolean), branchFilter, filter !== 'all'].filter(Boolean).length

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({
      date_range: [dateFilter[0] ? dayjs(dateFilter[0]) : null, dateFilter[1] ? dayjs(dateFilter[1]) : null],
      branch_id: branchFilter,
      status: filter,
    })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    const range = values.date_range as [dayjs.Dayjs | null, dayjs.Dayjs | null] | undefined
    setDateFilter([range?.[0] ? range[0].format('YYYY-MM-DD') : null, range?.[1] ? range[1].format('YYYY-MM-DD') : null])
    setBranchFilter(typeof values.branch_id === 'string' && values.branch_id ? values.branch_id : undefined)
    setFilter(typeof values.status === 'string' && values.status ? values.status : 'all')
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    const emptyRange: [string | null, string | null] = [null, null]
    filterForm.resetFields()
    setDateFilter(emptyRange)
    setBranchFilter(undefined)
    setFilter('all')
    setVisibleColumns(DEFAULT_APPOINTMENT_COLUMNS)
    setDraftVisibleColumns(DEFAULT_APPOINTMENT_COLUMNS)
    setPage(1)
  }

  return (
    <>
      <PageTitle
        subtitle="Quản lý lịch hẹn dịch vụ theo lịch hoặc danh sách"
        left={
          <>
            {displayMode === 'calendar' && (
              <>
                <Segmented
                  value={calendarView}
                  options={[{ label: 'Ngày', value: 'day' }, { label: 'Tuần', value: 'week' }]}
                  onChange={(value) => setCalendarView(value as 'day' | 'week')}
                />
              </>
            )}
            <Segmented
              value={displayMode}
              options={[
                { label: 'Lịch', value: 'calendar', icon: <CalendarOutlined /> },
                { label: 'Danh sách', value: 'list', icon: <UnorderedListOutlined /> },
              ]}
              onChange={(value) => setDisplayMode(value as 'calendar' | 'list')}
            />
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={APPOINTMENT_COLUMNS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as string[])}
              filterItems={(
                <>
                  <Form.Item name="date_range" label="Khoảng ngày" className="mb-2.5!">
                    <DatePicker.RangePicker allowEmpty={[true, true]} placeholder={['Từ ngày', 'Đến ngày']} className="w-full!" />
                  </Form.Item>
                  <Form.Item name="branch_id" label="Cơ sở" className="mb-2.5!">
                    <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                  </Form.Item>
                  <Form.Item name="status" label="Trạng thái" className="mb-0!">
                    <Select options={FILTERS} />
                  </Form.Item>
                </>
              )}
            />
          </>
        }
        right={
          <Can I="CREATE" a="APPOINTMENT">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm lịch hẹn
            </Button>
          </Can>
        }
      >
        Lịch hẹn
      </PageTitle>
      {displayMode === 'calendar' ? (
        <div style={{ overflowX: 'auto', border: '1px solid var(--brand-border-soft, #ECEFEA)', borderRadius: 12, background: '#fff' }}>
          {calendarAppointmentsQuery.isFetching ? (
            <div style={{ padding: 32, textAlign: 'center' }}>Đang tải lịch hẹn…</div>
          ) : calendarView === 'day' ? (
            <div style={{ minWidth: 420 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(190px, 1fr)', position: 'sticky', top: 0, zIndex: 2, background: 'var(--brand-primary)', borderBottom: '1px solid var(--brand-dark)', color: 'var(--brand-on-primary)' }}>
                <div style={{ padding: 12, fontWeight: 600 }}>{calendarStart.format('DD/MM')}</div>
                <div style={{ padding: 12, borderLeft: '1px solid rgba(255, 255, 255, 0.14)', fontWeight: 600 }}>Lịch hẹn</div>
              </div>
              {CALENDAR_HOURS.map((hour) => (
                <div key={hour} style={{ display: 'grid', gridTemplateColumns: '80px minmax(190px, 1fr)', minHeight: 82, borderBottom: '1px solid #edf1f2' }}>
                  <div style={{ padding: '8px 12px', color: '#849197', fontSize: 12 }}>{String(hour).padStart(2, '0')}:00</div>
                  <div style={{ borderLeft: '1px solid #edf1f2', padding: 5 }}>
                    {calendarRows.filter((row) => dayjs(row.appt_date).isSame(calendarStart, 'day') && Number(row.start_time?.slice(0, 2)) === hour).map((row) => (
                      <AppointmentCalendarCard key={row.id} row={row} onClick={() => setSelectedAppointment(row)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ minWidth: 1160 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(150px, 1fr))', position: 'sticky', top: 0, zIndex: 2, background: 'var(--brand-primary)', borderBottom: '1px solid var(--brand-dark)', color: 'var(--brand-on-primary)' }}>
                <div style={{ padding: 12, fontWeight: 600 }}>Giờ</div>
                {calendarDays.map((date) => <div key={date.format('YYYY-MM-DD')} style={{ padding: 12, borderLeft: '1px solid rgba(255, 255, 255, 0.14)', fontWeight: 600 }}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.day()]} {date.format('DD/MM')}</div>)}
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
      ) : <>
        <Table<AppointmentRow>
          rowKey="id"
          loading={appointmentsQuery.isFetching}
          dataSource={rows}
          scroll={{ x: 950 }}
          pagination={false}
          onRow={(row) => ({
            onClick: () => setSelectedAppointment(row),
            style: { cursor: 'pointer' },
          })}
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
            {
              title: 'Nội dung / Gói',
              key: 'service',
              dataIndex: ['service', 'title'],
              render: (value, row) => (
                <div>
                  <div>{value || (row.treatment_package ? 'Lịch hẹn liệu trình' : 'Hẹn tư vấn')}</div>
                  {row.treatment_package && (
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      Gói: {row.treatment_package.name}
                    </Typography.Text>
                  )}
                  {(treatmentPackageName(row) || treatmentCode(row)) && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {treatmentPackageName(row) ? `Gói KH: ${treatmentPackageName(row)}` : 'Gói liệu trình'}{treatmentCode(row) ? ` · ${treatmentCode(row)}` : ''}
                    </Typography.Text>
                  )}
                </div>
              ),
            },
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
              title: 'Hành động', align: 'center' as const,
              key: 'actions',
              width: 90,
              fixed: 'right' as const,
              render: (_, row) => {
                const confirmThen = (title: string, fn: () => Promise<unknown> | void) =>
                  Modal.confirm({ title, okText: 'Đồng ý', okButtonProps: { danger: true }, cancelText: 'Hủy', onOk: () => fn() })
                return (
                  <RowActionsMenu
                    items={[
                      ...(row.status === 'pending' && canApprove ? [{ key: 'approve', icon: <CheckOutlined />, label: 'Duyệt' }] : []),
                      ...(row.status === 'approved' && canStart ? [{
                        key: 'start',
                        icon: <PlayCircleOutlined />,
                        label: canStartAppointmentToday(row) ? 'Bắt đầu' : 'Bắt đầu (chưa đến giờ hẹn)',
                        disabled: !canStartAppointmentToday(row),
                      }] : []),
                      ...(row.status === 'pending' && canApprove ? [{ key: 'reject', icon: <CloseOutlined />, danger: true, label: 'Từ chối' }] : []),
                      ...(canUpdate && ['pending', 'approved'].includes(row.status ?? '') ? [{ key: 'reschedule', icon: <EditOutlined />, label: 'Đổi lịch' }] : []),
                      ...(row.status === 'approved' && canApprove && isPastAppointment(row) ? [{ key: 'noshow', icon: <MinusCircleOutlined />, label: 'Đánh dấu không đến' }] : []),
                      ...(['pending', 'approved'].includes(row.status ?? '') && canApprove ? [{ key: 'cancel', icon: <StopOutlined />, danger: true, label: 'Hủy lịch hẹn' }] : []),
                    ]}
                    onSelect={(key) => {
                      if (key === 'approve') void approve(row)
                      else if (key === 'start') beginAppointment(row)
                      else if (key === 'reject') reject(row)
                      else if (key === 'reschedule') openModal(row)
                      else if (key === 'noshow') {
                        confirmThen('Đánh dấu khách không đến? (Chỉ ghi nhận; không trừ buổi, không tính phí.)', () =>
                          doAction(() => noShowMutation.mutateAsync({ id: row.id }), 'Đã ghi nhận không đến'))
                      } else if (key === 'cancel') {
                        confirmThen('Hủy lịch hẹn này?', () => doAction(() => cancelMutation.mutateAsync({ id: row.id }), 'Đã hủy'))
                      }
                    }}
                  />
                )
              },
            },
          ] satisfies TableColumnsType<AppointmentRow>).filter((column) => column.key === 'actions' || visibleColumns.includes(String(column.key)))}
        />
      </>}
      {displayMode !== 'calendar' && <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="lịch hẹn" />}

      <AppointmentDetailModal
        appointment={selectedAppointment}
        canStart={canStart}
        isPast={selectedAppointment ? isPastAppointment(selectedAppointment) : false}
        canStartToday={selectedAppointment ? canStartAppointmentToday(selectedAppointment) : false}
        onClose={() => setSelectedAppointment(null)}
        onEdit={(row) => openModal(row)}
        onApprove={(row) => void approve(row)}
        onReject={reject}
        onNoShow={(row) => void doAction(() => noShowMutation.mutateAsync({ id: row.id }), 'Đã ghi nhận không đến')}
        onCancelAppointment={(row) => void doAction(() => cancelMutation.mutateAsync({ id: row.id }), 'Đã hủy')}
        onStart={beginAppointment}
      />

      <AppointmentFormModal
        open={open}
        editing={editing}
        form={form}
        isSaving={isSavingAppointment}
        slots={slots}
        slotsLoading={slotsLoading}
        profilesLoading={profilesQuery.isLoading}
        onCustomerSearch={setCustomerSearchInput}
        onSelectProfile={setSelectedProfile}
        onQuickCustomer={openQuickCustomer}
        profileOptions={profileOptions}
        staffOptions={staffOptions}
        selectedCustomerId={selectedCustomerId}
        selectedDate={selectedDate}
        appointmentCustomFields={appointmentCustomFields}
        onCancel={() => setOpen(false)}
        onSubmit={submit}
      />
      <QuickCustomerModal
        open={quickCustomerOpen}
        form={quickCustomerForm}
        branches={branches}
        onCancel={() => setQuickCustomerOpen(false)}
        onOk={() => void submitQuickCustomer()}
      />
    </>
  )
}