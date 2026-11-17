import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Can, useAbility } from '@casl/react'
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Segmented,
  message,
} from 'antd'
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
import PeriodNavigator from '@/components/base/PeriodNavigator'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import type { Appointment } from '@/api/models/appointment'
import type { Branch } from '@/api/models/branch'
import { getAppointmentsAvailableSlots, getGetAppointmentsAdminQueryKey, useGetAppointmentsAdmin, usePostAppointmentsAdmin, usePostAppointmentsIdStartAdmin, usePutAppointmentsIdAdmin, usePutAppointmentsIdApproveAdmin, usePutAppointmentsIdCancelAdmin, usePutAppointmentsIdNoShowAdmin, usePutAppointmentsIdRejectAdmin, getAppointmentsIdAdmin } from '@/api/endpoints/appointments'
import { getGetCustomerProfilesAdminQueryKey, postCustomerProfilesAdmin, useGetCustomerProfilesAdmin } from '@/api/endpoints/customer-profiles'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import AppointmentDetailModal from './components/AppointmentDetailModal'
import AppointmentFormModal from './components/AppointmentFormModal'
import AppointmentsCalendar from './components/AppointmentsCalendar'
import AppointmentsTable from './components/AppointmentsTable'
import QuickCustomerModal from './components/QuickCustomerModal'
import type { AppointmentRow, ProfileRow, Slot } from './components/constants'

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

