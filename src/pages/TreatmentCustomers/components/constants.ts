import dayjs from 'dayjs'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { LookupItem } from '@/api/models/lookupItem'
import type { MembershipTransaction } from '@/api/models/membershipTransaction'
import type { RewardRedemption } from '@/api/models/rewardRedemption'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'

export interface Slot {
  date?: string
  start_time: string
  end_time?: string
  staff_ids: string[]
}

export interface ProfileRow {
  id: string
  full_name?: string
  phone?: string
}

export interface LookupListRow {
  id: string
  key: string
  name: string
  is_active?: boolean
  lookup_items?: LookupItem[]
}

export interface PaymentRow {
  id: string
  amount?: number
  method?: string
  note?: string
  paid_at?: string
  created_at?: string
}

export interface SessionRow {
  id: string
  session_no: number
  status?: string
  staff_id?: string
  appointment_id?: string
  scheduled_at?: string
  appointment?: { appt_date?: string; start_time?: string }
  started_at?: string
  done_at?: string
  completed_at?: string
  diary?: string
  skin_note?: string
  concern?: string
  products_used?: string
  result?: string
  session_value?: number
  product_amount?: number
  is_warranty?: boolean
  custom_fields?: Record<string, unknown>
}

export interface TreatmentAdjustmentRow {
  id: string
  type: string
  reason: string
  amount?: number | null
  before_json?: Record<string, unknown> | null
  after_json?: Record<string, unknown> | null
  created_at?: string
  created_by?: string
}

export type RewardRedemptionRow = RewardRedemption & {
  reward?: {
    name?: string
    type?: string
    benefit_amount?: number | null
    service_id?: string | null
  } | null
}

export const QUOTA_LABEL: Record<string, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn gói',
}

export const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang làm' },
  { value: 'FINISHED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'EXPIRED', label: 'Hết hạn' },
]

export type CustomerTreatmentColumnKey = 'customer' | 'package_code' | 'progress' | 'payment' | 'expiry' | 'status'
export const CUSTOMER_TREATMENT_COLUMN_OPTIONS: { label: string; value: CustomerTreatmentColumnKey }[] = [
  { label: 'Khách hàng', value: 'customer' },
  { label: 'Mã gói', value: 'package_code' },
  { label: 'Tiến độ', value: 'progress' },
  { label: 'Thanh toán', value: 'payment' },
  { label: 'Hạn sử dụng', value: 'expiry' },
  { label: 'Trạng thái', value: 'status' },
]
export const DEFAULT_VISIBLE_COLUMNS = CUSTOMER_TREATMENT_COLUMN_OPTIONS.map((column) => column.value)

export const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang làm', color: 'var(--brand-primary)' },
  FINISHED: { label: 'Hoàn tất', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  EXPIRED: { label: 'Hết hạn', color: 'orange' },
}

export const PAY_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'POS',
  OTHER: 'Khác',
}

export const sessionUsage = (treatment: CustomerTreatment) => {
  const rawTotal = Number(treatment.sessions_total ?? 0)
  const rawUsed = Number(treatment.sessions_used ?? 0)
  const bonus = Number(treatment.sessions_bonus ?? 0)
  const total = Number.isFinite(rawTotal) ? Math.max(0, rawTotal + bonus) : bonus
  const used = Number.isFinite(rawUsed) ? Math.max(0, rawUsed) : 0
  return {
    total,
    used,
    remaining: Math.max(0, total - used),
    percent: total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0,
  }
}

