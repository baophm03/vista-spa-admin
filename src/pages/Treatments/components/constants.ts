import type { TreatmentPackage } from '@/api/models/treatmentPackage'

export type QuotaType = TreatmentPackage['quota_type']
export type ValidityUnit = NonNullable<TreatmentPackage['validity_unit']>

export interface PackageTypeRow {
  id: string
  code: string
  name: string
  has_warranty?: boolean
  allow_unlimited?: boolean
  sort_order?: number
  is_active?: boolean
}

export interface TreatmentPackageRow extends TreatmentPackage {
  package_type?: { id?: string; name?: string; code?: string } | null
  image_file_id?: string | null
  image_file?: { id?: string; path?: string; file_name?: string } | null
}

/**
 * 3 loại gói cố định — loại gói quyết định cách tính (BE tự suy ra quota_type, client không gửi):
 * - VALUE_QUOTA       "Gói lẻ"   → theo số tiền (định mức = giá bán, mỗi buổi trừ giá trị buổi)
 * - FIXED_PACKAGE     "Gói buổi" → theo số buổi (nhập số buổi >= 1)
 * - UNLIMITED_PACKAGE "Trọn đời" → theo số buổi, không giới hạn
 */
export const VALUE_QUOTA_TYPE_CODE = 'VALUE_QUOTA'
export const FIXED_PACKAGE_TYPE_CODE = 'FIXED_PACKAGE'
export const UNLIMITED_PACKAGE_TYPE_CODE = 'UNLIMITED_PACKAGE'
export const PACKAGE_TYPE_CODES = [VALUE_QUOTA_TYPE_CODE, FIXED_PACKAGE_TYPE_CODE, UNLIMITED_PACKAGE_TYPE_CODE]
export const PACKAGE_TYPE_LABEL: Record<string, string> = {
  [VALUE_QUOTA_TYPE_CODE]: 'Gói lẻ',
  [FIXED_PACKAGE_TYPE_CODE]: 'Gói buổi',
  [UNLIMITED_PACKAGE_TYPE_CODE]: 'Trọn đời',
}
export const PACKAGE_TYPE_QUOTA: Record<string, QuotaType> = {
  [VALUE_QUOTA_TYPE_CODE]: 'VALUE',
  [FIXED_PACKAGE_TYPE_CODE]: 'SESSIONS',
  [UNLIMITED_PACKAGE_TYPE_CODE]: 'UNLIMITED',
}
export const PACKAGE_TYPE_HINT: Record<string, string> = {
  [VALUE_QUOTA_TYPE_CODE]: 'Theo số tiền',
  [FIXED_PACKAGE_TYPE_CODE]: 'Theo số buổi',
  [UNLIMITED_PACKAGE_TYPE_CODE]: 'Không giới hạn buổi',
}

/** Nhãn loại gói của 1 gói: ưu tiên tên loại từ API, fallback nhãn cố định theo code / quota_type (dữ liệu cũ). */
export function packageTypeLabel(
  row: Pick<TreatmentPackageRow, 'quota_type' | 'package_type_id'> & { package_type?: { name?: string; code?: string } | null },
  packageTypeById?: Map<string, PackageTypeRow>,
): string {
  const type = row.package_type && typeof row.package_type === 'object'
    ? row.package_type
    : packageTypeById?.get(String(row.package_type_id))
  const code = String(type?.code ?? '').toUpperCase()
  return PACKAGE_TYPE_LABEL[code] ?? type?.name ?? 'Chưa phân loại'
}

export const VALIDITY_LABEL: Record<ValidityUnit, string> = {
  DAY: 'ngày',
  WEEK: 'tuần',
  MONTH: 'tháng',
}
export const PACKAGE_STATUS_OPTIONS = [
  { value: 'true', label: 'Đang bán' },
  { value: 'false', label: 'Đã ẩn' },
]

export function quotaLabel(row: TreatmentPackage, formatMoney: (value: unknown) => string) {
  if (row.quota_type === 'SESSIONS') return String(row.total_sessions ?? '—') + ' buổi'
  if (row.quota_type === 'VALUE') return formatMoney(row.total_value)
  return 'Không giới hạn'
}

export function priceLabel(row: TreatmentPackage, formatMoney: (value?: number | null | undefined) => string) {
  const minimum = formatMoney(row.list_price)
  return row.list_price_max != null
    ? minimum + ' – ' + formatMoney(row.list_price_max)
    : minimum
}
