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
  Space,
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
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
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
  usePostAppointmentsIdStart,
  usePutAppointmentsId,
  usePutAppointmentsIdApprove,
  usePutAppointmentsIdCancel,
  usePutAppointmentsIdNoShow,
  usePutAppointmentsIdReject,
} from '@/api/endpoints/appointments'
import { getGetCustomerProfilesQueryKey, postCustomerProfiles, useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { useGetCustomerTreatments } from '@/api/endpoints/customer-treatments'
import { useGetService } from '@/api/endpoints/services'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetBranches } from '@/api/endpoints/branches'
import AppointmentDetailModal from './components/AppointmentDetailModal'
import AppointmentFormModal from './components/AppointmentFormModal'
import QuickCustomerModal from './components/QuickCustomerModal'
import AppointmentStartModal from './components/AppointmentStartModal'
import { STATUS_META, treatmentCode, treatmentPackageName } from './components/constants'
import type { AppointmentRow, ProfileRow, Slot, StaffRow, TreatmentWithMeta } from './components/constants'

const purchasedTreatmentPackageName = (treatment: TreatmentWithMeta) => {
  const snapshotName = (treatment.package_snapshot as Record<string, unknown> | undefined)?.name
  return (typeof snapshotName === 'string' && snapshotName.trim() ? snapshotName : undefined)
    ?? treatment.package_type?.name
    ?? 'Gói liệu trình'
}

const treatmentToOption = (treatment: TreatmentWithMeta) => {
  const name = purchasedTreatmentPackageName(treatment)
  const code = treatment.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const purchaseDate = treatment.created_at ? dayjs(treatment.created_at).format('DD/MM/YYYY') : null
  const remaining = treatment.quota_type === 'SESSIONS'
    ? `còn ${Math.max(0, (treatment.sessions_total ?? 0) + (treatment.sessions_bonus ?? 0) - (treatment.sessions_used ?? 0))} buổi`
    : treatment.quota_type === 'VALUE'
      ? `còn ${Math.max(0, (treatment.value_total ?? 0) - (treatment.value_used ?? 0)).toLocaleString('vi-VN')}₫`
      : 'Trọn gói'
  return { value: treatment.id, label: `${name} · Mã G-${code}${purchaseDate ? ` · mua ${purchaseDate}` : ''} — ${remaining}` }
}

