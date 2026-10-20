import { api, unwrap } from './client'

/**
 * API layer cho NEWSKY+ backend — envelope { success, data, meta }.
 * Legacy endpoints (users, vouchers, service, roles) dùng envelope responseData — đã có unwrap().
 */

export interface BizEnvelope<T> {
  success: boolean
  data: T
  meta?: { page?: number; limit?: number; total?: number; suggestions?: unknown }
  code?: string
  message?: string
}

export async function biz<T = unknown>(promise: Promise<{ data: unknown }>): Promise<T> {
  const body: any = (await promise).data
  if (body?.success === false) throw new Error(body.message || body.code || 'Request failed')
  return (body?.data ?? body) as T
}

export async function bizWithMeta<T = unknown>(
  promise: Promise<{ data: unknown }>,
): Promise<{ data: T; meta?: BizEnvelope<T>['meta'] }> {
  const body: any = (await promise).data
  if (body?.success === false) throw new Error(body.message || body.code || 'Request failed')
  return { data: body?.data ?? body, meta: body?.meta }
}

export function bizErrorMessage(err: unknown): string {
  const e: any = err
  return e?.response?.data?.message || e?.message || 'Có lỗi xảy ra'
}

// ---------- Branches ----------
export interface Branch {
  id: string
  code: string
  name: string
  address?: string
  phone?: string
  is_active?: boolean
}
export const listBranches = () => biz<Branch[]>(api.get('/branches'))
export const createBranch = (dto: Partial<Branch>) => biz<Branch>(api.post('/branches', dto))
export const updateBranch = (id: string, dto: Partial<Branch>) => biz<Branch>(api.put(`/branches/${id}`, dto))
export const deleteBranch = (id: string) => biz(api.delete(`/branches/${id}`))

// ---------- Customer profiles ----------
export interface CustomerProfile {
  id: string
  branch_id: string
  customer_code: string
  full_name: string
  phone: string
  birthday?: string
  address?: string
  email?: string
  note?: string
  is_deleted?: boolean
  user_id?: string
  user?: { membership?: { card_rank?: { name?: string } | null } | null } | null
  custom_fields?: Record<string, unknown>
}
export interface PageMeta {
  page?: number
  limit?: number
  total?: number
}
export const listCustomerProfiles = (params: Record<string, unknown>) =>
  bizWithMeta<CustomerProfile[]>(api.get('/customerProfiles', { params }))
export const getCustomerProfile = (id: string) => biz<CustomerProfile>(api.get(`/customerProfiles/${id}`))
export const getCustomerProfileSummary = (id: string) => biz(api.get(`/customerProfiles/${id}/summary`))
export const createCustomerProfile = (dto: Partial<CustomerProfile>) => biz<CustomerProfile>(api.post('/customerProfiles', dto))
export const updateCustomerProfile = (id: string, dto: Partial<CustomerProfile>) => biz<CustomerProfile>(api.put(`/customerProfiles/${id}`, dto))
export const deleteCustomerProfile = (id: string) => biz(api.delete(`/customerProfiles/${id}`))
export const exportCustomerProfiles = (params: Record<string, unknown>) =>
  api.get('/customerProfiles/export', { params, responseType: 'blob' })

// ---------- Treatment packages ----------
export interface TreatmentPackage {
  id: string
  branch_id?: string
  name: string
  description?: string
  package_type_id?: string
  quota_type?: 'SESSIONS' | 'VALUE' | 'UNLIMITED'
  total_sessions?: number
  total_value?: number
  list_price?: number
  service_id?: string
  is_active?: boolean
}
export const listTreatmentPackages = (params: Record<string, unknown> = {}) =>
  biz<TreatmentPackage[]>(api.get('/treatmentPackages', { params }))
export const getTreatmentPackage = (id: string) => biz<TreatmentPackage>(api.get(`/treatmentPackages/${id}`))
export const createTreatmentPackage = (dto: Partial<TreatmentPackage>) => biz<TreatmentPackage>(api.post('/treatmentPackages', dto))
export const updateTreatmentPackage = (id: string, dto: Partial<TreatmentPackage>) => biz<TreatmentPackage>(api.put(`/treatmentPackages/${id}`, dto))
export const deleteTreatmentPackage = (id: string) => biz(api.delete(`/treatmentPackages/${id}`))