export const ADJUST_TYPE_OPTIONS = [
  { value: 'ADJUST_BONUS', label: 'Số buổi tặng' },
  { value: 'ADJUST_SESSIONS', label: 'Số buổi đã dùng' },
  { value: 'ADJUST_VALUE_TOTAL', label: 'Định mức tiền được dùng' },
  { value: 'ADJUST_VALUE', label: 'Giá trị đã tiêu' },
  { value: 'EXTEND_EXPIRY', label: 'Hạn dùng của gói' },
]
export const ADJUST_TYPE_LABEL: Record<string, string> = {
  ADJUST_SESSIONS: 'Sửa số buổi đã dùng',
  ADJUST_BONUS: 'Sửa buổi tặng',
  ADJUST_VALUE_TOTAL: 'Sửa định mức tiền được dùng',
  ADJUST_VALUE: 'Sửa giá trị đã tiêu',
  EXTEND_EXPIRY: 'Gia hạn hạn dùng',
  CONVERT: 'Chuyển đổi buổi tặng',
  DISCOUNT: 'Giảm giá',
}
export const bonusRemainingOf = (row: CustomerTreatment) =>
  Math.max(0, Number(row.sessions_bonus ?? 0) - Math.max(0, Number(row.sessions_used ?? 0) - Number(row.sessions_total ?? 0)))

/** Đổi 1 giá trị trường lịch sử điều chỉnh thành chữ dễ đọc. */
export const formatAdjustValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return STATUS_META[String(value)]?.label ?? String(value)
  if (field === 'expires_at') return dayjs(String(value)).format('DD/MM/YYYY')
  if (field === 'value_used' || field === 'value_total') return Number(value).toLocaleString('vi-VN') + ' ₫'
  return String(value)
}

/** So sánh before/after thành các dòng "Tên trường: cũ → mới" (chỉ hiện field thay đổi). */
export const adjustmentDiffLines = (row: TreatmentAdjustmentRow): { label: string; before: string; after: string }[] => {
  const before = (row.before_json ?? {}) as Record<string, unknown>
  const after = (row.after_json ?? {}) as Record<string, unknown>
  const lines: { label: string; before: string; after: string }[] = []
  const fields: [string, string][] = [
    ['sessions_bonus', 'Buổi tặng'],
    ['sessions_used', 'Buổi đã dùng'],
    ['value_total', 'Định mức tiền'],
    ['value_used', 'Giá trị đã tiêu'],
    ['expires_at', 'Hạn dùng'],
    ['status', 'Trạng thái'],
  ]
  for (const [field, label] of fields) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      lines.push({ label, before: formatAdjustValue(field, before[field]), after: formatAdjustValue(field, after[field]) })
    }
  }
  if (after.target_service) lines.push({ label: 'Dịch vụ đích', before: '—', after: String(after.target_service) })
  if (!lines.length) {
    lines.push({ label: 'Ghi nhận', before: '—', after: JSON.stringify(after).slice(0, 80) })
  }
  return lines
}

export const treatmentProgress = (treatment: CustomerTreatment): number | null => {
  if (treatment.quota_type === 'SESSIONS') return sessionUsage(treatment).percent
  if (treatment.quota_type === 'VALUE') {
    const total = Number(treatment.value_total ?? 0)
    const used = Number(treatment.value_used ?? 0)
    return total > 0 && Number.isFinite(total) && Number.isFinite(used)
      ? Math.min(100, Math.max(0, Math.round((used / total) * 100)))
      : 0
  }
  return null
}

export function sessionScheduledTimestamp(session: SessionRow): number | null {
  if (session.appointment_id && session.appointment?.appt_date && session.appointment.start_time) {
    const appointmentTime = dayjs(`${session.appointment.appt_date.slice(0, 10)}T${session.appointment.start_time}`)
    return appointmentTime.isValid() ? appointmentTime.valueOf() : null
  }
  if (!session.scheduled_at) return null
  const scheduledTime = dayjs(session.scheduled_at)
  return scheduledTime.isValid() ? scheduledTime.valueOf() : null
}

export function customFieldValueText(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const HIDDEN_TREATMENT_SYSTEM_FIELDS = new Set(['target_service_id', 'converted_from_treatment_id'])
export const TREATMENT_SYSTEM_FIELD_LABELS: Record<string, string> = {
  target_service_name: 'Dịch vụ áp dụng',
}

export function readableCustomFieldLabel(key: string, definitions: CustomFieldDefWithOptions[]): string {
  const definedLabel = definitions.find((field) => field.key === key)?.label
  if (definedLabel) return definedLabel
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export type MembershipHistoryRow = MembershipTransaction
