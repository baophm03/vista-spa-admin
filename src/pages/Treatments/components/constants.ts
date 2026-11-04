import type { TreatmentPackage } from '@/api/models/treatmentPackage'

export type QuotaType = TreatmentPackage['quota_type']
export type ValidityUnit = NonNullable<TreatmentPackage['validity_unit']>

export interface PackageTypeRow {
  id: string
  code: string
  name: string
  default_quota_type: QuotaType
  has_warranty?: boolean
  allow_unlimited?: boolean
  sort_order?: number
  is_active?: boolean
}

export interface TreatmentPackageRow extends TreatmentPackage {
  service_ids?: string[]
  package_type?: { id?: string; name?: string; code?: string } | null
}

export type PackageColumnKey = 'name' | 'branch' | 'type' | 'quota' | 'services' | 'price' | 'validity' | 'bonus' | 'status'
export type PackageFiltersForm = { package_type_id?: string; branch_id?: string; is_active?: 'true' | 'false' }
export type PackageTypeForm = {
  code: string
  name: string
  default_quota_type: QuotaType
  has_warranty: boolean
  allow_unlimited: boolean
  sort_order: number
  is_active: boolean
}

export const QUOTA_LABEL: Record<QuotaType, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn gói',
}
export const VALIDITY_LABEL: Record<ValidityUnit, string> = {
  DAY: 'ngày',
  WEEK: 'tuần',
  MONTH: 'tháng',
}
export const COLUMN_OPTIONS: { label: string; value: PackageColumnKey }[] = [
  { label: 'Tên gói', value: 'name' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Loại gói', value: 'type' },
  { label: 'Hạn mức', value: 'quota' },
  { label: 'Dịch vụ', value: 'services' },
  { label: 'Giá niêm yết', value: 'price' },
  { label: 'Thời hạn', value: 'validity' },
  { label: 'Buổi tặng', value: 'bonus' },
  { label: 'Trạng thái', value: 'status' },
]
export const DEFAULT_COLUMNS: PackageColumnKey[] = ['name', 'branch', 'type', 'quota', 'price', 'status']
export const PACKAGE_TYPE_QUOTA_OPTIONS = Object.entries(QUOTA_LABEL).map(([value, label]) => ({ value, label }))
export const PACKAGE_STATUS_OPTIONS = [
  { value: 'true', label: 'Đang bán' },
  { value: 'false', label: 'Đã ẩn' },
]

export function quotaLabel(row: TreatmentPackage, formatMoney: (value: unknown) => string) {
  if (row.quota_type === 'SESSIONS') return String(row.total_sessions ?? '—') + ' buổi'
  if (row.quota_type === 'VALUE') return formatMoney(row.total_value)
  return 'Không giới hạn'
}

export function priceLabel(row: TreatmentPackage, formatMoney: (value: unknown) => string) {
  const minimum = formatMoney(row.list_price)
  return row.list_price_max != null
    ? minimum + ' – ' + formatMoney(row.list_price_max)
    : minimum
}