// Chỉ giữ gói chứa dịch vụ của lịch (gói không cấu hình dịch vụ nào thì không chặn)
const treatmentsForService = (treatments: TreatmentWithMeta[], serviceId?: string | null) =>
  treatments.filter((t) => !serviceId || !t.allowed_service_ids?.length || t.allowed_service_ids.includes(serviceId))

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
        {row.service?.title || (row.customer_treatment_id ? 'Buổi liệu trình' : 'Chưa có dịch vụ')} · {row.service?.duration_minutes || 60} phút
      </Typography.Text>
      {treatmentPackageName(row) && (
        <Typography.Text style={{ display: 'block', fontSize: 11, color: '#71005C' }}>
          Gói: {treatmentPackageName(row)}{treatmentCode(row) ? ` · ${treatmentCode(row)}` : ''}
        </Typography.Text>
      )}
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
  const [searchParams, setSearchParams] = useSearchParams()
  const ability = useAbility()
  const canApprove = ability.can('APPROVE' as never, 'APPOINTMENT')
  const canUpdate = ability.can('UPDATE' as never, 'APPOINTMENT')
  const canStart = ability.can('START' as never, 'APPOINTMENT')
  // Desktop mở mặc định ở dạng lịch; chỉ mobile (dưới breakpoint md = 768px) mới mặc định danh sách
  const [displayMode, setDisplayMode] = useState<'calendar' | 'list'>(
    () => (window.innerWidth < 768 ? 'list' : 'calendar'),
  )
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
  const [filterForm] = Form.useForm()
  const appointmentCustomFields = useCustomFieldDefinitions('APPOINTMENT')
  const sessionCustomFields = useCustomFieldDefinitions('SESSION')
  const slotRequest = useRef(0)
  const previousSlotCriteria = useRef('')
  const appointmentSubmitInFlightRef = useRef(false)
  const startSubmitInFlightRef = useRef(false)
  const selectedCustomerId = Form.useWatch('customer_profile_id', form)
  const selectedServiceId = Form.useWatch('service_id', form)
  const selectedDateValue = Form.useWatch('appt_date', form)
  const selectedDate = selectedDateValue ? dayjs(selectedDateValue).format('YYYY-MM-DD') : ''
  const selectedStartTime = Form.useWatch('start_time', form)
  const selectedStartTreatmentId = Form.useWatch('customer_treatment_id', startForm)

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

  // AP-03/BR-11 — gói liệu trình đang ACTIVE của khách để gắn vào lịch hẹn:
  // KTV bấm Bắt đầu ca sẽ tự sinh buổi liệu trình và khi hoàn tất sẽ trừ buổi/tiền của gói
  const activeTreatmentsQuery = useGetCustomerTreatments(
    { page: 1, limit: 100, customer_profile_id: selectedCustomerId || undefined, status: 'ACTIVE' },
    { query: { enabled: open && !!selectedCustomerId } },
  )
  const activeTreatments = useMemo(() => pickData<TreatmentWithMeta[]>(activeTreatmentsQuery.data) ?? [], [activeTreatmentsQuery.data])
  const activeTreatmentOptions = useMemo(() => activeTreatments.map(treatmentToOption), [activeTreatments])
  const selectedTreatmentId = Form.useWatch('customer_treatment_id', form)
  const selectedTreatment = activeTreatments.find((t) => t.id === selectedTreatmentId)
  // Chọn gói sẽ giới hạn ô Dịch vụ: chỉ dịch vụ thuộc gói; gói 1 dịch vụ thì khóa ô luôn
  const packageServiceIds = selectedTreatment?.allowed_service_ids
  const serviceOptions = packageServiceIds?.length ? services.filter((s) => packageServiceIds.includes(s.id)) : services
  const serviceLockedByPackage = !!selectedTreatment && !!packageServiceIds?.length && packageServiceIds.length === 1

  // Gói để gắn ngay lúc Bắt đầu ca (lịch chưa gắn gói) — modal hỏi trước khi tạo buổi
  const startTreatmentsQuery = useGetCustomerTreatments(
    { page: 1, limit: 100, customer_profile_id: startingAppointment?.customer_profile_id || undefined, status: 'ACTIVE' },
    { query: { enabled: !!startingAppointment && !startingAppointment.customer_treatment_id } },
  )
  const startTreatmentOptions = useMemo(() => {
    const treatments = pickData<TreatmentWithMeta[]>(startTreatmentsQuery.data) ?? []
    return treatmentsForService(treatments, startingAppointment?.service_id).map(treatmentToOption)
  }, [startTreatmentsQuery.data, startingAppointment?.service_id])
  const startingServicePrice = Number(startingAppointment?.service?.price ?? 0)
  const startingServicePriceMax = Math.max(startingServicePrice, Number(startingAppointment?.service?.price_max ?? startingServicePrice))
  const startingServiceHasRange = startingServicePriceMax > startingServicePrice
  const serviceForAppointmentForm = services.find((service) => service.id === selectedServiceId)
  const serviceFormPrice = Number(serviceForAppointmentForm?.price ?? 0)
  const serviceFormPriceMax = Math.max(serviceFormPrice, Number(serviceForAppointmentForm?.price_max ?? serviceFormPrice))
  const serviceFormHasRange = serviceFormPriceMax > serviceFormPrice

  const isRefreshingAppointments = displayMode === 'calendar'
    ? calendarAppointmentsQuery.isFetching
    : appointmentsQuery.isFetching
  const isSavingAppointment = createMutation.isPending || rescheduleMutation.isPending

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
          customer_treatment_id: appointment.customer_treatment_id ?? undefined,
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
        service_id: values.service_id,
        staff_id: values.staff_id || undefined,
        customer_treatment_id: editing ? (values.customer_treatment_id ?? null) : (values.customer_treatment_id || undefined),
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

  const beginAppointment = (row: AppointmentRow) => {
    if (!canStartAppointmentToday(row)) {
      message.warning('Chỉ bắt đầu được trong ngày hẹn, sau giờ hẹn')
      return
    }
    // Nếu không gắn gói thì đây là dịch vụ lẻ: hồ sơ, ảnh và thanh toán lưu theo lịch hẹn.
    if (row.customer_treatment_id && sessionCustomFields.length === 0) {
      void doAction(() => startMutation.mutateAsync({ id: row.id, data: {} }), 'Đã bắt đầu')
      return
    }
    startForm.resetFields()
    const minimum = Number(row.service?.price ?? 0)
    const maximum = Math.max(minimum, Number(row.service?.price_max ?? minimum))
    startForm.setFieldsValue({
      custom_fields: {},
      customer_treatment_id: undefined,
      service_amount: !row.customer_treatment_id && maximum > minimum ? undefined : row.service_amount ?? minimum,
    })
    setStartingAppointment(row)
  }

  const submitStart = async () => {
    if (!startingAppointment || startSubmitInFlightRef.current) return
    startSubmitInFlightRef.current = true
    try {
      const values = await startForm.validateFields()
      const sessionFields = normalizeCustomFieldValues(sessionCustomFields, values.custom_fields ?? {})
      const needsPackage = !startingAppointment.customer_treatment_id
      await startMutation.mutateAsync({
        id: startingAppointment.id,
        data: {
          ...(sessionFields ? { session_custom_fields: sessionFields } : {}),
          ...(needsPackage && values.customer_treatment_id ? { customer_treatment_id: values.customer_treatment_id } : {}),
          ...(!startingAppointment.customer_treatment_id && !values.customer_treatment_id && startingServiceHasRange
            ? { service_amount: values.service_amount }
            : {}),
        },
      })
      message.success('Đã bắt đầu')
      refresh()
      setStartingAppointment(null)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    } finally {
      startSubmitInFlightRef.current = false
    }
  }

  const approve = async (row: AppointmentRow) => {
    let availableStaffIds: string[] = []
    try {
      if (!row.service_id) {
        message.warning('Lịch hẹn chưa có dịch vụ để kiểm tra KTV rảnh')
        return
      }
      const loadingKey = 'appointments-approve-check'
      message.open({ type: 'loading', content: 'Đang kiểm tra giờ và KTV rảnh…', key: loadingKey, duration: 0 })
      const response = await getAppointmentsAvailableSlots({
        branch_id: row.branch_id,
        service_id: row.service_id,
        date: dayjs(row.appt_date).format('YYYY-MM-DD'),
        exclude_appointment_id: row.id,
      })
      const availableSlots = (pickData<Slot[] | undefined>(response) ?? []) as Slot[]
      availableStaffIds = availableSlots.find((slot) => slot.start_time.slice(0, 5) === row.start_time?.slice(0, 5))?.staff_ids ?? []
      message.destroy('appointments-approve-check')
    } catch (err) {
      message.open({ type: 'error', content: errorMessage(err), key: 'appointments-approve-check', duration: 3 })
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
        </div>
      ),
      onOk: () => {
        if (!staffId) {
          message.warning('Cần chọn KTV để duyệt')
          return Promise.reject(new Error('no staff'))
        }
        return doAction(
          () => approveMutation.mutateAsync({ id: row.id, data: { staff_id: staffId! } as never }),
          'Đã duyệt',
        )
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

  const activeFilterCount = [dateFilter.some(Boolean), staffFilter, branchFilter, filter !== 'all'].filter(Boolean).length

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({
      date_range: [dateFilter[0] ? dayjs(dateFilter[0]) : null, dateFilter[1] ? dayjs(dateFilter[1]) : null],
      staff_id: staffFilter,
      branch_id: branchFilter,
      status: filter,
    })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    const range = values.date_range as [dayjs.Dayjs | null, dayjs.Dayjs | null] | undefined
    setDateFilter([range?.[0] ? range[0].format('YYYY-MM-DD') : null, range?.[1] ? range[1].format('YYYY-MM-DD') : null])
    setStaffFilter(typeof values.staff_id === 'string' && values.staff_id ? values.staff_id : undefined)
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
    setStaffFilter(undefined)
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
        extra={
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              loading={isRefreshingAppointments}
              aria-label={isRefreshingAppointments ? 'Đang tải lịch hẹn' : 'Tải lại lịch hẹn'}
              title={isRefreshingAppointments ? 'Đang tải lịch hẹn…' : 'Tải lại lịch hẹn'}
              onClick={refresh}
            >
              {isRefreshingAppointments ? 'Đang tải…' : 'Tải lại'}
            </Button>
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
      <div className="desktop-only" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {displayMode === 'calendar' && (
          <Space wrap>
            <Segmented
              value={calendarView}
              options={[{ label: 'Ngày', value: 'day' }, { label: 'Tuần', value: 'week' }]}
              onChange={(value) => setCalendarView(value as 'day' | 'week')}
            />
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
            <Button
              aria-label="Khoảng thời gian tiếp theo"
              icon={<RightOutlined />}
              onClick={() => setCalendarDate((current) => current.add(calendarView === 'week' ? 7 : 1, 'day'))}
            />
          </Space>
        )}
        <Space wrap style={{ marginLeft: 'auto' }}>
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
                <Form.Item name="date_range" label="Khoảng ngày" style={{ marginBottom: 10 }}>
                  <DatePicker.RangePicker allowEmpty={[true, true]} placeholder={['Từ ngày', 'Đến ngày']} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="staff_id" label="KTV" style={{ marginBottom: 10 }}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Tất cả KTV"
                    options={staffs.map((staff) => ({ value: staff.id, label: staff.zalo_name || staff.email }))}
                  />
                </Form.Item>
                <Form.Item name="branch_id" label="Cơ sở" style={{ marginBottom: 10 }}>
                  <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                </Form.Item>
                <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 0 }}>
                  <Select options={FILTERS} />
                </Form.Item>
              </>
            )}
          />
          <Segmented
            value={displayMode}
            options={[
              { label: 'Lịch', value: 'calendar', icon: <CalendarOutlined /> },
              { label: 'Danh sách', value: 'list', icon: <UnorderedListOutlined /> },
            ]}
            onChange={(value) => setDisplayMode(value as 'calendar' | 'list')}
          />
        </Space>
      </div>
      {displayMode === 'calendar' ? (
        <div style={{ overflowX: 'auto', border: '1px solid var(--brand-border-soft, #ECEFEA)', borderRadius: 12, background: '#fff' }}>
          {calendarAppointmentsQuery.isFetching ? (
            <div style={{ padding: 32, textAlign: 'center' }}>Đang tải lịch hẹn…</div>
          ) : calendarView === 'day' ? (
            <div style={{ minWidth: Math.max(760, (calendarStaffs.length + (calendarRows.some((row) => !row.staff_id) ? 1 : 0)) * 210 + 80) }}>
              <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(${Math.max(1, calendarStaffs.length + (calendarRows.some((row) => !row.staff_id) ? 1 : 0))}, minmax(190px, 1fr))`, position: 'sticky', top: 0, zIndex: 2, background: 'var(--brand-primary)', borderBottom: '1px solid var(--brand-dark)', color: 'var(--brand-on-primary)' }}>
                <div style={{ padding: 12, fontWeight: 600 }}>{calendarStart.format('DD/MM')}</div>
                {calendarStaffs.length || calendarRows.some((row) => !row.staff_id) ? (
                  <>
                    {calendarStaffs.map((staff) => <div key={staff.id} style={{ padding: 12, borderLeft: '1px solid rgba(255, 255, 255, 0.14)', fontWeight: 600 }}>{staff.zalo_name || 'Nhân viên'}</div>)}
                    {calendarRows.some((row) => !row.staff_id) && <div style={{ padding: 12, borderLeft: '1px solid rgba(255, 255, 255, 0.14)', fontWeight: 600 }}>Chưa gán KTV</div>}
                  </>
                ) : <div style={{ padding: 12, borderLeft: '1px solid rgba(255, 255, 255, 0.14)', opacity: 0.75 }}>Chưa có lịch hẹn</div>}
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
          className="desktop-only"
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
              title: 'Dịch vụ / Gói',
              key: 'service',
              dataIndex: ['service', 'title'],
              render: (value, row) => (
                <div>
                  <div>{value || (row.customer_treatment_id ? 'Buổi liệu trình' : '—')}</div>
                  {!row.customer_treatment_id && row.service && (
                    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                      {(() => {
                        const minimum = Number(row.service?.price ?? 0)
                        const maximum = Math.max(minimum, Number(row.service?.price_max ?? minimum))
                        const waitingForPrice = maximum > minimum && ['pending', 'approved'].includes(String(row.status))
                        return waitingForPrice
                          ? `Dịch vụ lẻ · Chốt khi bắt đầu: ${minimum.toLocaleString('vi-VN')}–${maximum.toLocaleString('vi-VN')} ₫`
                          : `Dịch vụ lẻ · Giá chốt ${Number(row.service_amount ?? minimum).toLocaleString('vi-VN')} ₫`
                      })()}
                    </Typography.Text>
                  )}
                  {(treatmentPackageName(row) || treatmentCode(row)) && (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {treatmentPackageName(row) ? `Gói: ${treatmentPackageName(row)}` : 'Gói liệu trình'}{treatmentCode(row) ? ` · ${treatmentCode(row)}` : ''}
                    </Typography.Text>
                  )}
                </div>
              ),
            },
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
        {displayMode === 'list' && <MobileCards
          rows={rows}
          rowKey={(row) => row.id}
          onCardClick={(row) => setSelectedAppointment(row)}
          loading={appointmentsQuery.isFetching}
          emptyText="Chưa có lịch hẹn"
          renderCard={(row) => {
            const status = row.status as AppointmentStatus
            return (
              <>
                <div className="mobile-card-head">
                  <div>
                    <div className="mobile-card-title">{row.customer_profile?.full_name || 'Khách hàng'}</div>
                    <div className="mobile-card-sub">{row.customer_profile?.phone || '—'}</div>
                  </div>
                  <Tag color={STATUS_META[status]?.color}>{STATUS_META[status]?.label ?? row.status}</Tag>
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Dịch vụ" value={row.service?.title || (row.customer_treatment_id ? 'Buổi liệu trình' : '—')} />
                  {treatmentPackageName(row) && <MobileCardRow label="Gói" value={treatmentPackageName(row)!} />}
                  <MobileCardRow label="Thời gian" value={`${dayjs(row.appt_date).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`} />
                  <MobileCardRow label="KTV" value={row.staff?.zalo_name || 'Chưa gán'} />
                  <MobileCardRow label="Nguồn" value={row.created_via === 'APP' ? 'Mini App' : 'Nhân viên'} />
                </div>
              </>
            )
          }}
        />}
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
        servicesLoading={servicesQuery.isLoading}
        serviceOptions={serviceOptions}
        serviceLockedByPackage={serviceLockedByPackage}
        serviceFormPrice={serviceFormPrice}
        serviceFormPriceMax={serviceFormPriceMax}
        serviceFormHasRange={serviceFormHasRange}
        selectedTreatment={selectedTreatment}
        activeTreatmentsLoading={activeTreatmentsQuery.isLoading}
        activeTreatmentOptions={activeTreatmentOptions}
        activeTreatments={activeTreatments}
        staffs={staffs}
        selectedCustomerId={selectedCustomerId}
        selectedServiceId={selectedServiceId}
        selectedDate={selectedDate}
        selectedStartTime={selectedStartTime}
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
      <AppointmentStartModal
        appointment={startingAppointment}
        form={startForm}
        startMutation={startMutation}
        startTreatmentsQuery={startTreatmentsQuery}
        startTreatmentOptions={startTreatmentOptions}
        selectedStartTreatmentId={selectedStartTreatmentId}
        startingServiceHasRange={startingServiceHasRange}
        startingServicePrice={startingServicePrice}
        startingServicePriceMax={startingServicePriceMax}
        sessionCustomFields={sessionCustomFields}
        onCancel={() => setStartingAppointment(null)}
        onSubmit={() => void submitStart()}
      />
    </>
  )
}