// ---------- Package types ----------
export const listPackageTypes = () => biz(api.get('/packageTypes'))
export const createPackageType = (dto: Record<string, unknown>) => biz(api.post('/packageTypes', dto))

// ---------- Customer treatments ----------
export interface CustomerTreatment {
  id: string
  customer_profile_id: string
  package_id: string
  branch_id: string
  quota_type: 'SESSIONS' | 'VALUE' | 'UNLIMITED'
  sessions_total?: number
  sessions_used?: number
  value_total?: number
  value_used?: number
  total_amount: number
  paid_amount: number
  debt_amount: number
  progress_percent?: number
  payment_status: 'UNPAID' | 'PARTIAL' | 'PAID'
  status: 'ACTIVE' | 'FINISHED' | 'CANCELLED'
  customer_profile?: { full_name?: string; phone?: string }
  package_type?: { name?: string }
}
export const listCustomerTreatments = (params: Record<string, unknown> = {}) =>
  biz<CustomerTreatment[]>(api.get('/customerTreatments', { params }))
export const getCustomerTreatment = (id: string) => biz<CustomerTreatment>(api.get(`/customerTreatments/${id}`))
export const createCustomerTreatment = (dto: Record<string, unknown>) => biz<CustomerTreatment>(api.post('/customerTreatments', dto))
export const cancelCustomerTreatment = (id: string) => biz(api.put(`/customerTreatments/${id}/cancel`))
export const listTreatmentSessions = (id: string) => biz(api.get(`/customerTreatments/${id}/sessions`))
export const createTreatmentSession = (id: string, dto: Record<string, unknown> = {}) => biz(api.post(`/customerTreatments/${id}/sessions`, dto))
export const listTreatmentPayments = (id: string) => biz(api.get(`/customerTreatments/${id}/payments`))
export const createTreatmentPayment = (id: string, dto: Record<string, unknown>) => biz(api.post(`/customerTreatments/${id}/payments`, dto))

// ---------- Sessions ----------
export const updateSession = (id: string, dto: Record<string, unknown>) => biz(api.put(`/sessions/${id}`, dto))
export const startSession = (id: string) => biz(api.put(`/sessions/${id}/start`))
export const doneSession = (id: string, dto: Record<string, unknown> = {}) => biz(api.put(`/sessions/${id}/done`, dto))
export const completeSession = (id: string) => biz(api.put(`/sessions/${id}/complete`))
export const listSessionPhotos = (id: string) => biz(api.get(`/sessions/${id}/photos`))
export const createSessionPhoto = (id: string, dto: Record<string, unknown>) =>
  biz(api.post(`/sessions/${id}/photos`, dto))
export const uploadFile = (file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return unwrap<{ fileName: string; contentType?: string; original: string }>(api.post('/files', fd))
}
export const deleteSession = (id: string) => biz(api.delete(`/sessions/${id}`))

// ---------- Payments ----------
export const listPayments = (params: Record<string, unknown> = {}) => bizWithMeta(api.get('/payments', { params }))
export const voidPayment = (id: string, reason: string) => biz(api.post(`/payments/${id}/void`, { void_reason: reason }))

// ---------- Appointments ----------
export type AppointmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'in_progress' | 'completed'
export interface Appointment {
  id: string
  branch_id: string
  customer_profile_id: string
  service_id: string
  staff_id?: string
  appt_date: string
  start_time: string
  end_time?: string
  status: AppointmentStatus
  created_via?: string
  note?: string
  customer_profile?: CustomerProfile
  service?: { id: string; title: string }
  staff?: { id: string; zalo_name?: string }
}
export const listAppointments = (params: Record<string, unknown>) =>
  bizWithMeta<Appointment[]>(api.get('/appointments', { params }))
export const getAppointment = (id: string) => biz<Appointment>(api.get(`/appointments/${id}`))
export const createAppointment = (dto: Record<string, unknown>) => biz<Appointment>(api.post('/appointments', dto))
export const rescheduleAppointment = (id: string, dto: Record<string, unknown>) => biz<Appointment>(api.put(`/appointments/${id}`, dto))
export const approveAppointment = (id: string, dto: Record<string, unknown> = {}) => biz<Appointment>(api.put(`/appointments/${id}/approve`, dto))
export const rejectAppointment = (id: string, reason: string) => biz<Appointment>(api.put(`/appointments/${id}/reject`, { reason }))
export const cancelAppointment = (id: string) => biz<Appointment>(api.put(`/appointments/${id}/cancel`))
export const startAppointment = (id: string) => biz<Appointment>(api.post(`/appointments/${id}/start`))
export const completeAppointment = (id: string) => biz<Appointment>(api.post(`/appointments/${id}/complete`))
export const listAvailableSlots = (params: { branch_id: string; service_id: string; date: string; staff_id?: string }) =>
  biz<{ date: string; start_time: string; end_time: string; staff_ids: string[] }[]>(api.get('/appointments/available-slots', { params }))

