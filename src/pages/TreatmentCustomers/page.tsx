import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Col, Form, Grid, Input, Progress, Row, Select, Skeleton, Table, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, FilterOutlined, PlayCircleOutlined, PlusOutlined, SearchOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import MobileStatCards from '@/components/base/MobileStatCards'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { normalizeCustomFieldValues } from '@/components/CustomFieldFormItems'
import { errorMessage, pickData } from '@/api/helpers'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { TreatmentPackage } from '@/api/models/treatmentPackage'
import { getUsersCustomersAdmin, useGetUsersCustomersAdmin, useGetUsersCustomersIdPointsAdmin } from '@/api/endpoints/customers'
import { getTreatmentPackageVoucherCustomersAdmin } from '@/api/endpoints/treatment-package-voucher-customers'
import { getTreatmentPackageVouchersAdmin } from '@/api/endpoints/treatment-package-vouchers'
import { apiClient } from '@/api/mutator/custom-instance'
import type { VoucherCustomerRow, VoucherCategoryRow } from '@/pages/Vouchers/components/constants'

/** Đánh dấu voucher đã dùng khi staff áp vào gói lúc thanh toán. BE có PATCH
 * /treatment-package-voucher-customers/{id}/admin (voucherCustomerItem factory) nhưng
 * route chưa khai báo @openapi nên orval chưa sinh ra — giữ raw call với URL /admin mới. */
async function useVoucherCustomer(_category: 'treatment-package', assignmentId: string) {
  await apiClient.patch(`/treatment-package-voucher-customers/${assignmentId}/admin`, { status: 'USED' })
}
import { usePostTreatmentCustomersIdManualDiscountAdmin } from '@/api/endpoints/discounts'
import { usePostTreatmentCustomersIdRedeemPointsAdmin } from '@/api/endpoints/treatment-customers'
import { getTreatmentCustomersIdAvailableSlotsAdmin, getTreatmentCustomersIdPaymentsAdmin, getTreatmentCustomersIdAdmin, getGetTreatmentCustomersAdminQueryKey, useGetTreatmentCustomersAdmin, usePostTreatmentCustomersAdmin, usePostTreatmentCustomersIdPaymentsAdmin, usePutTreatmentCustomersIdAdmin, usePutTreatmentCustomersIdCancelAdmin } from '@/api/endpoints/treatment-customers'
import { postTreatmentCustomersIdSessionsAdmin } from '@/api/endpoints/treatment-sessions'
import { useGetTreatmentPackagesAdmin } from '@/api/endpoints/treatment-packages'
import { useGetLookupListsAdmin } from '@/api/endpoints/lookup-lists'
import { useGetUsersAdmin } from '@/api/endpoints/users'
import { useBrandCurrency } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import { displayName } from '@/utils/displayName'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import { Can, useAbility } from '@casl/react'
import TreatmentCreateModal from './components/TreatmentCreateModal'
import TreatmentAddSessionModal from './components/TreatmentAddSessionModal'
import TreatmentPaymentModal, { type PromoTab } from './components/TreatmentPaymentModal'
import TreatmentDetailModal from './components/TreatmentDetailModal'
import TreatmentEditModal from './components/TreatmentEditModal'
import { TreatmentLoading } from './components/shared'
import './treatment-customers.css'
import {
  FILTERS,
  HIDDEN_TREATMENT_SYSTEM_FIELDS,
  STATUS_META,
  TREATMENT_SYSTEM_FIELD_LABELS,
  buildTreatmentEditDto,
  customFieldValueText,
  readableCustomFieldLabel,
  sessionUsage,
  type LookupListRow,
  type PaymentRow,
  type ProfileRow,
  type Slot,
} from './components/constants'
import type { Branch } from '@/api/models'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'

