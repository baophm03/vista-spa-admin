import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Can, useAbility } from '@casl/react'
import {
  Button,
  Form,
  Grid,
  Input,
  Modal,
  Alert,
  Drawer,
  Segmented,
  Select,
  Tabs,
  Tag,
  message,
} from 'antd'
import {
  CalendarOutlined,
  CheckOutlined,
  CloseOutlined,
  UserSwitchOutlined,
  EditOutlined,
  FilterOutlined,
  LeftOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  StopOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

import PageTitle from '@/components/base/PageTitle'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { useBrandDateTime } from '@/themeRuntime'
import type { Appointment } from '@/api/models/appointment'
import type { Branch } from '@/api/models/branch'
import type { GetAppointmentsAdminParams } from '@/api/models/getAppointmentsAdminParams'
import { getAppointmentsAvailableSlots, getGetAppointmentsAdminQueryKey, useGetAppointmentsAdmin, usePostAppointmentsAdmin, usePostAppointmentsIdStartAdmin, usePutAppointmentsIdAdmin, usePutAppointmentsIdCompleteAdmin, usePutAppointmentsIdApproveAdmin, usePutAppointmentsIdCancelAdmin, usePutAppointmentsIdNoShowAdmin, usePutAppointmentsIdRejectAdmin, getAppointmentsIdAdmin } from '@/api/endpoints/appointments'
import { getGetUsersCustomersAdminQueryKey, postUsersCustomersAdmin, useGetUsersCustomersAdmin } from '@/api/endpoints/customers'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import AppointmentDetailModal from './components/AppointmentDetailModal'
import AppointmentStaffModal from './components/AppointmentStaffModal'
import AppointmentFormModal from './components/AppointmentFormModal'
import AppointmentsCalendar from './components/AppointmentsCalendar'
import AppointmentsTable from './components/AppointmentsTable'
import AppointmentCalendarFilterPanel from './components/AppointmentCalendarFilterPanel'
import QuickCustomerModal from './components/QuickCustomerModal'
import { STATUS_META } from './components/constants'
import type { AppointmentRow, ProfileRow, Slot } from './components/constants'
import CalendarToolbar, { type CalendarView } from '../schedule/calendar/CalendarToolbar'
import MiniMonthCalendar from '../schedule/calendar/MiniMonthCalendar'
import { appointmentDay, fetchCalendarAppointments, getCalendarDays, getPeriodLabel, timeInMinutes } from './calendar'
import { useGetStaffScheduleDatesAdmin } from '@/api/endpoints/staff'
import type { StaffScheduleDate, ShiftTemplate } from '../schedule/types'

const EMPTY_ROWS: AppointmentRow[] = []

interface UsersRowsPick {
  rows?: {
    id: string
    zalo_name?: string
    email?: string
    branch_id?: string
    user_roles?: { role?: { role_name?: string; code?: string } }[]
  }[]
}

export default function Appointments() {
  const queryClient = useQueryClient()
  const { getDateTimeParts } = useBrandDateTime()
  const [searchParams, setSearchParams] = useSearchParams()
  const ability = useAbility()
  const canApprove = ability.can('APPROVE' as never, 'APPOINTMENT')
  const canUpdate = ability.can('UPDATE' as never, 'APPOINTMENT')
  const canStart = ability.can('START' as never, 'APPOINTMENT')
  // Mobile (<768px): bộ điều khiển riêng theo Figma "Mobile / Lịch hẹn"
  const isMobile = !Grid.useBreakpoint().md
  // Mặc định mở ở dạng lịch
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [calendarDate, setCalendarDate] = useState(() => dayjs())
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [hiddenCalendarStaff, setHiddenCalendarStaff] = useState<Set<string>>(() => new Set())
  const [unassignedVisible, setUnassignedVisible] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState('all')

  const [branchFilter, setBranchFilter] = useState<string | undefined>()
  const [open, setOpen] = useState(false)
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null)
  // Gán / đổi KTV — mọi trạng thái
  const [staffTarget, setStaffTarget] = useState<AppointmentRow | null>(null)
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

  const calendarDays = useMemo(() => getCalendarDays(calendarDate, calendarView), [calendarDate, calendarView])
  const calendarParams: GetAppointmentsAdminParams = {
    from_date: calendarDays[0].format('YYYY-MM-DD'),
    to_date: calendarDays[calendarDays.length - 1].format('YYYY-MM-DD'),
    status: filter === 'all' ? undefined : filter,
    branch_id: branchFilter,
  }
  const calendarAppointmentsQuery = useQuery({
    queryKey: [...getGetAppointmentsAdminQueryKey(), 'calendar', calendarParams],
    queryFn: ({ signal }) => fetchCalendarAppointments(calendarParams, signal),
  })
  const allCalendarRows = calendarAppointmentsQuery.data ?? EMPTY_ROWS
  const shiftsQuery = useGetStaffScheduleDatesAdmin({
    from_date: calendarParams.from_date,
    to_date: calendarParams.to_date,
    branch_id: branchFilter,
  }, { query: { enabled: displayMode === 'calendar' && calendarView !== 'month', retry: false } })
  const shiftHourRange = useMemo(() => {
    const shifts = pickData<Array<StaffScheduleDate & { shift_template?: ShiftTemplate & { is_deleted?: boolean } }> | undefined>(shiftsQuery.data) ?? []
    let start = Infinity
    let end = -Infinity
    for (const shift of shifts) {
      const template = shift.shift_template
      if (shift.is_active === false || hiddenCalendarStaff.has(shift.staff_id) || !template || template.is_deleted) continue
      const from = timeInMinutes(template.start_time)
      const to = timeInMinutes(template.end_time)
      if (from === null || to === null || to <= from) continue
      start = Math.min(start, from)
      end = Math.max(end, to)
    }
    return start < end ? { start, end } : undefined
  }, [shiftsQuery.data, hiddenCalendarStaff])
  const calendarRows = useMemo(() => {
    return allCalendarRows.filter((row) => row.staff_id
      ? !hiddenCalendarStaff.has(row.staff_id)
      : unassignedVisible)
  }, [allCalendarRows, hiddenCalendarStaff, unassignedVisible])
  // Chế độ Danh sách: phân trang server-side trên TOÀN BỘ lịch hẹn (không giới hạn
  // theo kỳ đang xem) — đúng kỳ vọng "danh sách đầy đủ có trang 1 2 3…"
  const listParams: GetAppointmentsAdminParams = {
    page,
    limit,
    status: filter === 'all' ? undefined : filter,
    branch_id: branchFilter,
  }
  const listQuery = useGetAppointmentsAdmin(listParams, { query: { enabled: displayMode === 'list' } })
  const listTotal = pickMeta(listQuery.data)?.total ?? 0
  const listPage = page
  const listRows = (pickData<AppointmentRow[] | undefined>(listQuery.data) ?? EMPTY_ROWS) as AppointmentRow[]
  const eventDates = useMemo(() => new Set(calendarRows.map(appointmentDay)), [calendarRows])

  useEffect(() => {
    const timer = window.setTimeout(() => setCustomerSearch(customerSearchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [customerSearchInput])

  const profilesQuery = useGetUsersCustomersAdmin({ page: 1, limit: 50, q: customerSearch || undefined })

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
      const normalized = (value: string | null | undefined) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
      const roleCode = normalized(role?.code)
      const roleName = normalized(role?.role_name)
      // Code 'staff' là chuẩn hiện tại (role cũ từng là 'ktv'); role_name dự phòng ('Kỹ thuật viên / ...')
      return roleCode === 'staff' || roleCode === 'ktv' || roleName.includes('ktv') || roleName.includes('ky thuat vien') || roleName === 'technician'
    }))
    .map((person) => ({ id: person.id, label: person.zalo_name || person.email || person.id, branchId: person.branch_id })), [allUsers])
  const staffNames = new Map(staffOptions.map(({ id, label }) => [id, label]))
  const staffName = (row: AppointmentRow) => row.staff_id
    ? row.staff?.zalo_name || staffNames.get(row.staff_id) || row.staff_id
    : 'Chưa phân công'
  const calendarStaff = new Map(staffOptions
    .filter((person) => !branchFilter || person.branchId === branchFilter)
    .map(({ id, label }) => [id, label]))
  for (const row of allCalendarRows) {
    if (row.staff_id) calendarStaff.set(row.staff_id, staffName(row))
  }
  const createMutation = usePostAppointmentsAdmin()
  const rescheduleMutation = usePutAppointmentsIdAdmin()
  const approveMutation = usePutAppointmentsIdApproveAdmin()
  const rejectMutation = usePutAppointmentsIdRejectAdmin()
  const noShowMutation = usePutAppointmentsIdNoShowAdmin()
  const cancelMutation = usePutAppointmentsIdCancelAdmin()
  const startMutation = usePostAppointmentsIdStartAdmin()
  const completeMutation = usePutAppointmentsIdCompleteAdmin()

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
  const currentDateTime = getDateTimeParts(new Date())
  const modalTimeOptions = [...new Set(slots.map((slot) => slot.start_time.slice(0, 5)))]
    .filter((time) => !currentDateTime || `${selectedDate}T${time}` > `${currentDateTime.date}T${currentDateTime.time}`)
    .sort()
    .map((time) => ({ value: time, label: time }))

  const disablePastDate = (date: dayjs.Dayjs) => {
    const today = getDateTimeParts(new Date())?.date
    return !!today && date.format('YYYY-MM-DD') < today
  }

  const openModal = (appointment?: Appointment, createDate?: dayjs.Dayjs) => {
    if (createDate && disablePastDate(createDate)) {
      message.warning('Chọn ngày hẹn từ hôm nay trở đi')
      return
    }
    const now = getDateTimeParts(new Date())
    const editDate = appointment?.appt_date.slice(0, 10)
    const editTime = appointment?.start_time?.slice(0, 5)
    const editDateIsPast = !!editDate && !!now && editDate < now.date
    const editTimeIsPast = editDateIsPast || (!!now && editDate === now.date && !!editTime && editTime <= now.time)
    setEditing(appointment ?? null)
    setSlots([])
    setPickStaffFirst(false)
    slotRequest.current += 1
    previousSlotCriteria.current = ''
    form.resetFields()
    setCustomerSearchInput('')
    setCustomerSearch('')
    const profileFromAppointment = (appointment as AppointmentRow | undefined)?.user
    setSelectedProfile(appointment
      ? profiles.find((profile) => profile.id === appointment.user_id)
      ?? (profileFromAppointment?.id ? {
        id: profileFromAppointment.id,
        full_name: profileFromAppointment.full_name,
        phone: profileFromAppointment.phone,
      } : null)
      : null)
    form.setFieldsValue(
      appointment
        ? {
          user_id: appointment.user_id,
          staff_id: appointment.staff_id ?? undefined,
          branch_id: appointment.branch_id ?? undefined,
          appt_date: editDateIsPast ? undefined : dayjs(editDate),
          start_time: editTimeIsPast ? undefined : editTime,
          note: appointment.note,
          custom_fields: appointment.custom_fields ?? {},
        }
        : { appt_date: createDate ?? dayjs(now?.date).add(1, 'day'), branch_id: branchFilter ?? branches[0]?.id, custom_fields: {} },
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
      const response = await postUsersCustomersAdmin(values as never)
      const created = pickData<ProfileRow | undefined>(response)
      if (!created?.id) throw new Error('Không nhận được hồ sơ khách hàng vừa tạo')
      setSelectedProfile(created)
      form.setFieldValue('user_id', created.id)
      setCustomerSearchInput('')
      setCustomerSearch('')
      setQuickCustomerOpen(false)
      message.success('Đã tạo khách hàng và chọn vào lịch hẹn')
      void queryClient.invalidateQueries({ queryKey: getGetUsersCustomersAdminQueryKey() })
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
        user_id: values.user_id,
        branch_id: branchId,
        // Gửi staff_id để BE gán/đổi KTV (nếu không gửi thì BE bỏ gán KTV)
        staff_id: values.staff_id || null,
        appt_date: dayjs(values.appt_date).format('YYYY-MM-DD'),
        start_time: values.start_time,
        note: values.note,
        custom_fields: normalizeCustomFieldValues(appointmentCustomFields, values.custom_fields ?? {}, editing?.custom_fields ?? {}),
      }
      const now = getDateTimeParts(new Date())
      if (now && `${payload.appt_date}T${payload.start_time}` <= `${now.date}T${now.time}`) {
        form.setFields([{ name: 'start_time', errors: ['Giờ hẹn phải sau thời điểm hiện tại'] }])
        return
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
    void doAction(() => startMutation.mutateAsync({ id: row.id }), 'Đã bắt đầu')
  }

  const completeAppointment = (row: AppointmentRow) => {
    void doAction(() => completeMutation.mutateAsync({ id: row.id }), 'Đã hoàn tất')
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
          ...(row.status === 'in_progress' && canStart ? [{ key: 'complete', icon: <CheckOutlined />, label: 'Hoàn tất' }] : []),
          ...(row.status === 'pending' && canApprove ? [{ key: 'reject', icon: <CloseOutlined />, danger: true, label: 'Từ chối' }] : []),
          ...(canUpdate ? [{ key: 'staff', icon: <UserSwitchOutlined />, label: row.staff_id ? 'Đổi KTV' : 'Gán KTV' }] : []),
          ...(canUpdate && ['pending', 'approved'].includes(row.status ?? '') ? [{ key: 'reschedule', icon: <EditOutlined />, label: 'Đổi lịch' }] : []),
          ...(row.status === 'approved' && canApprove && isPastAppointment(row) ? [{ key: 'noshow', icon: <MinusCircleOutlined />, label: 'Đánh dấu không đến' }] : []),
          ...(['pending', 'approved'].includes(row.status ?? '') && canApprove ? [{ key: 'cancel', icon: <StopOutlined />, danger: true, label: 'Hủy lịch hẹn' }] : []),
        ]}
        onSelect={(key) => {
          if (key === 'approve') void approve(row)
          else if (key === 'start') beginAppointment(row)
          else if (key === 'complete') completeAppointment(row)
          else if (key === 'staff') setStaffTarget(row)
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

  const changeCalendarDate = (date: dayjs.Dayjs) => {
    setCalendarDate(date)
    setPage(1)
  }
  const changeCalendarView = (view: CalendarView) => {
    setCalendarView(view)
    setPage(1)
  }
  const changeBranch = (value?: string) => {
    setBranchFilter(value)
    setHiddenCalendarStaff(new Set())
    setUnassignedVisible(true)
    setPage(1)
  }
  const toggleCalendarStaff = (staffId: string) => {
    setPage(1)
    setHiddenCalendarStaff((current) => {
      const next = new Set(current)
      if (next.has(staffId)) next.delete(staffId)
      else next.add(staffId)
      return next
    })
  }
  const toggleAllCalendarStaff = (visible: boolean) => {
    setPage(1)
    setHiddenCalendarStaff(visible ? new Set() : new Set(calendarStaff.keys()))
  }
  const canCreate = ability.can('CREATE' as never, 'APPOINTMENT')
  const createButton = (
    <Can I="CREATE" a="APPOINTMENT">
      <Button type="primary" className="h-9! shrink-0 rounded-lg! px-3.5! text-[13px]! font-semibold! shadow-none!" icon={<PlusOutlined />} onClick={() => openModal()} aria-label="Thêm lịch hẹn">
        Thêm lịch hẹn
      </Button>
    </Can>
  )
  const calendarFilterCount = [Boolean(branchFilter), hiddenCalendarStaff.size > 0, !unassignedVisible, filter !== 'all'].filter(Boolean).length
  const hasCalendarFilters = calendarFilterCount > 0
  const calendarMonth = (onSelectDate: (date: dayjs.Dayjs) => void) => (
    <MiniMonthCalendar
      value={calendarDate}
      view={calendarView}
      onSelect={onSelectDate}
      onMonthChange={changeCalendarDate}
      eventDates={eventDates}
      eventLabel="có lịch hẹn"
    />
  )

  const calendarFilterPanel = (
    <AppointmentCalendarFilterPanel
      branches={branches}
      staff={Array.from(calendarStaff, ([id, label]) => ({ id, label }))}
      branchFilter={branchFilter}
      hiddenStaff={hiddenCalendarStaff}
      unassignedVisible={unassignedVisible}
      statusFilter={filter}
      activeFilterCount={calendarFilterCount}
      onBranchChange={changeBranch}
      onToggleStaff={toggleCalendarStaff}
      onToggleAllStaff={toggleAllCalendarStaff}
      onToggleUnassigned={() => {
        setUnassignedVisible((visible) => !visible)
        setPage(1)
      }}
      onStatusChange={(value) => { setFilter(value); setPage(1) }}
      onReset={() => {
        changeBranch(undefined)
        setFilter('all')
        setPage(1)
      }}
    />
  )

  const calendarToolbar = (
    <CalendarToolbar
      compact
      anchor={calendarDate}
      onAnchorChange={changeCalendarDate}
      view={calendarView}
      onViewChange={changeCalendarView}
      periodLabel={getPeriodLabel(calendarDate, calendarView, calendarDays)}
      activeFilterCount={calendarFilterCount}
      branches={[]}
      branchFilter={branchFilter}
      onBranchChange={changeBranch}
      onRefresh={refresh}
      refreshing={calendarAppointmentsQuery.isFetching}
      leftPanelOpen={filterDrawerOpen}
      onToggleLeftPanel={() => setFilterDrawerOpen((open) => !open)}
    />
  )

  // Khối điều khiển mobile theo Figma "Mobile / Lịch hẹn":
  // hàng 1: segmented Ngày/Tuần + Lịch/Danh sách — hàng 2: ‹ pill ngày › — hàng 3: 2 select lọc
  const mobileNavBtnStyle = {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 10,
    border: '1px solid var(--brand-border-soft)',
    background: '#fff',
    color: 'var(--brand-primary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    padding: 0,
  } as const
  const shiftMobilePeriod = (dir: 1 | -1) =>
    changeCalendarDate(calendarDate.add(dir, calendarView === 'day' ? 'day' : calendarView === 'week' ? 'week' : 'month'))
  // Gom gọn còn 2 hàng: hàng 1 = phạm vi + kiểu hiển thị + nút phễu (mở drawer
  // chứa lịch tháng mini, lọc cơ sở, trạng thái, KTV); hàng 2 = điều hướng kỳ.
  const mobileControls = (
    <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Phạm vi Ngày/Tuần/Tháng: dropdown cho gọn, chỉ hiện ở chế độ Lịch */}
        {displayMode === 'calendar' && (
          <Select
            aria-label="Phạm vi"
            className="mobile-filter-select"
            style={{ width: 104, flexShrink: 0, height: 44 }}
            value={calendarView}
            onChange={(value) => changeCalendarView(value as CalendarView)}
            options={[{ value: 'day', label: 'Ngày' }, { value: 'week', label: 'Tuần' }, { value: 'month', label: 'Tháng' }]}
          />
        )}
        <Segmented
          aria-label="Kiểu hiển thị"
          value={displayMode}
          onChange={(value) => { setDisplayMode(value as 'calendar' | 'list'); setPage(1) }}
          options={[
            { value: 'calendar', icon: <CalendarOutlined aria-label="Lịch" /> },
            { value: 'list', icon: <UnorderedListOutlined aria-label="Danh sách" /> },
          ]}
          style={{ height: 44, borderRadius: 12, padding: 4 }}
          className="mobile-segmented"
        />
        <button
          type="button"
          aria-label="Ngày và bộ lọc"
          style={{ ...mobileNavBtnStyle, position: 'relative', ...(calendarFilterCount > 0 ? { background: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: '#fff' } : {}) }}
          onClick={() => setFilterDrawerOpen(true)}
        >
          <FilterOutlined />
          {calendarFilterCount > 0 && (
            <span
              style={{
                position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8,
                background: '#fff', border: '1px solid var(--brand-primary)', color: 'var(--brand-primary)',
                fontSize: 10, fontWeight: 600, lineHeight: '14px', textAlign: 'center' as const,
              }}
            >
              {calendarFilterCount}
            </span>
          )}
        </button>
        {/* Nút thêm chuyển từ header xuống cùng hàng */}
        {canCreate && (
          <button
            type="button"
            aria-label="Thêm lịch hẹn"
            style={{
              ...mobileNavBtnStyle,
              flex: 1,
              width: 'auto',
              minWidth: 0,
              gap: 6,
              background: 'var(--brand-primary)',
              borderColor: 'var(--brand-primary)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap' as const,
            }}
            onClick={() => openModal()}
          >
            <PlusOutlined />
            Thêm
          </button>
        )}
      </div>
      {displayMode === 'calendar' && <div style={{ display: 'flex', gap: 8 }}>
        {/* Giữ chức năng "Hôm nay" như toolbar desktop */}
        <button
          type="button"
          style={{ ...mobileNavBtnStyle, width: 'auto', padding: '0 10px', fontSize: 13, fontWeight: 500 }}
          onClick={() => changeCalendarDate(dayjs())}
        >
          Hôm nay
        </button>
        <button type="button" aria-label="Kỳ trước" style={mobileNavBtnStyle} onClick={() => shiftMobilePeriod(-1)}>
          <LeftOutlined />
        </button>
        <button
          type="button"
          onClick={() => setFilterDrawerOpen(true)}
          style={{
            flex: 1,
            minWidth: 0,
            height: 44,
            borderRadius: 10,
            border: '1px solid var(--brand-border-soft)',
            background: '#fff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--brand-primary)',
          }}
        >
          <CalendarOutlined />
          {calendarDays[0].format('DD/MM')} → {calendarDays[calendarDays.length - 1].format('DD/MM')}
        </button>
        <button type="button" aria-label="Kỳ sau" style={mobileNavBtnStyle} onClick={() => shiftMobilePeriod(1)}>
          <RightOutlined />
        </button>
        {/* Giữ chức năng làm mới dữ liệu như toolbar desktop */}
        <button
          type="button"
          aria-label="Làm mới dữ liệu"
          style={mobileNavBtnStyle}
          onClick={refresh}
        >
          <ReloadOutlined spin={calendarAppointmentsQuery.isFetching} />
        </button>
      </div>}
    </div>
  )

  return (
    <div className={displayMode === 'calendar' ? 'md:flex md:h-full md:min-h-0 md:flex-col' : undefined}>
      <div className="mb-2 grid min-w-0 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
        <PageTitle
          className="col-span-2 col-start-1 row-start-1 mb-0! sm:col-span-1"
          subtitle="Quản lý lịch hẹn và theo dõi các buổi hẹn của khách hàng"
        >
          Lịch hẹn
        </PageTitle>
        {/* Toolbar kỳ chỉ có nghĩa ở chế độ Lịch — Danh sách giờ phân trang toàn bộ */}
        {!isMobile && displayMode === 'calendar' && (
          <div className="col-span-2 col-start-1 row-start-3 min-w-0 sm:row-start-2">
            {calendarToolbar}
          </div>
        )}
        <div className="col-span-2 col-start-1 row-start-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          {!isMobile && (
            <Tabs
              aria-label="Hiển thị lịch hẹn"
              size="small"
              tabBarGutter={16}
              activeKey={displayMode}
              items={[{ key: 'calendar', label: 'Lịch' }, { key: 'list', label: 'Danh sách' }]}
              onChange={(value) => setDisplayMode(value as 'calendar' | 'list')}
              className="[&_.ant-tabs-nav]:mb-0! [&_.ant-tabs-nav]:before:hidden [&_.ant-tabs-tab]:h-9 [&_.ant-tabs-tab]:px-1! [&_.ant-tabs-tab]:py-0! [&_.ant-tabs-tab]:text-[13px]! [&_.ant-tabs-content-holder]:hidden"
            />
          )}
          {!isMobile && createButton}
        </div>
      </div>
      {isMobile && mobileControls}
      <Drawer title="Ngày và bộ lọc" placement="right" size="min(344px, 100vw)" open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}>
        <div className="flex flex-col gap-4">
          {calendarMonth((date) => { changeCalendarDate(date); setFilterDrawerOpen(false) })}
          {calendarFilterPanel}
        </div>
      </Drawer>
      {/* Mobile + xem Tuần/Tháng: dạng agenda dọc nhóm theo ngày — không cuộn ngang,
          card đọc rõ tên + giờ. Xem Ngày vẫn dùng lưới giờ (1 cột vừa màn hình). */}
      {displayMode === 'calendar' && isMobile && calendarView !== 'day' && (
        <section aria-label="Lịch hẹn theo ngày">
          {calendarAppointmentsQuery.isPending ? (
            <MobileCards rows={[]} rowKey={() => ''} renderCard={() => null} loading emptyText="" />
          ) : calendarRows.length === 0 ? (
            <MobileCards rows={[]} rowKey={() => ''} renderCard={() => null} emptyText="Chưa có lịch hẹn trong kỳ này" />
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {calendarDays.map((day) => {
                const key = day.format('YYYY-MM-DD')
                const items = calendarRows
                  .filter((row) => appointmentDay(row) === key)
                  .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
                if (!items.length) return null
                const weekday = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day.day()]
                const isToday = key === dayjs().format('YYYY-MM-DD')
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {/* Khối ngày kiểu lịch: thứ + số ngày nổi bật */}
                      <span
                        style={{
                          width: 40,
                          height: 44,
                          borderRadius: 10,
                          flexShrink: 0,
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isToday ? 'var(--brand-primary)' : '#f2e5f4',
                          color: isToday ? '#fff' : 'var(--brand-primary)',
                          lineHeight: 1.1,
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>{weekday}</span>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{day.format('DD')}</span>
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? 'var(--brand-primary)' : '#282335' }}>
                        {isToday ? 'Hôm nay' : `Tháng ${day.format('M')}`}
                        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: '#655E71' }}>
                          {items.length} lịch hẹn
                        </span>
                      </span>
                      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--brand-border-soft)' }} />
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {items.map((row) => {
                        const startMinute = timeInMinutes(row.start_time)
                        const endMinute = timeInMinutes(row.end_time)
                        const duration = startMinute !== null && endMinute !== null && endMinute > startMinute ? endMinute - startMinute : null
                        return (
                          // Theo Figma "Vista Admin / Thẻ lịch hẹn": tên đậm + tag góc phải,
                          // divider, các hàng label/value — cùng ngôn ngữ với thẻ khách hàng
                          <div
                            key={row.id}
                            className="mobile-card"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedAppointment(row)}
                          >
                            <div className="mobile-card-head">
                              <div className="mobile-card-title">{row.user?.full_name || '—'}</div>
                              <Tag color={STATUS_META[row.status as keyof typeof STATUS_META]?.color} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                                {STATUS_META[row.status as keyof typeof STATUS_META]?.label ?? row.status}
                              </Tag>
                            </div>
                            <div className="mobile-card-rows">
                              <MobileCardRow
                                label="Thời gian"
                                value={
                                  <span style={{ color: 'var(--brand-primary)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                                    {row.start_time?.slice(0, 5) ?? '—'}
                                    {duration ? <span style={{ fontWeight: 500, color: '#655E71' }}> ({duration} phút)</span> : null}
                                  </span>
                                }
                              />
                              <MobileCardRow label="KTV phụ trách" value={staffName(row)} />
                              <MobileCardRow label="Cơ sở" value={branchName(row.branch_id)} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
      {displayMode === 'calendar' && !(isMobile && calendarView !== 'day') && (
        <section aria-label="Lịch hẹn theo thời gian" className="flex min-w-0 flex-col overflow-hidden md:min-h-0 md:flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 gap-3">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden rounded-lg border border-[var(--brand-border-soft)] bg-white shadow-sm">
              {calendarAppointmentsQuery.isError && (
                <Alert type="error" showIcon title="Không tải được lịch hẹn"
                  description={errorMessage(calendarAppointmentsQuery.error)}
                  action={<Button onClick={() => void calendarAppointmentsQuery.refetch()}>Thử lại</Button>} />
              )}
              {(!calendarAppointmentsQuery.isError || calendarAppointmentsQuery.data) && (
                <AppointmentsCalendar
                  rows={calendarRows}
                  loading={calendarAppointmentsQuery.isPending}
                  filtered={hasCalendarFilters}
                  hourHeight={68}
                  hourRange={shiftHourRange}
                  view={calendarView}
                  anchor={calendarDate}
                  days={calendarDays}
                  staffName={staffName}
                  selectedKey={selectedAppointment?.id ?? null}
                  onSelect={setSelectedAppointment}
                  onSelectDay={(date) => { changeCalendarDate(date); changeCalendarView('day') }}
                  onViewWeek={() => changeCalendarView('week')}
                  onCreate={canCreate ? (date) => openModal(undefined, date) : undefined}
                />
              )}
            </div>
          </div>
        </section>
      )}
      {displayMode === 'list' && (
        <>
          {listQuery.isError && (
            <Alert type="error" showIcon title="Không tải được lịch hẹn"
              description={errorMessage(listQuery.error)}
              action={<Button onClick={() => void listQuery.refetch()}>Thử lại</Button>} />
          )}
          {(!listQuery.isError || listQuery.data) && (
            <AppointmentsTable
              rows={listRows}
              loading={listQuery.isPending}
              branchName={branchName}
              staffName={staffName}
              onRowClick={setSelectedAppointment}
              renderActions={renderRowActions}
            />
          )}
        </>
      )}
      {displayMode !== 'calendar' && <ListPagination page={listPage} limit={limit} total={listTotal} onChange={setPage} noun="lịch hẹn" />}

      <AppointmentDetailModal
        appointment={selectedAppointment}
        canStart={canStart}
        isPast={selectedAppointment ? isPastAppointment(selectedAppointment) : false}
        canStartToday={selectedAppointment ? canStartAppointmentToday(selectedAppointment) : false}
        staffName={staffName}
        branchName={branchName}
        onClose={() => setSelectedAppointment(null)}
        onEdit={(row) => openModal(row)}
        onApprove={(row) => void approve(row)}
        onReject={reject}
        onNoShow={(row) => void doAction(() => noShowMutation.mutateAsync({ id: row.id }), 'Đã ghi nhận không đến')}
        onCancelAppointment={(row) => void doAction(() => cancelMutation.mutateAsync({ id: row.id }), 'Đã hủy')}
        onStart={beginAppointment}
        onAssignStaff={setStaffTarget}
        onComplete={completeAppointment}
      />

      <AppointmentStaffModal
        appointment={staffTarget}
        staffOptions={staffOptions.filter((staff) => !staffTarget?.branch_id || !staff.branchId || staff.branchId === staffTarget.branch_id)}
        onClose={() => setStaffTarget(null)}
        onSaved={refresh}
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
        disablePastDate={disablePastDate}
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
    </div>
  )
}