// ---------- Staff schedules / days off / shift templates ----------
export interface ShiftTemplate {
  id: string
  name: string
  start_time: string
  end_time: string
  branch_id?: string
  is_active?: boolean
}
export interface StaffSchedule {
  id: string
  staff_id: string
  branch_id: string
  weekday: number
  shift_template_id: string
  is_active?: boolean
  staff?: { id: string; zalo_name?: string }
  shift_template?: ShiftTemplate
}
export interface StaffDayOff {
  id: string
  staff_id: string
  off_date: string
  shift_template_id?: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
}
export const listShiftTemplates = () => biz<ShiftTemplate[]>(api.get('/shiftTemplates'))
export const createShiftTemplate = (dto: Partial<ShiftTemplate>) => biz<ShiftTemplate>(api.post('/shiftTemplates', dto))
export const updateShiftTemplate = (id: string, dto: Partial<ShiftTemplate>) => biz<ShiftTemplate>(api.put(`/shiftTemplates/${id}`, dto))
export const deleteShiftTemplate = (id: string) => biz(api.delete(`/shiftTemplates/${id}`))
export const listStaffSchedules = (params: Record<string, unknown> = {}) => biz<StaffSchedule[]>(api.get('/staffSchedules', { params }))
export const createStaffSchedule = (dto: Partial<StaffSchedule>) => biz<StaffSchedule>(api.post('/staffSchedules', dto))
export const updateStaffSchedule = (id: string, dto: Partial<StaffSchedule>) => biz<StaffSchedule>(api.put(`/staffSchedules/${id}`, dto))
export const deleteStaffSchedule = (id: string) => biz(api.delete(`/staffSchedules/${id}`))
export const listStaffDaysOff = (params: Record<string, unknown> = {}) => biz<StaffDayOff[]>(api.get('/staffDaysOff', { params }))
export const createStaffDayOff = (dto: Partial<StaffDayOff>) => biz<StaffDayOff>(api.post('/staffDaysOff', dto))
export const approveStaffDayOff = (id: string) => biz(api.put(`/staffDaysOff/${id}/approve`))
export const rejectStaffDayOff = (id: string, reason: string) => biz(api.put(`/staffDaysOff/${id}/reject`, { reason }))
export const deleteStaffDayOff = (id: string) => biz(api.delete(`/staffDaysOff/${id}`))

// ---------- Reports ----------
export const reportRevenue = (params: Record<string, unknown> = {}) => biz(api.get('/reports/revenue', { params }))
export const reportDebts = (params: Record<string, unknown> = {}) => biz(api.get('/reports/debts', { params }))
export const reportRanks = (params: Record<string, unknown> = {}) => biz(api.get('/reports/ranks', { params }))
export const reportAppointments = (params: Record<string, unknown> = {}) => biz(api.get('/reports/appointments', { params }))

// ---------- Card ranks / memberships ----------
export const listCardRanks = () => biz(api.get('/cardRanks'))
export const createCardRank = (dto: Record<string, unknown>) => biz(api.post('/cardRanks', dto))
export const updateCardRank = (id: string, dto: Record<string, unknown>) => biz(api.put(`/cardRanks/${id}`, dto))
export const recalculateMembership = (userId: string) => biz(api.post(`/memberships/${userId}/recalculate`))
export const overrideRank = (userId: string, dto: Record<string, unknown>) => biz(api.post(`/memberships/${userId}/rank-override`, dto))
export const adjustPoints = (userId: string, dto: { delta: number; reason?: string }) => biz(api.post(`/memberships/${userId}/points-adjust`, dto))