/** kind=PACKAGE: trang Liệu trình KH (3 loại gói) · kind=SINGLE: trang Dịch vụ lẻ KH (/standalone-service-customers) */
export default function TreatmentCustomers({ kind = 'PACKAGE' }: { kind?: 'SINGLE' | 'PACKAGE' }) {
  const isSingle = kind === 'SINGLE'
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const queryClient = useQueryClient()
  const { isAdmin, isReceptionist } = useCustomerProfileAccess()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'CUSTOMER')
  const canCreateSessions = ability.can('CREATE', 'TREATMENT_SESSION')
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
  const [branchFilter, setBranchFilter] = useState<string>()
  const isMobile = !Grid.useBreakpoint().md
  const [filterForm] = Form.useForm()
  const [filterOpen, setFilterOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm] = Form.useForm()
  // Modal chi tiết
  const [detailTab, setDetailTab] = useState<'sessions' | 'payments' | 'points'>('sessions')
  const [detail, setDetail] = useState<CustomerTreatment | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const detailRequest = useRef(0)
  // Mobile tách popup chi tiết: 'summary' = panel tóm tắt+nút (nhẹ), 'tabs' = Buổi/TT/Điểm
  const [detailMobileSection, setDetailMobileSection] = useState<'summary' | 'tabs'>('summary')
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
  // TA-02 — Đổi buổi tặng sang dịch vụ khác
  // CT-04 — Sửa liệu trình khách (tiền/hạn/ghi chú/custom fields)
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState<CustomerTreatment | null>(null)
  const [editForm] = Form.useForm()
  const [editSaving, setEditSaving] = useState(false)
  // Ưu đãi & đổi điểm (DC-06/07/08, LY-02) — nhúng trong modal thanh toán
  const [promoRow, setPromoRow] = useState<CustomerTreatment | null>(null)
  const [redeemForm] = Form.useForm()
  const [paymentLookupError, setPaymentLookupError] = useState('')
  const branchesQuery = useGetBranchesAdmin()
  const branches = useMemo(() => (pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[], [branchesQuery.data])

  const treatmentsQuery = useGetTreatmentCustomersAdmin({
    page,
    limit,
    kind,
    ...(filter !== 'all' ? { status: filter } : {}),
    ...(pkgFilter ? { package_id: pkgFilter } : {}),
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    ...(search ? { q: search } : {}),
  } as never)
  const rows = (pickData<CustomerTreatment[] | undefined>(treatmentsQuery.data) ?? []) as CustomerTreatment[]
  const total = (treatmentsQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rows.length
  const statsMeta = (treatmentsQuery.data as unknown as { meta?: { stats?: { total: number; ongoing: number; done: number; debt_sum: number } } })?.meta?.stats

  const profilesQuery = useGetUsersCustomersAdmin({ page: 1, limit: 200 })
  const profiles = (pickData<ProfileRow[] | undefined>(profilesQuery.data) ?? []) as ProfileRow[]
  const packagesQuery = useGetTreatmentPackagesAdmin({ page: 1, limit: 200, is_active: true, kind })
  const packages = (pickData<TreatmentPackage[] | undefined>(packagesQuery.data) ?? []) as TreatmentPackage[]
  const selectedSalePackageId = Form.useWatch('package_id', createForm)
  const selectedSalePackage = packages.find((pkg) => pkg.id === selectedSalePackageId)
  const staffsQuery = useGetUsersAdmin({ currentPage: 1, pageSize: 200, has_role: true })
  const staffOptions = useMemo(
    () =>
      (((pickData<{ rows?: Array<{ id: string; zalo_name?: string; email?: string }> }>(staffsQuery.data)?.rows ?? [])) as Array<{ id: string; zalo_name?: string; email?: string }>)
        .map((u) => ({ value: u.id, label: `${u.zalo_name || 'Nhân viên'} · ${u.email || u.id.slice(0, 8)}` })),
    [staffsQuery.data],
  )

  const lookupQuery = useGetLookupListsAdmin({ key: 'payment.methods', items_is_active: 'true' })
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

  const createMutation = usePostTreatmentCustomersAdmin()
  const createInFlightRef = useRef(false)
  const createPaymentMutation = usePostTreatmentCustomersIdPaymentsAdmin()
  const cancelMutation = usePutTreatmentCustomersIdCancelAdmin()
  const editMutation = usePutTreatmentCustomersIdAdmin()

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetTreatmentCustomersAdminQueryKey() })
  }, [queryClient])

  // CT-04 — Sửa liệu trình khách
  const openEdit = (row: CustomerTreatment) => {
    setEditRow(row)
    editForm.resetFields()
    editForm.setFieldsValue({
      total_amount: row.total_amount ?? undefined,
      expires_at: row.expires_at ? dayjs(row.expires_at) : undefined,
      note: row.note ?? undefined,
      custom_fields: row.custom_fields ?? {},
    })
    setEditOpen(true)
  }

  const submitEdit = async () => {
    if (!editRow) return
    const values = await editForm.validateFields()
    setEditSaving(true)
    try {
      await editMutation.mutateAsync({
        id: editRow.id,
        data: buildTreatmentEditDto(editRow, values, customerTreatmentCustomFields) as never,
      })
      message.success('Đã cập nhật liệu trình')
      setEditOpen(false)
      refresh()
    } catch (err) {
      if (!(err as { errorFields?: unknown })?.errorFields) message.error(errorMessage(err))
    } finally {
      setEditSaving(false)
    }
  }

  const profileOf = (id: string) => profiles.find((p) => p.id === id)
  const profileName = (row: CustomerTreatment) =>
    displayName(
      (row as CustomerTreatment & { user?: { full_name?: string; zalo_name?: string } }).user
      ?? profileOf(row.user_id),
      'Khách hàng',
    )
  const profilePhone = (row: CustomerTreatment) =>
    (row as CustomerTreatment & { user?: { phone?: string } }).user?.phone ?? profileOf(row.user_id)?.phone
  const treatmentCode = (row: CustomerTreatment) => row.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const packageName = (row: CustomerTreatment) => {
    const snapshotName = (row.package_snapshot as Record<string, unknown> | undefined)?.name
    const packageTypeName = (row as CustomerTreatment & { package_type?: { name?: string } }).package_type?.name
    return (typeof snapshotName === 'string' && snapshotName.trim() ? snapshotName : undefined)
      ?? packages.find((p) => p.id === row.package_id)?.name
      ?? packageTypeName
      ?? '—'
  }

  const applySearch = (nextKeyword: string) => {
    setSearchInput(nextKeyword)
    setSearch(nextKeyword.trim())
    setPage(1)
  }

  // Mobile: gõ là lọc luôn (debounce 300ms); desktop giữ nguyên phải bấm nút tìm
  useEffect(() => {
    if (!isMobile) return
    const next = searchInput.trim()
    if (next === search) return
    const timer = window.setTimeout(() => { setSearch(next); setPage(1) }, next ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [isMobile, searchInput, search])

  const stats = {
    total: statsMeta?.total ?? 0,
    ongoing: statsMeta?.ongoing ?? 0,
    done: statsMeta?.done ?? 0,
    debt: statsMeta?.debt_sum ?? 0,
  }

  const openDetail = (row: CustomerTreatment, mobileSection: 'summary' | 'tabs' = 'summary') => {
    const request = ++detailRequest.current
    setDetailMobileSection(mobileSection)
    setDetail(row)
    setDetailLoading(true)
    setDetailTab('sessions')
    // Lấy chi tiết mới nhất (kèm package_service từ snapshot)
    getTreatmentCustomersIdAdmin(row.id)
      .then((response) => {
        const fresh = pickData<CustomerTreatment>(response)
        if (fresh && request === detailRequest.current) setDetail((current) => (current?.id === row.id ? fresh : current))
      })
      .catch(() => undefined)
      .finally(() => { if (request === detailRequest.current) setDetailLoading(false) })
    if (!canReadPayments) {
      setPayments([])
      setPayLoading(false)
      return
    }
    setPayLoading(true)
    getTreatmentCustomersIdPaymentsAdmin(row.id)
      .then((response) => {
        if (request === detailRequest.current) setPayments(pickData<PaymentRow[]>(response) ?? [])
      })
      .catch(() => { if (request === detailRequest.current) setPayments([]) })
      .finally(() => { if (request === detailRequest.current) setPayLoading(false) })
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
      getUsersCustomersAdmin({ page: 1, limit: 50, ...(q ? { q } : {}) } as never)
        .then((response) => setCustomerOptions((pickData<ProfileRow[] | undefined>(response) ?? []) as ProfileRow[]))
        .catch(() => undefined)
    }, 300)
  }, [])

  const openCreateModal = () => {
    createForm.setFieldsValue({ user_id: undefined, package_id: undefined, total_amount: undefined, custom_fields: {} })
    setCreateOpen(true)
    fetchCustomerOptions('')
  }

  const onCreatePackageChange = (id: string) => {
    const pkg = packages.find((p) => p.id === id)
    if (!pkg) return
    // Tự fill giá & buổi tặng mặc định từ gói — chỉ khi ô đang bỏ trống (không ghi đè giá trị đã nhập tay)
    const current = createForm.getFieldsValue(['total_amount', 'sessions_bonus'])
    const isEmpty = (value: unknown) => value == null || value === ''
    createForm.setFieldsValue({
      total_amount: isEmpty(current.total_amount) ? pkg.list_price ?? undefined : current.total_amount,
      sessions_bonus:
        isEmpty(current.sessions_bonus) && Number(pkg.bonus_sessions_default) > 0
          ? Number(pkg.bonus_sessions_default)
          : current.sessions_bonus,
    })
  }

  const submitCreate = async () => {
    if (createInFlightRef.current || createMutation.isPending) return
    createInFlightRef.current = true
    try {
      const values = await createForm.validateFields()
      const dto = {
        ...values,
        kind,
        sessions_bonus: !isSingle && values.sessions_bonus != null ? Number(values.sessions_bonus) : undefined,
        expires_at: values.expires_at ? (values.expires_at as Dayjs).format('YYYY-MM-DD') : undefined,
        custom_fields: normalizeCustomFieldValues(customerTreatmentCustomFields, values.custom_fields ?? {}),
      }
      await createMutation.mutateAsync({ data: dto as never })
      message.success(isSingle ? 'Đã thêm khách dịch vụ lẻ' : 'Đã thêm khách vào liệu trình')
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
      const response = await getTreatmentCustomersIdAvailableSlotsAdmin(addSessionFor.id, { date: date.format('YYYY-MM-DD') })
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
      await postTreatmentCustomersIdSessionsAdmin(addSessionFor.id, {
        ...(scheduledDate && scheduledTime && staffId ? {
          scheduled_at: scheduledDate.hour(Number(scheduledTime.slice(0, 2))).minute(Number(scheduledTime.slice(3, 5))).second(0).millisecond(0).toISOString(),
          staff_id: staffId,
        } : {}),
        ...(values.session_value != null ? { session_value: Number(values.session_value) } : {}),
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
      const fresh = pickData<CustomerTreatment>(await getTreatmentCustomersIdAdmin(detail.id))
      if (fresh) setDetail(fresh)
    } catch { /* bỏ qua — drawer giữ dữ liệu cũ */ }
  }

  const submitPayment = async () => {
    const treatmentId = payTargetId ?? detail?.id
    if (!treatmentId) return
    if (paymentLookupLoading || paymentLookupError || activePaymentMethods.length === 0) {
      message.error(paymentLookupError || 'Danh mục phương thức thanh toán chưa sẵn sàng')
      return
    }
    if (promoBlockingMessage) {
      message.error(promoBlockingMessage)
      return
    }
    const values = await payForm.validateFields()
    if (!activePaymentMethods.some((item) => item.code === values.method)) {
      message.error('Chọn phương thức thanh toán đang hoạt động')
      return
    }
    try {
      const promoWasSelected = promoDiscount > 0
      const promoApplied = await applyPromoSelection(treatmentId)
      if (!promoApplied) return
      // Lấy công nợ mới nhất sau khi áp ưu đãi
      const fresh = pickData<CustomerTreatment>(await getTreatmentCustomersIdAdmin(treatmentId))
      if (fresh) setPromoRow(fresh)
      const remainingDebt = Number(fresh?.debt_amount ?? 0)
      if (promoWasSelected && remainingDebt <= 0) {
        message.success('Đã áp dụng ưu đãi — gói đã đủ tiền, không cần ghi nhận thêm thanh toán')
        setPayOpen(false)
        setPayTargetId(null)
        payForm.resetFields()
        await refreshSelectedDetail()
        refresh()
        return
      }
      // Sau khi áp ưu đãi, số tiền thanh toán = công nợ còn lại (preview có thể lệch do trần/caps phía BE)
      if (promoWasSelected) values.amount = remainingDebt
      await createPaymentMutation.mutateAsync({ id: treatmentId, data: values as never })
      message.success('Đã ghi nhận thanh toán')
      setPayOpen(false)
      setPayTargetId(null)
      payForm.resetFields()
      await refreshSelectedDetail()
      if (canReadPayments) {
        setPayLoading(true)
        try {
          const response = await getTreatmentCustomersIdPaymentsAdmin(treatmentId)
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

  // ===== Ưu đãi & đổi điểm (DC-06/07/08, LY-02) — mở từ modal thanh toán =====
  const [promoTab, setPromoTab] = useState<PromoTab>('manual')
  const promoCustomerProfileId = promoRow?.user_id
  // Voucher treatment-package khách đang giữ, khớp gói của lần thu này (nguồn: API của trang /voucher-customers)
  const [selectedVoucherId, setSelectedVoucherId] = useState<string | null>(null)
  const customerVouchersQuery = useQuery({
    queryKey: ['pay-customer-vouchers', promoCustomerProfileId, promoRow?.package_id],
    queryFn: async () => {
      const [view, defs] = await Promise.all([
        getTreatmentPackageVoucherCustomersAdmin({ user_id: promoCustomerProfileId! } as never),
        getTreatmentPackageVouchersAdmin(),
      ])
      const viewData = pickData<VoucherCustomerRow[] | { rows?: VoucherCustomerRow[] }>(view)
      const rows = (Array.isArray(viewData) ? viewData : viewData?.rows ?? []).filter((row) => row.status === 'ACTIVE')
      const defsData = pickData<VoucherCategoryRow[] | { rows?: VoucherCategoryRow[] }>(defs)
      const defsRows = (Array.isArray(defsData) ? defsData : defsData?.rows ?? []) as VoucherCategoryRow[]
      const packageIdByVoucherId = new Map(defsRows.map((def) => [String(def.id), def.treatment_package_id ? String(def.treatment_package_id) : null]))
      const currentPackageId = String(promoRow?.package_id ?? '')
      const seen = new Set<string>()
      return rows
        .filter((row) => {
          if (seen.has(row.voucher_id)) return false
          seen.add(row.voucher_id)
          // Voucher gắn đúng gói này, hoặc voucher dùng chung (không gắn gói nào)
          const voucherPackageId = packageIdByVoucherId.get(String(row.voucher_id))
          return voucherPackageId === null || voucherPackageId === currentPackageId
        })
        .map((row) => ({
          voucherId: row.voucher_id,
          assignmentId: row.assignment_id ?? null,
          title: row.voucher_title,
          discountType: row.discount_type,
          discountValue: row.discount_value,
        }))
    },
    enabled: payOpen && promoTab === 'discount' && !!promoCustomerProfileId,
  })
  const customerVouchers = customerVouchersQuery.data ?? []
  const selectedVoucher = customerVouchers.find((voucher) => voucher.voucherId === selectedVoucherId) ?? null
  const redeemPointsMutation = usePostTreatmentCustomersIdRedeemPointsAdmin()
  const promoPointsQuery = useGetUsersCustomersIdPointsAdmin(promoCustomerProfileId ?? '', {
    query: { enabled: payOpen && Boolean(promoCustomerProfileId) },
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
  const manualDiscountMutation = usePostTreatmentCustomersIdManualDiscountAdmin()

  // Lựa chọn ưu đãi trong modal thanh toán: giá trị nhập theo tab đang chọn
  const manualValue = Number(Form.useWatch('value', manualForm) ?? 0)

  // Mức giảm dự kiến theo lựa chọn hiện tại — mirror công thức BE (round(total * %/100), trừ thẳng số tiền)
  const promoDiscount = (() => {
    const debt = Number(promoRow?.debt_amount ?? 0)
    if (promoTab === 'manual' && manualValue > 0) {
      const reduction = manualMode === 'percent'
        ? Math.round((Number(promoRow?.total_amount ?? 0) * manualValue) / 100)
        : Math.round(manualValue)
      return Math.min(reduction, debt)
    }
    if (promoTab === 'discount' && selectedVoucher && Number(selectedVoucher.discountValue ?? 0) > 0) {
      const reduction = selectedVoucher.discountType === 'PERCENT'
        ? Math.round((Number(promoRow?.total_amount ?? 0) * Number(selectedVoucher.discountValue)) / 100)
        : Math.round(Number(selectedVoucher.discountValue))
      return Math.min(reduction, debt)
    }
    if (promoTab === 'redeem' && redeemPointsValue > 0) {
      return Math.min(redeemMoney, debt)
    }
    return 0
  })()
  const promoRemaining = Math.max(Number(promoRow?.debt_amount ?? 0) - promoDiscount, 0)
  const promoBlockingMessage = promoTab === 'redeem' && redeemPointsValue > 0 && !canSubmitRedeem
    ? (redeemValidationMessage || 'Không thể đổi điểm với giá trị hiện tại.')
    : promoTab === 'manual' && manualMode === 'amount' && manualValue > Number(promoRow?.debt_amount ?? 0)
      ? `Số tiền giảm vượt công nợ còn lại (${formatMoney(promoRow?.debt_amount ?? 0)}).`
      : ''

  // Ô Số tiền tự điền theo giá còn lại khi mở modal / đổi lựa chọn ưu đãi
  useEffect(() => {
    if (payOpen) payForm.setFieldsValue({ amount: promoRemaining })
  }, [payForm, payOpen, promoRemaining])

  const canReadDiscount = ability.can('READ', 'DISCOUNT')
  const canRedeemPoints = ability.can('POINTS_ADJUST', 'MEMBERSHIP')

  /** Mở modal thanh toán cho 1 gói — fetch gói mới nhất làm ngữ cảnh ưu đãi. */
  const openPay = async (rowId: string) => {
    const fresh = pickData<CustomerTreatment>(await getTreatmentCustomersIdAdmin(rowId)) ?? rows.find((row) => row.id === rowId) ?? null
    setPromoRow(fresh)
    setPayTargetId(rowId)
    setPayOpen(true)
    setPromoTab('manual')
    setSelectedVoucherId(null)
    payForm.setFieldsValue({
      amount: Number(fresh?.debt_amount ?? 0),
      method: activePaymentMethods.find((item) => item.code === 'CASH')?.code ?? activePaymentMethods[0]?.code,
    })
    manualForm.resetFields()
    redeemForm.resetFields()
  }

  /** Chọn voucher của khách (tab Áp ưu đãi). */
  const pickCustomerVoucher = (voucherId: string | null) => {
    setSelectedVoucherId(voucherId)
  }

  /** Áp lựa chọn ưu đãi đang chọn (nếu có nhập giá trị) vào gói trước khi ghi nhận thanh toán. */
  const applyPromoSelection = async (treatmentId: string): Promise<boolean> => {
    if (promoTab === 'discount' && selectedVoucher) {
      const value = Number(selectedVoucher.discountValue ?? 0)
      if (value > 0) {
        try {
          if (selectedVoucher.discountType === 'PERCENT') {
            await manualDiscountMutation.mutateAsync({ id: treatmentId, data: { mode: 'percent', value } })
          } else {
            await manualDiscountMutation.mutateAsync({ id: treatmentId, data: { mode: 'amount', value } })
          }
        } catch (err) {
          message.error(errorMessage(err, 'Không thể áp dụng voucher'))
          return false
        }
        // Đánh dấu voucher đã dùng sau khi áp giảm thành công — lỗi chỉ cảnh báo, không chặn thanh toán
        if (selectedVoucher.assignmentId) {
          try {
            await useVoucherCustomer('treatment-package', selectedVoucher.assignmentId)
          } catch (err) {
            message.warning(`Đã áp giảm nhưng không đánh dấu được voucher đã dùng: ${errorMessage(err)}`)
          }
        }
        return true
      }
      return true
    }
    if (promoTab === 'manual' && manualValue > 0) {
      try {
        await manualDiscountMutation.mutateAsync({ id: treatmentId, data: { mode: manualMode, value: Number(manualValue) } })
        return true
      } catch (err) {
        message.error(errorMessage(err, 'Không thể áp dụng giảm trực tiếp'))
        return false
      }
    }
    if (promoTab === 'redeem' && redeemPointsValue > 0) {
      if (!canSubmitRedeem) {
        message.error(redeemValidationMessage || 'Không thể đổi điểm với giá trị hiện tại')
        return false
      }
      try {
        await redeemPointsMutation.mutateAsync({ id: treatmentId, data: { points: redeemPointsValue } })
        return true
      } catch (err) {
        message.error(errorMessage(err, 'Không thể đổi điểm'))
        return false
      }
    }
    return true
  }

  const activeFilterCount = (filter !== 'all' ? 1 : 0) + (pkgFilter ? 1 : 0) + (branchFilter ? 1 : 0) + (search ? 1 : 0)

  const applyFilters = (values: Record<string, unknown>) => {
    setFilter(typeof values.status === 'string' && values.status ? values.status : 'all')
    setPkgFilter(typeof values.package_id === 'string' && values.package_id ? values.package_id : undefined)
    setBranchFilter(typeof values.branch_id === 'string' && values.branch_id ? values.branch_id : undefined)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setFilter('all')
    setPkgFilter(undefined)
    setBranchFilter(undefined)
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ status: filter, package_id: pkgFilter, branch_id: branchFilter })
  }

  const renderFilterPopover = (trigger?: ReactNode) => (
    <ListFilterPopover
      iconOnly={isMobile}
      trigger={trigger}
      open={filterOpen}
      onOpenChange={openFilters}
      activeFilterCount={activeFilterCount}
      form={filterForm}
      onApply={applyFilters}
      onClear={clearFilters}
      filterItems={(
        <>
          <Form.Item name="package_id" label={isSingle ? 'Dịch vụ lẻ' : 'Gói liệu trình'} className="mb-2.5!">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả"
              options={packages.map((pkg) => ({ value: pkg.id, label: pkg.name }))}
            />
          </Form.Item>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái" className="mb-0!">
                <Select options={FILTERS} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="branch_id" label="Cơ sở" className="mb-0!">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Tất cả"
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}
    />
  )

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
      <PageTitle
        className="treatment-customers-title"
        summary={(
          <>
            <div className="desktop-only">
              <StatCards items={treatmentsQuery.isLoading ? statItems.map((item) => ({
                ...item, value: <Skeleton.Input active size="small" />,
              })) : statItems} />
            </div>
            <MobileStatCards items={statItems} loading={treatmentsQuery.isLoading} />
          </>
        )}
        subtitle={isSingle ? 'Khách hàng đăng ký dịch vụ lẻ' : 'Khách hàng đang thực hiện dịch vụ'}
        left={
          !isMobile ? (
            <>
              <Input.Search
                allowClear
                placeholder="Tìm tên hoặc SĐT khách hàng"
                aria-label="Tìm khách hàng"
                className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
                value={searchInput}
                onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
                onSearch={(v) => applySearch(v)}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={isSingle ? 'Tất cả dịch vụ lẻ' : 'Tất cả liệu trình'}
                aria-label={isSingle ? 'Lọc theo dịch vụ lẻ' : 'Lọc theo liệu trình'}
                loading={packagesQuery.isLoading}
                style={{ minWidth: 160 }}
                value={pkgFilter}
                onChange={(value) => { setPkgFilter(value); setPage(1) }}
                options={packages.map((pkg) => ({ value: pkg.id, label: pkg.name }))}
              />
              <Select
                placeholder="Trạng thái"
                aria-label="Lọc theo trạng thái"
                style={{ width: 150 }}
                value={filter}
                onChange={(value) => { setFilter(value); setPage(1) }}
                options={FILTERS}
              />
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Tất cả cơ sở"
                aria-label="Lọc theo cơ sở"
                loading={branchesQuery.isLoading}
                style={{ width: 160 }}
                value={branchFilter}
                onChange={(value) => { setBranchFilter(value); setPage(1) }}
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              />
            </>
          ) : undefined
        }
        right={
          !isMobile ? (
            <Can I="UPDATE" a="CUSTOMER">
              <Button type="primary" icon={<PlusOutlined />} aria-label={isSingle ? 'Thêm khách dịch vụ lẻ' : 'Thêm khách vào liệu trình'} onClick={() => openCreateModal()}>
                <span className="md:max-lg:hidden">{isSingle ? 'Thêm khách dịch vụ lẻ' : 'Thêm khách vào liệu trình'}</span>
              </Button>
            </Can>
          ) : undefined
        }
      >
        {isSingle ? 'Dịch vụ lẻ khách hàng' : 'Liệu trình khách hàng'}
      </PageTitle>
      {/* docs 6.2.1: mobile → [Tìm] / [Bộ lọc][+] */}
      {isMobile && (
        <div className="toolbar-row mb-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm tên hoặc SĐT khách hàng"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Tìm khách hàng"
            className="col-span-full"
          />
          {renderFilterPopover(
            <Button className="keep-label" icon={<FilterOutlined />}>
              Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>,
          )}
          <Can I="UPDATE" a="CUSTOMER">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              aria-label={isSingle ? 'Thêm khách dịch vụ lẻ' : 'Thêm khách vào liệu trình'}
              onClick={() => openCreateModal()}
            >
              {isSingle ? 'Thêm khách dịch vụ lẻ' : 'Thêm khách vào liệu trình'}
            </Button>
          </Can>
        </div>
      )}

      {treatmentsQuery.isLoading ? (
        <TreatmentLoading label={isSingle ? 'Đang tải khách dịch vụ lẻ' : 'Đang tải liệu trình khách hàng'} />
      ) : treatmentsQuery.isError && !treatmentsQuery.data ? (
        <Alert type="error" showIcon message="Không tải được danh sách khách hàng"
          description={errorMessage(treatmentsQuery.error)}
          action={<Button size="small" onClick={() => void treatmentsQuery.refetch()}>Thử lại</Button>} />
      ) : (
      <>
      <Table<CustomerTreatment>
        className="desktop-only max-lg:hidden!"
        rowKey="id"
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: <TableEmpty description={activeFilterCount ? 'Không có kết quả' : 'Chưa có dữ liệu'} /> }}
        onRow={(row) => ({ onClick: () => openDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: isSingle ? 'Mã' : 'Mã gói',
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
            title: 'Cơ sở',
            key: 'branch',
            dataIndex: ['branch', 'name'],
            width: 130,
            render: (v: string | undefined, row: CustomerTreatment) => v || branches.find((branch) => branch.id === row.branch_id)?.name || '—',
          },
          {
            title: 'Tiến độ',
            key: 'progress',
            width: 150,
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
              return <Tag color="gold">Trọn đời</Tag>
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
          ...(isSingle ? [] : [{
            title: 'Hạn sử dụng',
            key: 'expiry',
            width: 120,
            render: (_: unknown, row: CustomerTreatment) =>
              row.expires_at ? dayjs(row.expires_at).format('DD/MM/YYYY') : 'Không hạn',
          }]),
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'status',
            width: 110,
            render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
        ]}
      />
      <MobileCards
        className="treatment-customer-cards"
        rows={rows}
        rowKey={(row) => row.id}
        onCardClick={(row) => openDetail(row)}
        emptyText={activeFilterCount ? 'Không có kết quả' : 'Chưa có dữ liệu'}
        emptyDescription={activeFilterCount ? 'Thử đổi từ khóa hoặc bộ lọc.' : undefined}
        renderCard={(row) => {
          const usage = row.quota_type === 'SESSIONS' ? sessionUsage(row) : null
          return (
            <>
              <div className="mobile-card-head">
                <div className="mobile-card-title">{profileName(row)}</div>
                <Tag color={STATUS_META[row.status as string]?.color}>{STATUS_META[row.status as string]?.label ?? row.status}</Tag>
              </div>
              <div className="mobile-card-rows">
                <MobileCardRow label="Mã gói" value={`G-${treatmentCode(row)}`} />
                <MobileCardRow label="Gói" value={packageName(row)} />
                <MobileCardRow label="Cơ sở" value={(row as CustomerTreatment & { branch?: { name?: string } }).branch?.name || branches.find((branch) => branch.id === row.branch_id)?.name || '—'} />
                {usage
                  ? <MobileCardRow label="Tiến độ" value={`${usage.used}/${usage.total} buổi`} />
                  : row.quota_type === 'VALUE'
                    ? <MobileCardRow label="Tiến độ" value={`Định mức ${formatMoney(row.value_used)} / ${formatMoney(row.value_total)}`} />
                    : <MobileCardRow label="Tiến độ" value="Trọn đời" />}
                {canReadPayments && (
                  <MobileCardRow
                    label="Thanh toán"
                    value={
                      <>
                        {formatMoney(row.paid_amount)} / {formatMoney(row.total_amount)}
                        {(row.debt_amount ?? 0) > 0 && (
                          <span style={{ color: '#B45309' }}> · Nợ {formatMoney(row.debt_amount)}</span>
                        )}
                      </>
                    }
                  />
                )}
                <MobileCardRow label="Hạn sử dụng" value={row.expires_at ? dayjs(row.expires_at).format('DD/MM/YYYY') : 'Không hạn'} />
              </div>
              {/* 2 nút tách cho mobile: "Tổng quan" mở panel tóm tắt+nút thao tác,
                  "Chi tiết" mở tab Buổi / Lịch sử thanh toán / Điểm thưởng — khỏi popup quá tải */}
              <div className="mobile-card-actions">
                <Button size="small" type="primary" onClick={(event) => { event.stopPropagation(); openDetail(row, 'summary') }}>Tổng quan</Button>
                <Button size="small" onClick={(event) => { event.stopPropagation(); openDetail(row, 'tabs') }}>Chi tiết</Button>
              </div>
            </>
          )
        }}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="khách điều trị" />
      </>
      )}

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
        branches={branches}
        submitting={createMutation.isPending}
        onPackageChange={onCreatePackageChange}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void submitCreate()}
        isSingle={isSingle}
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
        quotaType={addSessionFor?.quota_type}
        remainingValue={addSessionFor ? Math.max(Number(addSessionFor.value_total || 0) - Number(addSessionFor.value_used || 0), 0) : undefined}
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
        submitting={createPaymentMutation.isPending || manualDiscountMutation.isPending || redeemPointsMutation.isPending}
        promoRow={promoRow}
        formatMoney={formatMoney}
        promoTab={promoTab}
        onPromoTabChange={setPromoTab}
        customerVouchers={customerVouchers}
        vouchersLoading={customerVouchersQuery.isFetching}
        selectedVoucherId={selectedVoucherId}
        onPickVoucher={pickCustomerVoucher}
        manualForm={manualForm}
        manualMode={manualMode}
        onManualModeChange={setManualMode}
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
        redeemValidationMessage={redeemValidationMessage}
        promoDiscount={promoDiscount}
        promoRemaining={promoRemaining}
        canReadDiscount={canReadDiscount}
        canRedeemPoints={canRedeemPoints}
        onCancel={() => { setPayOpen(false); setPayTargetId(null) }}
        onOk={() => void submitPayment()}
      />

      <TreatmentDetailModal
        detail={detail}
        detailLoading={detailLoading}
        payOpen={payOpen}
        mobileSection={detailMobileSection}
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
        onPay={(row) => { void openPay(row.id) }}
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
        onEdit={openEdit}
        onClose={() => { detailRequest.current += 1; setDetail(null) }}
      />

      <TreatmentEditModal
        form={editForm}
        open={editOpen}
        row={editRow}
        currencySymbol={currencySymbol}
        customFieldDefs={customerTreatmentCustomFields}
        submitting={editSaving}
        onCancel={() => setEditOpen(false)}
        onOk={() => void submitEdit()}
      />
    </>
  )
}