interface UsersRowsPick {
  rows?: {
    id: string
    zalo_name?: string
    email?: string
    branch_id?: string
    user_roles?: { role?: { role_name?: string } }[]
  }[]
}

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
  const [calendarDate, setCalendarDate] = useState(() => dayjs())
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<[string | null, string | null]>([null, null])
  const [branchFilter, setBranchFilter] = useState<string | undefined>()
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
  const formBranchId = Form.useWatch('branch_id', form) as string | undefined
  const formStaffId = Form.useWatch('staff_id', form) as string | undefined
  // Chế độ "chọn KTV trước": pick KTV → khung giờ chỉ còn các giờ KTV đó trống
  const [pickStaffFirst, setPickStaffFirst] = useState(false)
  const [quickCustomerForm] = Form.useForm()
  const appointmentCustomFields = useCustomFieldDefinitions('APPOINTMENT')
  const slotRequest = useRef(0)
  const previousSlotCriteria = useRef('')
  const appointmentSubmitInFlightRef = useRef(false)
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

  const appointmentsQuery = useGetAppointmentsAdmin(listParams as never, { query: { enabled: displayMode === 'list' } })
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
  const calendarAppointmentsQuery = useGetAppointmentsAdmin(calendarParams as never, { query: { enabled: displayMode === 'calendar' } })
  const calendarRows = useMemo(() => pickData<AppointmentRow[] | undefined>(calendarAppointmentsQuery.data) ?? [], [calendarAppointmentsQuery.data])
  const calendarDays = Array.from({ length: calendarView === 'week' ? 7 : 1 }, (_, index) => calendarStart.add(index, 'day'))

  useEffect(() => {
    const timer = window.setTimeout(() => setCustomerSearch(customerSearchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [customerSearchInput])

  const profilesQuery = useGetCustomerProfilesAdmin({ page: 1, limit: 50, q: customerSearch || undefined })

  const profiles = useMemo(() => (pickData<ProfileRow[] | undefined>(profilesQuery.data) ?? []) as ProfileRow[], [profilesQuery.data])
  const profileOptions = useMemo(() => {
    const options = [...profiles]
    if (selectedProfile && !options.some((profile) => profile.id === selectedProfile.id)) options.unshift(selectedProfile)
    return options
  }, [profiles, selectedProfile])
  const branchesQuery = useGetBranchesAdmin({ status: 'active' })
  const branches = useMemo(() => (pickData<Branch[] | undefined>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])

  // Danh sách KTV để gán/đổi người phụ trách lịch hẹn (luồng xin nghỉ của KTV cũ)
  const usersQuery = useGetUsersAdmin({ currentPage: 1, pageSize: 500, has_role: true })
  const allUsers = (pickData<UsersRowsPick | undefined>(usersQuery.data)?.rows ?? [])
  const staffOptions = useMemo(() => allUsers
    .filter((person) => (person.user_roles ?? []).some(({ role }) => {
      const roleName = String(role?.role_name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
      return roleName.includes('ktv') || roleName.includes('ky thuat vien') || roleName === 'technician'
    }))
    .map((person) => ({ id: person.id, label: person.zalo_name || person.email || person.id, branchId: person.branch_id })), [allUsers])

  const createMutation = usePostAppointmentsAdmin()
  const rescheduleMutation = usePutAppointmentsIdAdmin()
  const approveMutation = usePutAppointmentsIdApproveAdmin()
  const rejectMutation = usePutAppointmentsIdRejectAdmin()
  const noShowMutation = usePutAppointmentsIdNoShowAdmin()
  const cancelMutation = usePutAppointmentsIdCancelAdmin()
  const startMutation = usePostAppointmentsIdStartAdmin()

  const isSavingAppointment = createMutation.isPending || rescheduleMutation.isPending

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetAppointmentsAdminQueryKey() })
  }, [queryClient])

  useEffect(() => {
    const requestId = ++slotRequest.current
    // Lịch hẹn lấy cơ sở từ ô chọn "Cơ sở" trên form (khách hàng không còn gắn cơ sở)
    const branchId = formBranchId ?? branchFilter ?? branches[0]?.id
    const criteria = `${branchId ?? ''}|${selectedDate ?? ''}|${pickStaffFirst ? `ktv-first|${formStaffId ?? ''}` : 'time-first'}`
    if (previousSlotCriteria.current && criteria !== previousSlotCriteria.current) {
      // Chế độ KTV-first giữ KTV khách/admin đã chọn; chế độ thường reset như cũ
      if (!pickStaffFirst) form.setFieldValue('staff_id', undefined)
    }
    previousSlotCriteria.current = criteria
    setSlots([])
    if (!open || !branchId || !selectedDate) {
      setSlotsLoading(false)
      return
    }

    setSlotsLoading(true)
    // Không truyền start_time → nhận FULL khung giờ trong ngày:
    // - switch tắt: tất cả giờ làm việc của các KTV tại cơ sở
    // - switch bật (truyền staff_id): chỉ giờ trống của đúng KTV đó
    getAppointmentsAvailableSlots({
      branch_id: branchId,
      date: selectedDate,
      exclude_appointment_id: editing?.id,
      ...(pickStaffFirst && formStaffId ? { staff_id: formStaffId } : {}),
    })
      .then((response) => {
        if (requestId !== slotRequest.current) return
        const available = (pickData<Slot[] | undefined>(response) ?? []) as Slot[]
        setSlots(available)
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
  }, [open, selectedDate, editing?.id, form, formBranchId, branchFilter, branches, pickStaffFirst, formStaffId])

  // Khung giờ cho select "Giờ hẹn" — suy ra từ slot của ngày đã chọn (đã theo đúng chế độ switch)
  const modalTimeOptions = useMemo(() => {
    const times = [...new Set(slots.map((slot) => slot.start_time.slice(0, 5)))].sort()
    return times.map((t) => ({ value: t, label: t }))
  }, [slots])

  const openModal = (appointment?: Appointment) => {
    setEditing(appointment ?? null)
    setSlots([])
    setPickStaffFirst(false)
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
      } : null)
      : null)
    form.setFieldsValue(
      appointment
        ? {
          customer_profile_id: appointment.customer_profile_id,
          staff_id: appointment.staff_id ?? undefined,
          branch_id: appointment.branch_id ?? undefined,
          appt_date: dayjs(appointment.appt_date),
          start_time: appointment.start_time?.slice(0, 5),
          note: appointment.note,
          custom_fields: appointment.custom_fields ?? {},
        }
        : { appt_date: dayjs().add(1, 'day'), branch_id: branchFilter ?? branches[0]?.id, custom_fields: {} },
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
        const item = pickData<Appointment | undefined>(await getAppointmentsIdAdmin(appointmentIdParam))
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
    setQuickCustomerOpen(true)
  }

  const submitQuickCustomer = async () => {
    try {
      const values = await quickCustomerForm.validateFields()
      const response = await postCustomerProfilesAdmin(values as never)
      const created = pickData<ProfileRow | undefined>(response)
      if (!created?.id) throw new Error('Không nhận được hồ sơ khách hàng vừa tạo')
      setSelectedProfile(created)
      form.setFieldValue('customer_profile_id', created.id)
      setCustomerSearchInput('')
      setCustomerSearch('')
      setQuickCustomerOpen(false)
      message.success('Đã tạo khách hàng và chọn vào lịch hẹn')
      void queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesAdminQueryKey() })
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
      // Cơ sở lịch hẹn: ưu tiên lựa chọn trên form, fallback về bộ lọc/cơ sở đầu tiên
      const branchId = values.branch_id ?? branchFilter ?? branches[0]?.id
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

  const branchName = (id?: string) => branches.find((branch) => branch.id === id)?.name ?? '—'

  // Menu hành động của từng dòng trong bảng — truyền vào AppointmentsTable qua renderActions
  const renderRowActions = (row: AppointmentRow) => {
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
  }

  // Navigator kiểu /schedule: [<] [khoảng ngày] [>] — dùng chung cho cả chế độ Lịch và Danh sách
  const navAnchor = displayMode === 'calendar'
    ? [calendarStart, calendarEnd] as const
    : (dateFilter[0] && dateFilter[1]
      ? [dayjs(dateFilter[0]), dayjs(dateFilter[1])] as const
      : [mondayOf(dayjs()), mondayOf(dayjs()).add(6, 'day')] as const)
  const navStep = displayMode === 'calendar' && calendarView === 'day' ? 1 : 7
  const navPrev = () => {
    if (displayMode === 'calendar') setCalendarDate((date) => date.subtract(navStep, 'day'))
    else {
      const start = mondayOf(navAnchor[0].subtract(navStep, 'day'))
      setDateFilter([start.format('YYYY-MM-DD'), start.add(6, 'day').format('YYYY-MM-DD')])
      setPage(1)
    }
  }
  const navNext = () => {
    if (displayMode === 'calendar') setCalendarDate((date) => date.add(navStep, 'day'))
    else {
      const start = mondayOf(navAnchor[0].add(navStep, 'day'))
      setDateFilter([start.format('YYYY-MM-DD'), start.add(6, 'day').format('YYYY-MM-DD')])
      setPage(1)
    }
  }
  const navApply = (value: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    const start = value?.[0]
    if (!start) return
    if (displayMode === 'calendar') setCalendarDate(calendarView === 'week' ? mondayOf(start) : start)
    else {
      const end = value?.[1] ?? start
      setDateFilter([start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')])
      setPage(1)
    }
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
            <PeriodNavigator
              value={[navAnchor[0], navAnchor[1]]}
              onChange={navApply}
              onPrev={navPrev}
              onNext={navNext}
            />
            <Segmented
              value={displayMode}
              options={[
                { label: 'Lịch', value: 'calendar', icon: <CalendarOutlined /> },
                { label: 'Danh sách', value: 'list', icon: <UnorderedListOutlined /> },
              ]}
              onChange={(value) => setDisplayMode(value as 'calendar' | 'list')}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn cơ sở"
              style={{ width: 180 }}
              value={branchFilter}
              onChange={(value) => { setBranchFilter(value); setPage(1) }}
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            />
            <Select
              style={{ width: 160 }}
              value={filter}
              onChange={(value) => { setFilter(value); setPage(1) }}
              options={FILTERS}
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
        <AppointmentsCalendar
          rows={calendarRows}
          loading={calendarAppointmentsQuery.isFetching}
          view={calendarView}
          days={calendarDays}
          branchName={branchName}
          onSelect={setSelectedAppointment}
        />
      ) : (
        <AppointmentsTable
          rows={rows}
          loading={appointmentsQuery.isFetching}
          branchName={branchName}
          onRowClick={setSelectedAppointment}
          renderActions={renderRowActions}
        />
      )}
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
        slotsLoading={slotsLoading}
        profilesLoading={profilesQuery.isLoading}
        onCustomerSearch={setCustomerSearchInput}
        onSelectProfile={setSelectedProfile}
        onQuickCustomer={openQuickCustomer}
        profileOptions={profileOptions}
        allStaffOptions={staffOptions}
        timeOptions={modalTimeOptions}
        pickStaffFirst={pickStaffFirst}
        onPickStaffFirstChange={setPickStaffFirst}
        selectedDate={selectedDate}
        branches={branches}
        appointmentCustomFields={appointmentCustomFields}
        onCancel={() => setOpen(false)}
        onSubmit={submit}
      />
      <QuickCustomerModal
        open={quickCustomerOpen}
        form={quickCustomerForm}
        onCancel={() => setQuickCustomerOpen(false)}
        onOk={() => void submitQuickCustomer()}
      />
    </>
  )
}