// ---------- Academy ----------
export interface AcademyCourse {
  id: string
  branch_id?: string
  code: string
  name: string
  category: string
  level: string
  tuition: number
  is_active?: boolean
}
export const listAcademyCourses = (params: Record<string, unknown> = {}) => biz<AcademyCourse[]>(api.get('/academy/courses', { params }))
export const createAcademyCourse = (dto: Partial<AcademyCourse>) => biz<AcademyCourse>(api.post('/academy/courses', dto))
export const updateAcademyCourse = (id: string, dto: Partial<AcademyCourse>) => biz<AcademyCourse>(api.put(`/academy/courses/${id}`, dto))
export const deleteAcademyCourse = (id: string) => biz(api.delete(`/academy/courses/${id}`))
export const listAcademyRegistrations = (params: Record<string, unknown> = {}) => biz(api.get('/academy/registrations', { params }))
export const createAcademyRegistration = (dto: Record<string, unknown>) => biz(api.post('/academy/registrations', dto))
export const updateAcademyRegistration = (id: string, dto: Record<string, unknown>) => biz(api.put(`/academy/registrations/${id}`, dto))
export const cancelAcademyRegistration = (id: string) => biz(api.delete(`/academy/registrations/${id}`))
export const findReturningStudent = (params: { phone?: string; email?: string }) => biz(api.get('/academy/registrations/find-student', { params }))

// ---------- Lucky wheels ----------
export interface LuckyWheel {
  id: string
  branch_id?: string
  name: string
  min_year_spent: number
  spins_per_user: number
  is_active?: boolean
  wheel_prizes?: WheelPrize[]
}
export interface WheelPrize {
  id: string
  wheel_id: string
  name: string
  weight: number
  prize_type: string
  quantity_total?: number
  quantity_given: number
}
export const listLuckyWheels = () => biz<LuckyWheel[]>(api.get('/luckyWheels'))
export const getLuckyWheel = (id: string) => biz<LuckyWheel>(api.get(`/luckyWheels/${id}`))
export const createLuckyWheel = (dto: Partial<LuckyWheel>) => biz<LuckyWheel>(api.post('/luckyWheels', dto))
export const updateLuckyWheel = (id: string, dto: Partial<LuckyWheel>) => biz<LuckyWheel>(api.put(`/luckyWheels/${id}`, dto))
export const deleteLuckyWheel = (id: string) => biz(api.delete(`/luckyWheels/${id}`))
export const listWheelPrizes = (wheelId: string) => biz<WheelPrize[]>(api.get(`/luckyWheels/${wheelId}/prizes`))
export const createWheelPrize = (wheelId: string, dto: Partial<WheelPrize>) => biz<WheelPrize>(api.post(`/luckyWheels/${wheelId}/prizes`, dto))
export const listWheelSpins = (wheelId: string) => biz(api.get(`/luckyWheels/${wheelId}/spins`))

// ---------- Notifications ----------
export interface NotificationRow {
  id: string
  user_id?: string
  event_key: string
  title?: string
  body?: string
  channel?: string
  is_read?: boolean
  sent_at?: string
}
export const listNotifications = (params: Record<string, unknown> = {}) =>
  bizWithMeta<NotificationRow[]>(api.get('/notifications', { params }))
export const sendNotification = (dto: Record<string, unknown>) => biz(api.post('/notifications', dto))
export const markNotificationRead = (id: string) => biz(api.put(`/notifications/${id}`))

// ---------- Services (legacy) ----------
export interface ServiceRow {
  id: string
  title: string
  description?: string
  type: number
  required_points?: number
  duration_minutes?: number
}
export const listServices = async (): Promise<ServiceRow[]> => {
  const data: any = await unwrap(api.get('/service'))
  return data?.services ?? (Array.isArray(data) ? data : [])
}
export const createService = (dto: Partial<ServiceRow>) => unwrap<ServiceRow>(api.post('/service', dto))
export const updateService = (id: string, dto: Partial<ServiceRow>) => unwrap<ServiceRow>(api.put(`/service/${id}`, dto))
export const deleteService = (id: string) => unwrap(api.delete(`/service/${id}`))

// ---------- Vouchers (legacy) ----------
export interface VoucherRow {
  id: string
  title: string
  required_points?: number
  /** 0=Tất cả hạng, 1=Silver, 2=Gold, 3=Diamond, 4=VIP (contract BE) */
  type?: number
  start_date?: string
  end_date?: string
  is_active?: boolean
}
/** Legacy paging middleware dùng currentPage/pageSize thay vì page/limit. */
const legacyPage = (params: Record<string, unknown>) => {
  const { page, limit, ...rest } = params
  return { currentPage: page ?? 1, pageSize: limit ?? 10, ...rest }
}

