import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Grid, Input, Modal, Progress, Select, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { MenuProps } from 'antd'
import { CheckCircleOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu, { type RowActionItem } from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { paginateRows } from '@/utils/listTable'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import { errorMessage, pickData } from '@/api/helpers'
import { customInstance } from '@/api/mutator/custom-instance'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { TreatmentPackage } from '@/api/models/treatmentPackage'
import { getCustomerProfiles, useGetCustomerProfiles, useGetCustomerProfilesIdPoints } from '@/api/endpoints/customer-profiles'
import { getGetRewardRedemptionsQueryKey, getRewardRedemptions } from '@/api/endpoints/rewards'
import {
  getTreatmentCustomersIdAvailableSlots,
  getTreatmentCustomersIdPayments,
  getTreatmentCustomersIdSessions,
  getTreatmentCustomersId,
  getGetTreatmentCustomersQueryKey,
  postTreatmentCustomersIdSessions,
  useGetTreatmentCustomers,
  useGetTreatmentCustomersIdAdjustments,
  usePostTreatmentCustomers,
  usePostTreatmentCustomersIdConvert,
  usePostTreatmentCustomersIdPayments,
  usePutTreatmentCustomersIdAdjustments,
  usePutTreatmentCustomersIdCancel,
  usePutTreatmentCustomersIdFinish,
} from '@/api/endpoints/treatment-customers'
import { useGetService } from '@/api/endpoints/services'
import { useGetTreatmentPackages } from '@/api/endpoints/services'
import { useGetLookupLists } from '@/api/endpoints/lookup-lists'
import {
  useGetCustomerProfilesIdAvailableDiscounts,
  usePostTreatmentCustomersIdApplyDiscount,
  usePostTreatmentCustomersIdManualDiscount,
} from '@/api/endpoints/discounts'
import type { DiscountRule } from '@/api/models'
import { usePostTreatmentCustomersIdRedeemPoints } from '@/api/endpoints/treatment-customers'
import { useGetUsers } from '@/api/endpoints/users'
import { useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { Can, useAbility } from '@casl/react'
import TreatmentAdjustModal from './components/TreatmentAdjustModal'
import TreatmentConvertModal from './components/TreatmentConvertModal'
import TreatmentHistoryModal from './components/TreatmentHistoryModal'
import TreatmentPaymentModal from './components/TreatmentPaymentModal'
import TreatmentAddSessionModal from './components/TreatmentAddSessionModal'
import TreatmentCreateModal from './components/TreatmentCreateModal'
import TreatmentPromoModal from './components/TreatmentPromoModal'
import TreatmentDetailModal from './components/TreatmentDetailModal'
import {
  CUSTOMER_TREATMENT_COLUMN_OPTIONS,
  DEFAULT_VISIBLE_COLUMNS,
  FILTERS,
  HIDDEN_TREATMENT_SYSTEM_FIELDS,
  STATUS_META,
  TREATMENT_SYSTEM_FIELD_LABELS,
  bonusRemainingOf,
  customFieldValueText,
  readableCustomFieldLabel,
  sessionUsage,
  type CustomerTreatmentColumnKey,
  type LookupListRow,
  type PaymentRow,
  type ProfileRow,
  type RewardRedemptionRow,
  type Slot,
  type TreatmentAdjustmentRow,
} from './components/constants'

export default function TreatmentCustomers() {
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const queryClient = useQueryClient()
  const { isAdmin, isReceptionist } = useCustomerProfileAccess()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'CUSTOMER')
  const canApplyReward = ability.can('REDEEM_ADMIN', 'REWARD') && ability.can('READ', 'DISCOUNT')
  const canCreateSessions = ability.can('CREATE', 'SESSION')
  const canReadPayments = ability.can('READ', 'PAYMENT')
  const canSeeDebtSummary = (!isReceptionist || isAdmin)
    && (ability.can('READ' as never, 'REPORT') || ability.can('DEBT.READ' as never, 'REPORT'))
  const customerTreatmentCustomFields = useCustomFieldDefinitions('CUSTOMER_TREATMENT')
  const sessionCustomFields = useCustomFieldDefinitions('SESSION')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [pkgFilter, setPkgFilter] = useState<string>()
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CustomerTreatmentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CustomerTreatmentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  // Mobile (dưới breakpoint md): search thu về nút icon, bộ lọc/tải lại chỉ icon
  const isMobile = !Grid.useBreakpoint().md
  const [searchOpen, setSearchOpen] = useState(false)
  // Modal chi tiết
  const [detailTab, setDetailTab] = useState<'sessions' | 'payments' | 'points'>('sessions')
  const [detail, setDetail] = useState<CustomerTreatment | null>(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [sessionToEdit, setSessionToEdit] = useState<{ treatmentId: string; sessionId: string } | null>(null)
  const [addSessionFor, setAddSessionFor] = useState<CustomerTreatment | null>(null)
  const [addSessionForm] = Form.useForm()
  const [addSessionSlots, setAddSessionSlots] = useState<Slot[]>([])
  const [addSessionSlotsLoading, setAddSessionSlotsLoading] = useState(false)
  const addSessionSlotSequence = useRef(0)
  const addSessionDate = Form.useWatch('scheduled_date', addSessionForm)
  const addSessionTime = Form.useWatch('scheduled_time', addSessionForm)
  const handleSessionFocusHandled = useCallback(() => setSessionToEdit(null), [])
  const [addingSessionId, setAddingSessionId] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  // Gói đang thu tiền — tách khỏi `detail` để thu tiền từ danh sách không bật drawer chi tiết
  const [payTargetId, setPayTargetId] = useState<string | null>(null)
  const [payForm] = Form.useForm()
  // Modal ưu đãi & điểm (DC-06/07 + LY-02)
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoRow, setPromoRow] = useState<CustomerTreatment | null>(null)
  const [applyingRewardId, setApplyingRewardId] = useState<string | null>(null)
  const [promoForm] = Form.useForm()
  const [redeemForm] = Form.useForm()
  const [paymentLookupError, setPaymentLookupError] = useState('')

  const treatmentsQuery = useGetTreatmentCustomers({ page: 1, limit: 500 })
  const rows = (pickData<CustomerTreatment[] | undefined>(treatmentsQuery.data) ?? []) as CustomerTreatment[]

  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const profiles = (pickData<ProfileRow[] | undefined>(profilesQuery.data) ?? []) as ProfileRow[]
  const packagesQuery = useGetTreatmentPackages({ page: 1, limit: 200, is_active: true })
  const packages = (pickData<TreatmentPackage[] | undefined>(packagesQuery.data) ?? []) as TreatmentPackage[]
  const selectedSalePackageId = Form.useWatch('package_id', createForm)
  const selectedSalePackage = packages.find((pkg) => pkg.id === selectedSalePackageId)
  const staffsQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const staffOptions = useMemo(
    () =>
      (((pickData<{ rows?: Array<{ id: string; zalo_name?: string; email?: string }> }>(staffsQuery.data)?.rows ?? [])) as Array<{ id: string; zalo_name?: string; email?: string }>)
        .map((u) => ({ value: u.id, label: `${u.zalo_name || 'Nhân viên'} · ${u.email || u.id.slice(0, 8)}` })),
    [staffsQuery.data],
  )

  const lookupQuery = useGetLookupLists({ key: 'payment.methods', items_is_active: 'true' })
  const paymentLookup = (pickData<LookupListRow[] | undefined>(lookupQuery.data) ?? [])[0] ?? null
  const activePaymentMethods = (paymentLookup?.lookup_items ?? []).filter((item) => item.is_active !== false)
  const paymentMethodLabels = Object.fromEntries((paymentLookup?.lookup_items ?? []).map((item) => [item.code, item.label]))
  const paymentLookupLoading = lookupQuery.isLoading

  useEffect(() => {
    if (lookupQuery.isError) {
      setPaymentLookupError('Không tải được danh mục payment.methods: ' + errorMessage(lookupQuery.error))
      return
    }
    if (lookupQuery.isLoading) return
    const catalog = paymentLookup
    if (!catalog || !catalog.is_active || !catalog.lookup_items?.some((item) => item.is_active !== false)) {
      setPaymentLookupError('Chưa có phương thức thanh toán đang hoạt động trong danh mục payment.methods.')
    } else setPaymentLookupError('')
  }, [lookupQuery.isLoading, lookupQuery.isError, lookupQuery.error, paymentLookup])

  const createMutation = usePostTreatmentCustomers()
  const createInFlightRef = useRef(false)
  const createPaymentMutation = usePostTreatmentCustomersIdPayments()
  const cancelMutation = usePutTreatmentCustomersIdCancel()
  const finishMutation = usePutTreatmentCustomersIdFinish()

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetTreatmentCustomersQueryKey() })
  }, [queryClient])

  const profileOf = (id: string) => profiles.find((p) => p.id === id)
  const profileName = (row: CustomerTreatment) =>
    (row as CustomerTreatment & { customer_profile?: { full_name?: string } }).customer_profile?.full_name
    ?? profileOf(row.customer_profile_id)?.full_name
    ?? 'Khách hàng'
  const profilePhone = (row: CustomerTreatment) =>
    (row as CustomerTreatment & { customer_profile?: { phone?: string } }).customer_profile?.phone ?? profileOf(row.customer_profile_id)?.phone
  const treatmentCode = (row: CustomerTreatment) => row.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const packageName = (row: CustomerTreatment) => {
    const snapshotName = (row.package_snapshot as Record<string, unknown> | undefined)?.name
    const packageTypeName = (row as CustomerTreatment & { package_type?: { name?: string } }).package_type?.name
    return (typeof snapshotName === 'string' && snapshotName.trim() ? snapshotName : undefined)
      ?? packages.find((p) => p.id === row.package_id)?.name
      ?? packageTypeName
      ?? '—'
  }

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (pkgFilter && r.package_id !== pkgFilter) return false
      if (q) {
        const p = profileOf(r.customer_profile_id)
        const shortCode = treatmentCode(r)
        const hay = `${p?.full_name ?? ''} ${p?.phone ?? ''} ${packageName(r)} G-${shortCode} ${shortCode} ${r.id}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filter, pkgFilter, search, profiles, packages])

  const activeFilterCount = Number(filter !== 'all') + Number(!!pkgFilter) + (search ? 1 : 0)
  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ package_id: pkgFilter, status: filter })
    setDraftVisibleColumns(visibleColumns)
  }
  const applySearch = (nextKeyword: string) => {
    setSearchInput(nextKeyword)
    setSearch(nextKeyword.trim())
    setPage(1)
  }
  const applyFilters = (values: Record<string, unknown>) => {
    if (!draftVisibleColumns.length) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setPkgFilter(typeof values.package_id === 'string' ? values.package_id : undefined)
    setFilter(typeof values.status === 'string' ? values.status : 'all')
    setVisibleColumns(draftVisibleColumns)
    setFilterOpen(false)
    setPage(1)
  }
  const clearFilters = () => {
    filterForm.resetFields()
    setPkgFilter(undefined)
    setFilter('all')
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const stats = useMemo(() => ({
    total: rows.length,
    ongoing: rows.filter((r) => r.status === 'ACTIVE').length,
    done: rows.filter((r) => r.status === 'FINISHED').length,
    debt: rows
      .filter((r) => r.status !== 'CANCELLED')
      .reduce((s, r) => s + Number(r.debt_amount ?? 0), 0),
  }), [rows])

  const openDetail = (row: CustomerTreatment) => {
    setDetail(row)
    setDetailTab('sessions')
    if (!canReadPayments) {
      setPayments([])
      setPayLoading(false)
      return
    }
    setPayLoading(true)
    getTreatmentCustomersIdPayments(row.id)
      .then((response) => setPayments((pickData<PaymentRow[] | undefined>(response) ?? []) as PaymentRow[]))
      .catch(() => setPayments([]))
      .finally(() => setPayLoading(false))
  }

  const [searchParams, setSearchParams] = useSearchParams()
  const focusTreatmentId = searchParams.get('treatment_id')
  useEffect(() => {
    if (!focusTreatmentId || treatmentsQuery.isLoading) return
    const row = rows.find((item) => item.id === focusTreatmentId)
    if (!row) return
    openDetail(row)
    const next = new URLSearchParams(searchParams)
    next.delete('treatment_id')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTreatmentId, rows, treatmentsQuery.isLoading])

  const [customerOptions, setCustomerOptions] = useState<ProfileRow[]>([])
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Search khách phía server (BE hỗ trợ ?q=) — debounce 300ms */
  const fetchCustomerOptions = useCallback((q: string) => {
    if (custTimer.current) clearTimeout(custTimer.current)
    custTimer.current = setTimeout(() => {
      getCustomerProfiles({ page: 1, limit: 50, ...(q ? { q } : {}) } as never)
        .then((response) => setCustomerOptions((pickData<ProfileRow[] | undefined>(response) ?? []) as ProfileRow[]))
        .catch(() => undefined)
    }, 300)
  }, [])

  const openCreateModal = () => {
    createForm.setFieldsValue({ customer_profile_id: undefined, package_id: undefined, total_amount: undefined, custom_fields: {} })
    setCreateOpen(true)
    fetchCustomerOptions('')
  }

  const onCreatePackageChange = (id: string) => {
    const pkg = packages.find((p) => p.id === id)
    if (pkg) createForm.setFieldsValue({ total_amount: pkg.list_price ?? undefined })
  }

  const submitCreate = async () => {
    if (createInFlightRef.current || createMutation.isPending) return
    createInFlightRef.current = true
    try {
      const values = await createForm.validateFields()
      const dto = {
        ...values,
        sessions_bonus: values.sessions_bonus != null ? Number(values.sessions_bonus) : undefined,
        expires_at: values.expires_at ? (values.expires_at as Dayjs).format('YYYY-MM-DD') : undefined,
        custom_fields: normalizeCustomFieldValues(customerTreatmentCustomFields, values.custom_fields ?? {}),
      }
      await createMutation.mutateAsync({ data: dto as never })
      message.success('Đã thêm khách vào liệu trình')
      setCreateOpen(false)
      refresh()
    } catch (err) {
      if (!(err as { errorFields?: unknown })?.errorFields) message.error(errorMessage(err))
    } finally {
      createInFlightRef.current = false
    }
  }

  const addSession = (row: CustomerTreatment) => {
    if (addingSessionId !== null) return
    addSessionForm.resetFields()
    addSessionForm.setFieldsValue({ custom_fields: {} })
    addSessionSlotSequence.current += 1
    setAddSessionSlots([])
    setAddSessionFor(row)
  }

  const loadAddSessionSlots = useCallback(async (date: Dayjs) => {
    if (!addSessionFor) return
    const sequence = ++addSessionSlotSequence.current
    setAddSessionSlotsLoading(true)
    try {
      const response = await getTreatmentCustomersIdAvailableSlots(addSessionFor.id, { date: date.format('YYYY-MM-DD') })
      if (sequence !== addSessionSlotSequence.current) return
      const now = dayjs()
      const slots = ((pickData<Slot[] | undefined>(response) ?? []) as Slot[]).filter((slot) => {
        const slotTime = date.hour(Number(slot.start_time.slice(0, 2))).minute(Number(slot.start_time.slice(3, 5))).second(0).millisecond(0)
        return !slotTime.isBefore(now)
      })
      setAddSessionSlots(slots)
      const selectedTime = addSessionForm.getFieldValue('scheduled_time')
      const selectedStaff = addSessionForm.getFieldValue('staff_id')
      const matchingSlot = slots.find((slot) => slot.start_time.slice(0, 5) === selectedTime)
      if (selectedTime && !matchingSlot) addSessionForm.setFieldsValue({ scheduled_time: undefined, staff_id: undefined })
      else if (selectedStaff && !matchingSlot?.staff_ids.includes(selectedStaff)) addSessionForm.setFieldsValue({ staff_id: undefined })
    } catch (err) {
      if (sequence === addSessionSlotSequence.current) {
        setAddSessionSlots([])
        message.warning(errorMessage(err))
      }
    } finally {
      if (sequence === addSessionSlotSequence.current) setAddSessionSlotsLoading(false)
    }
  }, [addSessionFor, addSessionForm])

  const submitNewSession = async () => {
    if (!addSessionFor || addingSessionId !== null) return
    let values: Record<string, unknown>
    try {
      values = await addSessionForm.validateFields()
    } catch (error) {
      if (!(error as { errorFields?: unknown })?.errorFields) message.error(errorMessage(error))
      return
    }
    const scheduledDate = values.scheduled_date as Dayjs | undefined
    const scheduledTime = values.scheduled_time as string | undefined
    const staffId = values.staff_id as string | undefined
    if ((!!scheduledDate || !!scheduledTime || !!staffId) && (!scheduledDate || !scheduledTime || !staffId)) {
      message.error('Để xếp lịch buổi, cần chọn đủ ngày hẹn, giờ hẹn và KTV phụ trách')
      return
    }
    setAddingSessionId(addSessionFor.id)
    try {
      await postTreatmentCustomersIdSessions(addSessionFor.id, {
        ...(scheduledDate && scheduledTime && staffId ? {
          scheduled_at: scheduledDate.hour(Number(scheduledTime.slice(0, 2))).minute(Number(scheduledTime.slice(3, 5))).second(0).millisecond(0).toISOString(),
          staff_id: staffId,
        } : {}),
        custom_fields: normalizeCustomFieldValues(
          sessionCustomFields,
          (values.custom_fields ?? {}) as Record<string, unknown>,
        ) ?? {},
      } as never)
      openDetail(addSessionFor)
      setSessionsRefreshKey((key) => key + 1)
      message.success('Đã tạo buổi mới')
      setAddSessionFor(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setAddingSessionId(null)
    }
  }

  const cancelTreatment = async (row: CustomerTreatment) => {
    try {
      await cancelMutation.mutateAsync({ id: row.id })
      message.success('Đã hủy liệu trình')
      if (detail?.id === row.id) setDetail(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const refreshSelectedDetail = async () => {
    if (!detail) return
    try {
      const fresh = pickData<CustomerTreatment>(await getTreatmentCustomersId(detail.id))
      if (fresh) setDetail(fresh)
    } catch { /* bỏ qua — drawer giữ dữ liệu cũ */ }
  }

  const finishTreatment = async (row: CustomerTreatment) => {
    if ((row.debt_amount ?? 0) > 0) {
      message.error('Gói còn nợ — phải thu đủ trước khi hoàn tất liệu trình')
      return
    }
    try {
      // CT-05 — trả da sớm là hợp lệ, nhưng cảnh báo khi sổ chưa ghi buổi hoàn thành nào
      const sessionsRes = await getTreatmentCustomersIdSessions(row.id)
      const completedCount = (pickData<{ status?: string }[]>(sessionsRes) ?? []).filter((s) => s.status === 'completed').length
      if (completedCount === 0) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: 'Gói chưa có buổi nào hoàn thành',
            content: 'Sổ liệu trình chưa ghi nhận buổi hoàn thành nào. Bạn có chắc muốn trả da / hoàn tất ngay từ bây giờ?',
            okText: 'Vẫn hoàn tất',
            cancelText: 'Hủy',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!confirmed) return
      }
      await finishMutation.mutateAsync({ id: row.id })
      message.success('Đã hoàn tất liệu trình — bắt đầu thời gian bảo hành')
      if (detail?.id === row.id) setDetail(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  // TA — điều chỉnh / chuyển đổi buổi tặng / lịch sử
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustRow, setAdjustRow] = useState<CustomerTreatment | null>(null)
  const [adjustForm] = Form.useForm()
  const adjustType = Form.useWatch('type', adjustForm)
  const adjustAmount = Form.useWatch('amount', adjustForm)
  const adjustMutation = usePutTreatmentCustomersIdAdjustments()
  // TA-01 — đếm buổi "completed" trong sổ liệu trình để đối chiếu khi sửa số buổi đã dùng
  const adjustSessionsQuery = useQuery({
    queryKey: ['adjust-sessions', adjustRow?.id],
    queryFn: ({ signal }) => getTreatmentCustomersIdSessions(adjustRow!.id, signal),
    enabled: adjustOpen && adjustType === 'ADJUST_SESSIONS' && !!adjustRow,
    retry: 1,
  })
  const adjustCompletedCount = (pickData<{ status?: string }[]>(adjustSessionsQuery.data) ?? []).filter(
    (s) => s.status === 'completed',
  ).length
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertRow, setConvertRow] = useState<CustomerTreatment | null>(null)
  const [convertForm] = Form.useForm()
  const convertMutation = usePostTreatmentCustomersIdConvert()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRow, setHistoryRow] = useState<CustomerTreatment | null>(null)
  const [adjustHistoryPage, setAdjustHistoryPage] = useState(1)
  const historyQuery = useGetTreatmentCustomersIdAdjustments(historyRow?.id ?? 'none', {
    query: { enabled: historyOpen && !!historyRow },
  })
  const servicesQuery = useGetService({ is_active: true, limit: 200 })
  const serviceOptions = (pickData<{ services?: { id: string; title?: string }[] }>(servicesQuery.data)?.services ?? [])
    .map((service) => ({ value: service.id, label: service.title || service.id }))

  const openAdjust = (row: CustomerTreatment) => {
    setAdjustRow(row)
    adjustForm.resetFields()
    setAdjustOpen(true)
  }

  const submitAdjust = async () => {
    if (!adjustRow) return
    const values = await adjustForm.validateFields()
    // TA-01 — cảnh báo khi số buổi đã dùng mới lệch với sổ liệu trình (bộ đếm sẽ lệch sổ)
    if (values.type === 'ADJUST_SESSIONS' && !adjustSessionsQuery.isLoading && Number(values.amount) !== adjustCompletedCount) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: 'Số buổi nhập lệch với sổ liệu trình',
          content: `Sổ ghi nhận ${adjustCompletedCount} buổi đã hoàn thành nhưng bạn nhập ${values.amount}. Bộ đếm gói sẽ lệch sổ cho đến khi đối chiếu lại. Tiếp tục?`,
          okText: 'Vẫn ghi điều chỉnh',
          cancelText: 'Hủy',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!confirmed) return
    }
    try {
      await adjustMutation.mutateAsync({
        id: adjustRow.id,
        data: {
          type: values.type,
          reason: values.reason,
          ...(values.type === 'EXTEND_EXPIRY' ? { expires_at: values.expires_at.format('YYYY-MM-DD') } : { amount: values.amount }),
        } as never,
      })
      message.success('Đã ghi điều chỉnh và cập nhật gói')
      setAdjustOpen(false)
      if (detail?.id === adjustRow.id) setDetail(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openConvert = (row: CustomerTreatment) => {
    setConvertRow(row)
    convertForm.resetFields()
    setConvertOpen(true)
  }

  const submitConvert = async () => {
    if (!convertRow) return
    const values = await convertForm.validateFields()
    try {
      await convertMutation.mutateAsync({
        id: convertRow.id,
        data: { service_id: values.service_id, from_sessions: values.from_sessions, reason: values.reason } as never,
      })
      message.success('Đã chuyển buổi tặng sang gói con mới')
      setConvertOpen(false)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openHistory = (row: CustomerTreatment) => {
    setHistoryRow(row)
    setHistoryOpen(true)
    setAdjustHistoryPage(1)
  }

  const submitPayment = async () => {
    const treatmentId = payTargetId ?? detail?.id
    if (!treatmentId) return
    if (paymentLookupLoading || paymentLookupError || activePaymentMethods.length === 0) {
      message.error(paymentLookupError || 'Danh mục phương thức thanh toán chưa sẵn sàng')
      return
    }
    const values = await payForm.validateFields()
    if (!activePaymentMethods.some((item) => item.code === values.method)) {
      message.error('Chọn phương thức thanh toán đang hoạt động')
      return
    }
    try {
      await createPaymentMutation.mutateAsync({ id: treatmentId, data: values as never })
      message.success('Đã ghi nhận thanh toán')
      setPayOpen(false)
      setPayTargetId(null)
      payForm.resetFields()
      await refreshSelectedDetail()
      if (canReadPayments) {
        setPayLoading(true)
        try {
          const response = await getTreatmentCustomersIdPayments(treatmentId)
          setPayments((pickData<PaymentRow[] | undefined>(response) ?? []) as PaymentRow[])
        } catch {
          setPayments([])
        } finally {
          setPayLoading(false)
        }
      }
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  // ===== Ưu đãi & đổi điểm (DC-06/07/08, LY-02) =====
  const promoCustomerProfileId = promoRow?.customer_profile_id
  const availableDiscountsQuery = useGetCustomerProfilesIdAvailableDiscounts(promoCustomerProfileId ?? '', {
    query: { enabled: promoOpen && !!promoCustomerProfileId },
  })
  const availableDiscounts: DiscountRule[] = useMemo(
    () => availableDiscountsQuery.data?.responseData ?? [],
    [availableDiscountsQuery.data],
  )
  const rewardRedemptionsParams = {
    page: 1,
    limit: 100,
    status: 'ISSUED',
    ...(promoCustomerProfileId ? { customer_profile_id: promoCustomerProfileId } : {}),
  }
  const rewardRedemptionsQuery = useQuery({
    queryKey: getGetRewardRedemptionsQueryKey(rewardRedemptionsParams),
    queryFn: async () => getRewardRedemptions(rewardRedemptionsParams),
    enabled: promoOpen && !!promoCustomerProfileId,
  })
  const availableRewardRedemptions = (pickData<RewardRedemptionRow[]>(rewardRedemptionsQuery.data) ?? []) as RewardRedemptionRow[]
  const promoServiceIds = new Set(
    ((promoRow as (CustomerTreatment & { allowed_service_ids?: string[] }) | null)?.allowed_service_ids ?? []).map(String),
  )
  const applicableRewardRedemptions = availableRewardRedemptions.filter((redemption) => {
    const reward = redemption.reward
    if (redemption.status !== 'ISSUED' || reward?.type !== 'BENEFIT' || Number(reward.benefit_amount ?? 0) <= 0) return false
    return !reward.service_id || promoServiceIds.has(String(reward.service_id))
  })
  const applyDiscountMutation = usePostTreatmentCustomersIdApplyDiscount()
  const redeemPointsMutation = usePostTreatmentCustomersIdRedeemPoints()
  const promoPointsQuery = useGetCustomerProfilesIdPoints(promoCustomerProfileId ?? '', {
    query: { enabled: promoOpen && Boolean(promoCustomerProfileId) },
  })
  const promoPointsData = pickData<{
    points?: number
    redemption?: { enabled?: boolean | string; point_value?: number | null; min_percent?: number | null; max_percent?: number | null; balance_max_percent?: number | null }
  }>(promoPointsQuery.data)
  const redeemPointsValue = Number(Form.useWatch('points', redeemForm) ?? 0)
  const redeemBalance = Number(promoPointsData?.points ?? 0)
  const redeemDebt = Number(promoRow?.debt_amount ?? 0)
  const redeemInvoiceAmount = Math.max(Number(promoRow?.total_amount ?? 0) - Number(promoRow?.discount_amount ?? 0), 0)
  const pointValue = Number(promoPointsData?.redemption?.point_value)
  const minRedeemPercent = Number(promoPointsData?.redemption?.min_percent)
  const maxRedeemPercent = Number(promoPointsData?.redemption?.max_percent)
  const balanceMaxRedeemPercent = Number(promoPointsData?.redemption?.balance_max_percent)
  const maxRedeemPointsByBalance = Number.isFinite(balanceMaxRedeemPercent)
    ? Math.floor(redeemBalance * balanceMaxRedeemPercent / 100)
    : 0
  const isPointsEnabled = promoPointsData?.redemption?.enabled === true || promoPointsData?.redemption?.enabled === 'true'
  const redemptionConfigReady = Number.isFinite(pointValue) && pointValue > 0
    && Number.isFinite(minRedeemPercent) && Number.isFinite(maxRedeemPercent)
    && Number.isInteger(balanceMaxRedeemPercent) && balanceMaxRedeemPercent >= 1 && balanceMaxRedeemPercent <= 99
    && minRedeemPercent <= maxRedeemPercent
  const redeemMoney = redeemPointsValue * pointValue
  const minRedeemMoney = redeemInvoiceAmount * minRedeemPercent / 100
  const maxRedeemMoney = Math.min(redeemInvoiceAmount * maxRedeemPercent / 100, redeemDebt)
  const maxRedeemPoints = Math.min(
    maxRedeemPointsByBalance,
    pointValue > 0 ? Math.floor(maxRedeemMoney / pointValue) : 0,
  )
  let redeemValidationMessage = ''
  if (redeemPointsValue > 0 && redeemDebt <= 0) redeemValidationMessage = 'Gói này đã được thanh toán đủ.'
  else if (redeemPointsValue > redeemBalance) redeemValidationMessage = `Khách chỉ còn ${redeemBalance.toLocaleString('vi-VN')} điểm.`
  else if (redeemPointsValue > 0 && redeemPointsValue > maxRedeemPoints) {
    redeemValidationMessage = `Mỗi lần chỉ được dùng tối đa ${maxRedeemPoints.toLocaleString('vi-VN')} điểm theo số dư và hóa đơn.`
  } else if (redeemPointsValue > 0 && redemptionConfigReady && redeemMoney < minRedeemMoney) {
    redeemValidationMessage = `Giá trị đổi thấp hơn mức tối thiểu ${formatMoney(minRedeemMoney)}.`
  } else if (redeemPointsValue > 0 && redemptionConfigReady && redeemMoney > maxRedeemMoney) {
    redeemValidationMessage = `Giá trị đổi vượt mức tối đa ${formatMoney(maxRedeemMoney)}.`
  }
  const canSubmitRedeem = promoPointsQuery.isSuccess && isPointsEnabled && redemptionConfigReady
    && redeemPointsValue > 0 && Number.isInteger(redeemPointsValue)
    && redeemPointsValue <= redeemBalance && redeemDebt > 0 && redeemPointsValue <= maxRedeemPoints
    && redeemMoney >= minRedeemMoney && redeemMoney <= maxRedeemMoney

  // Giảm thủ công (không qua voucher): % hoặc số tiền
  const [manualForm] = Form.useForm()
  const [manualMode, setManualMode] = useState<'percent' | 'amount'>('percent')
  const manualDiscountMutation = usePostTreatmentCustomersIdManualDiscount()
  const submitManualDiscount = async () => {
    const target = promoRow
    if (!target) return
    try {
      const values = await manualForm.validateFields()
      await manualDiscountMutation.mutateAsync({ id: target.id, data: { mode: manualMode, value: Number(values.value) } })
      message.success(manualMode === 'percent' ? `Đã giảm ${values.value}% vào gói` : `Đã giảm ${formatMoney(values.value)} vào gói`)
      const fresh = pickData<CustomerTreatment>(await getTreatmentCustomersId(target.id))
      if (fresh) setPromoRow(fresh)
      manualForm.resetFields()
      refresh()
      await refreshSelectedDetail()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openPromo = (row: CustomerTreatment) => {
    setPromoRow(row)
    setPromoOpen(true)
    promoForm.resetFields()
    redeemForm.resetFields()
    manualForm.resetFields()
  }

  const submitApplyDiscount = async () => {
    const target = promoRow
    if (!target) return
    try {
      const values = await promoForm.validateFields()
      await applyDiscountMutation.mutateAsync({ id: target.id, data: { rule_id: values.rule_id, percent: values.percent } })
      message.success('Đã áp dụng giảm giá vào gói')
      promoForm.resetFields()
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const confirmApplyReward = (redemption: RewardRedemptionRow) => {
    const target = promoRow
    const reward = redemption.reward
    if (!target || !reward?.benefit_amount || applyingRewardId) return
    Modal.confirm({
      title: 'Áp dụng quà vào gói liệu trình?',
      content: `Giảm ${formatMoney(reward.benefit_amount)} vào công nợ gói “${packageName(target)}” và đánh dấu lượt đổi đã dùng. Thao tác này không thể hoàn tác.`,
      okText: 'Áp dụng quà',
      cancelText: 'Hủy',
      onOk: async () => {
        setApplyingRewardId(redemption.id)
        try {
          await customInstance({
            url: `/treatmentCustomers/${target.id}/apply-reward`,
            method: 'POST',
            data: { redemption_id: redemption.id },
          })
          message.success(`Đã trừ ${formatMoney(reward.benefit_amount)} khỏi công nợ và ghi nhận quà đã dùng`)
          const fresh = pickData<CustomerTreatment>(await getTreatmentCustomersId(target.id))
          if (fresh) setPromoRow(fresh)
          refresh()
          await refreshSelectedDetail()
          await queryClient.invalidateQueries({ queryKey: ['/reward-redemptions'] })
          await rewardRedemptionsQuery.refetch()
        } catch (err) {
          message.error(errorMessage(err))
        } finally {
          setApplyingRewardId(null)
        }
      },
    })
  }

  const submitRedeemPoints = async () => {
    const target = promoRow
    if (!target || !canSubmitRedeem || redeemPointsMutation.isPending) return
    try {
      const values = await redeemForm.validateFields()
      await redeemPointsMutation.mutateAsync({ id: target.id, data: { points: values.points } })
      message.success('Đã trừ điểm vào gói')
      redeemForm.resetFields()
      refresh()
      await promoPointsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng lượt đăng ký', value: stats.total.toLocaleString('vi-VN'), icon: <TeamOutlined />, tone: 'primary' },
    { key: 'ongoing', label: 'Đang thực hiện', value: stats.ongoing.toLocaleString('vi-VN'), icon: <PlayCircleOutlined />, tone: 'secondary' },
    { key: 'done', label: 'Đã hoàn tất', value: stats.done.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'neutral' },
    ...(canSeeDebtSummary ? [{ key: 'debt', label: 'Tổng công nợ', value: formatMoney(stats.debt), icon: <WalletOutlined />, tone: 'tertiary' as const }] : []),
  ]
  const detailSupplementalInfo = Object.entries(detail?.custom_fields ?? {})
    .filter(([key, value]) => !HIDDEN_TREATMENT_SYSTEM_FIELDS.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: TREATMENT_SYSTEM_FIELD_LABELS[key] ?? readableCustomFieldLabel(key, customerTreatmentCustomFields),
      value: customFieldValueText(value),
    }))

  return (
    <>
      {/* Thống kê đầu trang — cùng số liệu với rows đã tải (limit 500), thay hàng Card/Statistic cũ */}
      <StatCards items={statItems} />

      <PageTitle
        subtitle="Khách hàng đang thực hiện liệu trình"
        left={
          <>
            {/* Mobile: nút icon mở ô tìm kiếm; desktop hiện input luôn */}
            {isMobile && !searchOpen && (
              <Button icon={<SearchOutlined />} aria-label="Tìm kiếm" title="Tìm kiếm" onClick={() => setSearchOpen(true)} />
            )}
            {(searchOpen || !isMobile) && (
              <Input
                allowClear
                autoFocus={isMobile}
                prefix={<SearchOutlined className="text-[var(--brand-text-inactive,#A9ADB2)]" />}
                placeholder="Tìm tên hoặc SĐT khách hàng"
                className={isMobile && searchOpen ? 'min-w-0 flex-1' : 'w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]'}
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value)
                  if (!event.target.value) applySearch('')
                }}
                onPressEnter={() => applySearch(searchInput)}
                onBlur={() => { if (isMobile && !searchInput) setSearchOpen(false) }}
              />
            )}
            <ListFilterPopover
              iconOnly={isMobile}
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={CUSTOMER_TREATMENT_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CustomerTreatmentColumnKey[])}
              filterItems={(
                <>
                  <Form.Item name="package_id" label="Liệu trình" className="mb-2.5!">
                    <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả liệu trình" options={packages.map((pkg) => ({ value: pkg.id, label: pkg.name }))} />
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
          <Can I="UPDATE" a="CUSTOMER">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreateModal()}>
              Thêm khách vào liệu trình
            </Button>
          </Can>
        }
      >
        Liệu trình khách hàng
      </PageTitle>

      <Table<CustomerTreatment>
        className="desktop-only"
        rowKey="id"
        loading={treatmentsQuery.isLoading}
        dataSource={paginateRows(list, page, limit)}
        pagination={false}
        onRow={(row) => ({ onClick: () => openDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Khách hàng',
            key: 'customer',
            width: 220,
            render: (_: unknown, row: CustomerTreatment) => {
              return (
                <div>
                  <Typography.Text strong>{profileName(row)}</Typography.Text>
                  <div className="text-xs text-[#777]">
                    {packageName(row)}{(profilePhone(row)) ? ` · ${profilePhone(row)}` : ''}
                  </div>
                </div>
              )
            },
          },
          {
            title: 'Mã gói',
            key: 'package_code',
            width: 200,
            render: (_: unknown, row: CustomerTreatment) => (
              <div>
                <Tag color="purple">G-{treatmentCode(row)}</Tag>
                <div className="mt-0.5 text-xs text-[#777]">
                  Mua ngày {row.created_at ? dayjs(row.created_at).format('DD/MM/YYYY') : '—'}
                </div>
              </div>
            ),
          },
          {
            title: 'Tiến độ',
            key: 'progress',
            width: 220,
            render: (_: unknown, row: CustomerTreatment) => {
              if (row.quota_type === 'SESSIONS') {
                const { total, used, percent } = sessionUsage(row)
                if (!total) return <Tag>Chưa cấu hình số buổi</Tag>
                return (
                  <div>
                    <Progress percent={percent} size="small" showInfo={false} strokeColor="var(--brand-primary)" className="mb-1!" />
                    <div className="text-xs text-[#777]">Đã dùng {used}/{total} buổi</div>
                  </div>
                )
              }
              if (row.quota_type === 'VALUE') {
                return <Tag color="gold">Định mức {formatMoney(row.value_used)} / {formatMoney(row.value_total)}</Tag>
              }
              return <Tag color="gold">Trọn gói</Tag>
            },
          },
          {
            title: 'Thanh toán',
            key: 'payment',
            width: 200,
            render: (_: unknown, row: CustomerTreatment) => (
              <div>
                {canReadPayments && <div>
                  {formatMoney(row.paid_amount)} / {formatMoney(row.total_amount)}
                </div>}
                <Tag color={(row.debt_amount ?? 0) > 0 ? 'orange' : 'green'} className="mt-1">
                  {(row.debt_amount ?? 0) > 0 ? `Còn nợ ${formatMoney(row.debt_amount)}` : 'Đã trả đủ'}
                </Tag>
              </div>
            ),
          },
          {
            title: 'Hạn sử dụng',
            key: 'expiry',
            width: 120,
            render: (_: unknown, row: CustomerTreatment) =>
              row.expires_at ? dayjs(row.expires_at).format('DD/MM/YYYY') : 'Không hạn',
          },
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'status',
            width: 110,
            render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
          {
            title: 'Hành động', align: 'center' as const,
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_: unknown, row: CustomerTreatment) => {
              const items: MenuProps['items'] = [
                ...(row.status === 'ACTIVE' ? [{ key: 'add_session', icon: <PlusOutlined />, label: '+1 buổi', disabled: addingSessionId !== null }] : []),
                {
                  key: 'pay',
                  label: 'Thu tiền',
                  disabled: !((row.debt_amount ?? 0) > 0 && row.status !== 'CANCELLED'),
                },
                { key: 'adjust', label: 'Điều chỉnh gói', disabled: !(row.status === 'ACTIVE' || row.status === 'EXPIRED') },
                {
                  key: 'convert',
                  label: `Đổi buổi tặng (${bonusRemainingOf(row)})`,
                  disabled: !(row.status === 'ACTIVE' && bonusRemainingOf(row) > 0),
                },
                { key: 'history', label: 'Lịch sử điều chỉnh' },
                { type: 'divider' as const },
                {
                  key: 'finish',
                  label:
                    row.status === 'ACTIVE' && row.quota_type === 'UNLIMITED' && (row.debt_amount ?? 0) > 0 ? (
                      <Tooltip title="Phải thu đủ tiền trước khi hoàn tất liệu trình">Hoàn tất liệu trình (trả da)</Tooltip>
                    ) : (
                      'Hoàn tất liệu trình (trả da)'
                    ),
                  disabled: !(row.status === 'ACTIVE' && row.quota_type === 'UNLIMITED' && (row.debt_amount ?? 0) === 0),
                },
                // CT-06: chỉ Admin được hủy gói liệu trình
                ...(isAdmin ? [{ key: 'cancel', label: 'Hủy liệu trình', danger: true, disabled: row.status !== 'ACTIVE' }] : []),
                ...(row.status === 'ACTIVE' ? [{ key: 'promo', label: 'Ưu đãi & điểm' }] : []),
              ]
              return (
                <RowActionsMenu
                  items={items as RowActionItem[]}
                  onSelect={(key) => {
                    if (key === 'add_session') addSession(row)
                    else if (key === 'pay') {
                      setPayTargetId(row.id)
                      payForm.setFieldsValue({ amount: row.debt_amount, method: activePaymentMethods.find((item) => item.code === 'CASH')?.code ?? activePaymentMethods[0]?.code })
                      setPayOpen(true)
                    } else if (key === 'adjust') {
                      openAdjust(row)
                    } else if (key === 'convert') {
                      openConvert(row)
                    } else if (key === 'history') {
                      openHistory(row)
                    } else if (key === 'finish') {
                      if (row.status !== 'ACTIVE' || row.quota_type !== 'UNLIMITED') {
                        message.error('Chỉ có thể hoàn tất thủ công gói không giới hạn')
                        return
                      }
                      if ((row.debt_amount ?? 0) > 0) {
                        message.error(`Gói còn nợ ${formatMoney(row.debt_amount)} — phải thu đủ trước khi hoàn tất liệu trình`)
                        return
                      }
                      Modal.confirm({
                        title: 'Hoàn tất liệu trình (trả da)?',
                        content: 'Gói sẽ chuyển sang Hoàn tất và bắt đầu tính thời gian bảo hành trọn đời.',
                        okText: 'Hoàn tất',
                        cancelText: 'Không',
                        onOk: () => finishTreatment(row),
                      })
                    } else if (key === 'cancel') {
                      Modal.confirm({
                        title: 'Hủy liệu trình này?',
                        content: 'Chỉ được hủy khi chưa có buổi hoàn tất. Các giao dịch thanh toán được giữ nguyên.',
                        okText: 'Hủy LT',
                        okButtonProps: { danger: true },
                        cancelText: 'Không',
                        onOk: () => cancelTreatment(row),
                      })
                    } else if (key === 'promo') {
                      openPromo(row)
                    }
                  }}
                />
              )
            },
          },
        ].filter((column) =>
          (column.key !== 'actions' || canUpdate) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as CustomerTreatmentColumnKey)),
        )}
      />
      <MobileCards
        rows={paginateRows(list, page, limit)}
        rowKey={(row) => row.id}
        onCardClick={(row) => openDetail(row)}
        loading={treatmentsQuery.isLoading}
        emptyText="Chưa có khách nào trong liệu trình"
        renderCard={(row) => {
          const usage = row.quota_type === 'SESSIONS' ? sessionUsage(row) : null
          return (
            <>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{profileName(row)}</div>
                  <div className="mobile-card-sub">{packageName(row)} · {profilePhone(row) || '—'} · Mã G-{treatmentCode(row)}</div>
                </div>
                <Tag color={STATUS_META[row.status as string]?.color}>{STATUS_META[row.status as string]?.label ?? row.status}</Tag>
              </div>
              <div className="mobile-card-rows">
                {usage
                  ? <MobileCardRow label="Số buổi" value={`Đã dùng ${usage.used}/${usage.total} · Còn ${usage.remaining}`} />
                  : row.quota_type === 'VALUE'
                    ? <MobileCardRow label="Định mức" value={`${formatMoney(row.value_used)} / ${formatMoney(row.value_total)}`} />
                    : <MobileCardRow label="Loại gói" value="Trọn gói" />}
                {row.expires_at && <MobileCardRow label="Hạn dùng" value={dayjs(row.expires_at).format('DD/MM/YYYY')} />}
                {canReadPayments && <MobileCardRow label="Thanh toán" value={
                  <Tag color={(row.debt_amount ?? 0) > 0 ? 'orange' : 'green'} className="m-0!">
                    {(row.debt_amount ?? 0) > 0 ? `Còn nợ ${formatMoney(row.debt_amount)}` : 'Đã trả đủ'}
                  </Tag>
                } />}
              </div>
              <div className="mobile-card-actions">
                {row.status === 'ACTIVE' && canCreateSessions && (
                  <Button size="small" type="primary" icon={<PlusOutlined />} disabled={addingSessionId !== null} onClick={() => addSession(row)}>+1 buổi</Button>
                )}
                {canReadPayments && (row.debt_amount ?? 0) > 0 && row.status !== 'CANCELLED' && (
                  <Button size="small" onClick={() => {
                    setPayTargetId(row.id)
                    payForm.setFieldsValue({ amount: row.debt_amount, method: activePaymentMethods.find((item) => item.code === 'CASH')?.code ?? activePaymentMethods[0]?.code })
                    setPayOpen(true)
                  }}>Thu tiền</Button>
                )}
              </div>
            </>
          )
        }}
      />
      <ListPagination page={page} limit={limit} total={list.length} onChange={setPage} noun="khách điều trị" />

      <TreatmentCreateModal
        form={createForm}
        open={createOpen}
        customerOptions={customerOptions}
        onSearch={fetchCustomerOptions}
        packages={packages}
        packagesLoading={packagesQuery.isLoading}
        selectedSalePackage={selectedSalePackage}
        currencySymbol={currencySymbol}
        customFieldDefs={customerTreatmentCustomFields}
        submitting={createMutation.isPending}
        onPackageChange={onCreatePackageChange}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void submitCreate()}
      />

      <TreatmentAddSessionModal
        form={addSessionForm}
        open={!!addSessionFor}
        canSchedule={canUpdate}
        scheduledDate={addSessionDate}
        scheduledTime={addSessionTime}
        slots={addSessionSlots}
        slotsLoading={addSessionSlotsLoading}
        onLoadSlots={(date) => void loadAddSessionSlots(date)}
        staffOptions={staffOptions}
        customFieldDefs={sessionCustomFields}
        submitting={addingSessionId !== null}
        onCancel={() => setAddSessionFor(null)}
        onOk={() => void submitNewSession()}
      />

      <TreatmentPaymentModal
        form={payForm}
        open={payOpen}
        currencySymbol={currencySymbol}
        lookupLoading={paymentLookupLoading}
        lookupError={paymentLookupError}
        activePaymentMethods={activePaymentMethods}
        onCancel={() => { setPayOpen(false); setPayTargetId(null) }}
        onOk={submitPayment}
      />

      <TreatmentPromoModal
        open={promoOpen}
        promoRow={promoRow}
        formatMoney={formatMoney}
        availableDiscounts={availableDiscounts}
        discountForm={promoForm}
        discountSubmitting={applyDiscountMutation.isPending}
        onApplyDiscount={() => void submitApplyDiscount()}
        manualForm={manualForm}
        manualMode={manualMode}
        onManualModeChange={setManualMode}
        manualSubmitting={manualDiscountMutation.isPending}
        onManualDiscount={() => void submitManualDiscount()}
        redeemForm={redeemForm}
        pointsLoading={promoPointsQuery.isLoading}
        pointsError={promoPointsQuery.isError}
        pointsLoaded={promoPointsQuery.isSuccess}
        pointsErrorMessage={errorMessage(promoPointsQuery.error)}
        isPointsEnabled={isPointsEnabled}
        redemptionConfigReady={redemptionConfigReady}
        redeemBalance={redeemBalance}
        balanceMaxRedeemPercent={balanceMaxRedeemPercent}
        redeemPointsValue={redeemPointsValue}
        redeemMoney={redeemMoney}
        pointValue={pointValue}
        redeemInvoiceAmount={redeemInvoiceAmount}
        minRedeemMoney={minRedeemMoney}
        maxRedeemMoney={maxRedeemMoney}
        minRedeemPercent={minRedeemPercent}
        maxRedeemPercent={maxRedeemPercent}
        maxRedeemPoints={maxRedeemPoints}
        redeemDebt={redeemDebt}
        redeemValidationMessage={redeemValidationMessage}
        canSubmitRedeem={canSubmitRedeem}
        redeemSubmitting={redeemPointsMutation.isPending}
        onRedeemPoints={() => void submitRedeemPoints()}
        rewardsLoading={rewardRedemptionsQuery.isLoading}
        rewardsError={rewardRedemptionsQuery.isError}
        rewardsErrorMessage={errorMessage(rewardRedemptionsQuery.error)}
        applicableRewardRedemptions={applicableRewardRedemptions}
        canApplyReward={canApplyReward}
        applyingRewardId={applyingRewardId}
        onApplyReward={confirmApplyReward}
        onCancel={() => { setPromoOpen(false); setPromoRow(null) }}
      />

      <TreatmentDetailModal
        detail={detail}
        payOpen={payOpen}
        detailTab={detailTab}
        onTabChange={(tab) => setDetailTab(tab)}
        profileName={profileName}
        packageName={packageName}
        formatMoney={formatMoney}
        currencySymbol={currencySymbol}
        canReadPayments={canReadPayments}
        canUpdate={canUpdate}
        canCreateSessions={canCreateSessions}
        isAdmin={isAdmin}
        addingSessionId={addingSessionId}
        onAddSession={addSession}
        onPay={(row) => {
          setPayTargetId(row.id)
          payForm.setFieldsValue({ amount: row.debt_amount, method: activePaymentMethods.find((item) => item.code === 'CASH')?.code ?? activePaymentMethods[0]?.code })
          setPayOpen(true)
        }}
        payments={payments}
        payLoading={payLoading}
        paymentMethodLabels={paymentMethodLabels}
        supplementalInfo={detailSupplementalInfo}
        focusSessionId={sessionToEdit?.treatmentId === detail?.id ? sessionToEdit?.sessionId : undefined}
        onFocusSessionHandled={handleSessionFocusHandled}
        staffOptions={staffOptions}
        sessionCustomFields={sessionCustomFields}
        sessionsRefreshKey={sessionsRefreshKey}
        refresh={refresh}
        refreshSelectedDetail={refreshSelectedDetail}
        onCancelTreatment={cancelTreatment}
        onClose={() => setDetail(null)}
      />

      <TreatmentAdjustModal
        form={adjustForm}
        open={adjustOpen}
        adjustRow={adjustRow}
        profileName={profileName}
        adjustType={adjustType}
        adjustAmount={adjustAmount}
        adjustSessionsLoading={adjustSessionsQuery.isLoading}
        adjustCompletedCount={adjustCompletedCount}
        submitting={adjustMutation.isPending}
        onCancel={() => setAdjustOpen(false)}
        onOk={() => void submitAdjust()}
      />

      <TreatmentConvertModal
        form={convertForm}
        open={convertOpen}
        convertRow={convertRow}
        profileName={profileName}
        serviceOptions={serviceOptions}
        submitting={convertMutation.isPending}
        onCancel={() => setConvertOpen(false)}
        onOk={() => void submitConvert()}
      />

      <TreatmentHistoryModal
        open={historyOpen}
        historyRow={historyRow}
        profileName={profileName}
        loading={historyQuery.isLoading}
        rows={(pickData<TreatmentAdjustmentRow[]>(historyQuery.data) ?? []) as TreatmentAdjustmentRow[]}
        page={adjustHistoryPage}
        onPageChange={setAdjustHistoryPage}
        onCancel={() => setHistoryOpen(false)}
      />
    </>
  )
}