export const listVouchers = (params: Record<string, unknown> = {}) => unwrap<any>(api.get('/vouchers', { params: legacyPage(params) }))
export const createVoucher = (dto: Partial<VoucherRow>) => unwrap<VoucherRow>(api.post('/vouchers', dto))
export const updateVoucher = (id: string, dto: Partial<VoucherRow>) => unwrap<VoucherRow>(api.put(`/vouchers/${id}`, dto))
export const deleteVoucher = (id: string) => unwrap(api.delete(`/vouchers/${id}`))

// ---------- User vouchers / Đổi quà (legacy envelope) ----------
export interface UserVoucherRow {
  id: string
  user_id: string
  voucher_id: string
  status: string
  redeemed_at?: string
  note?: string
  voucher?: { id: string; title: string; required_points?: number }
  user?: { id: string; zalo_name?: string; phone_number?: string }
}
export const listRedeemedVouchers = (params: Record<string, unknown> = {}) =>
  unwrap<any>(api.get('/vouchers/redeemed', { params: legacyPage(params) }))
export const redeemVoucher = (voucherId: string, dto: { user_id: string; membership_id?: string; note?: string }) =>
  unwrap(api.post(`/vouchers/${voucherId}/redeem`, dto))
export const markVoucherUsed = (dto: { user_voucher_id: string; note?: string }) =>
  unwrap(api.post('/vouchers/mark-used', dto))
export const revokeUserVoucher = (dto: { user_voucher_id: string; reason?: string }) =>
  unwrap(api.post('/vouchers/revoke', dto))
export const voucherStatistics = (params: Record<string, unknown> = {}) =>
  unwrap<any>(api.get('/vouchers/statistics', { params }))

// ---------- Membership info (legacy) ----------
export const getRankTierInfo = () => unwrap<any>(api.get('/membership/rank-tier-info'))
export const syncMembership = (userId: string) => unwrap(api.post('/membership', { user_id: userId }))

// ---------- Custom field defs (NEWSKY+) ----------
export interface CustomFieldDef {
  id: string
  entity: string
  key: string
  label: string
  data_type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'bool'
  options?: string[] | null
  required?: boolean
  sort_order?: number
}
export const listCustomFieldDefs = (params: Record<string, unknown> = {}) =>
  biz<CustomFieldDef[]>(api.get('/customFieldDefs', { params }))
export const createCustomFieldDef = (dto: Record<string, unknown>) => biz(api.post('/customFieldDefs', dto))
export const updateCustomFieldDef = (id: string, dto: Record<string, unknown>) => biz(api.put(`/customFieldDefs/${id}`, dto))
export const deleteCustomFieldDef = (id: string) => biz(api.delete(`/customFieldDefs/${id}`))

// ---------- Users admin (legacy) ----------
export const listUsers = (params: Record<string, unknown> = {}) => unwrap<any>(api.get('/users', { params: legacyPage(params) }))
export const createAdminUser = (dto: Record<string, unknown>) => unwrap(api.post('/users/admin', dto))
export const updateAdminUser = (id: string, dto: Record<string, unknown>) => unwrap(api.put(`/users/admin/${id}`, dto))
export const deleteAdminUser = (id: string) => unwrap(api.delete(`/users/admin/${id}`))

// ---------- Settings / permissions / roles ----------
export const listSettings = () => biz(api.get('/settings'))
export const updateSettings = (dto: Record<string, unknown>) => biz(api.put('/settings', dto))
export const listPermissions = () => biz(api.get('/permissions'))
export const listRoles = async (): Promise<{ id: string; role_name: string }[]> => {
  const data: any = await unwrap(api.get('/roles'))
  return data?.rows ?? (Array.isArray(data) ? data : [])
}
export const getRolePermissions = (roleId: string) => biz(api.get(`/roles/${roleId}/permissions`))
export const updateRolePermissions = (roleId: string, dto: Record<string, unknown>) => biz(api.put(`/roles/${roleId}/permissions`, dto))

// ---------- Access logs ----------
export const listAccessLogs = (params: Record<string, unknown> = {}) =>
  bizWithMeta(api.get('/accessLogs', { params }))
