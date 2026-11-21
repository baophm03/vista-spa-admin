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
  service_ids?: string[]
  package_type?: { id?: string; name?: string; code?: string } | null
  image_file_id?: string | null
  image_file?: { id?: string; path?: string; file_name?: string } | null
}

export type PackageColumnKey = 'name' | 'branch' | 'type' | 'quota' | 'services' | 'price' | 'validity' | 'bonus' | 'status'
export type PackageFiltersForm = { package_type_id?: string; branch_id?: string; is_active?: 'true' | 'false' }

/**
 * "Cách tính" — nhãn hiển thị theo quota_type (thuật ngữ mới, chỉ 3 giá trị):
 * - Theo số buổi: quota SESSIONS (1 buổi = dịch vụ lẻ, từ 2 buổi = gói theo buổi)
 * - Theo mức tiền: quota VALUE (mỗi buổi trừ vào định mức tiền)
 * - Trọn đời: quota UNLIMITED (vô hạn số buổi)
 */
export const CALC_LABEL: Record<QuotaType, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo mức tiền',
  UNLIMITED: 'Trọn đời',
}
export const CALC_OPTIONS = Object.entries(CALC_LABEL).map(([value, label]) => ({ value, label }))

/**
 * 4 loại gói cố định (migration 084/086) — không cho phép thêm loại mới trên UI:
 * - SINGLE_SESSION: dịch vụ lẻ, số buổi cố định 1
 * - FIXED_PACKAGE: theo số buổi, nhập số buổi mong muốn (>= 2)
 * - VALUE_QUOTA: theo định mức tiền, không giới hạn số buổi — mỗi buổi tham gia trừ giá trị buổi
 *   vào định mức, hết định mức gói kết thúc
 * - UNLIMITED_PACKAGE: trọn đời, không giới hạn số buổi
 */
export const SINGLE_SESSION_TYPE_CODE = 'SINGLE_SESSION'
export const COMBO_TYPE_CODE = 'COMBO'
export const FIXED_PACKAGE_TYPE_CODE = 'FIXED_PACKAGE'
export const VALUE_QUOTA_TYPE_CODE = 'VALUE_QUOTA'
export const UNLIMITED_PACKAGE_TYPE_CODE = 'UNLIMITED_PACKAGE'
export const FIXED_PACKAGE_TYPE_CODES = [
  SINGLE_SESSION_TYPE_CODE,
  FIXED_PACKAGE_TYPE_CODE,
  VALUE_QUOTA_TYPE_CODE,
  UNLIMITED_PACKAGE_TYPE_CODE,
]
export const FIXED_PACKAGE_TYPE_LABEL: Record<string, string> = {
  [SINGLE_SESSION_TYPE_CODE]: 'Dịch vụ lẻ',
  [FIXED_PACKAGE_TYPE_CODE]: 'Theo số buổi',
  [VALUE_QUOTA_TYPE_CODE]: 'Theo định mức tiền',
  [UNLIMITED_PACKAGE_TYPE_CODE]: 'Trọn đời',
}

/**
 * 4 chế độ bán của gói liệu trình (nghiệp vụ mới):
 * - Dịch vụ lẻ: 1 gói = 1 dịch vụ, đúng 1 buổi (quota SESSIONS + total_sessions = 1)
 * - Theo buổi: 1 gói = 1 dịch vụ, nhiều buổi (quota SESSIONS + total_sessions >= 2)
 * - Theo giá tiền: mỗi buổi có giá, tổng giá các buổi không vượt định mức (quota VALUE)
 * - Unlimited: vô hạn số buổi (quota UNLIMITED)
 */
export function saleModeLabel(row: Pick<TreatmentPackage, 'quota_type' | 'total_sessions'>): string {
  if (row.quota_type === 'VALUE') return 'Theo mức tiền'
  if (row.quota_type === 'UNLIMITED') return 'Trọn đời'
  return Number(row.total_sessions) === 1 ? 'Dịch vụ lẻ' : 'Theo buổi'
}

/** Nhãn "Cách tính" của gói: suy ra từ quota_type; gói dữ liệu cũ lạ loại thì fallback sang tên loại. */
export function calcLabel(
  row: Pick<TreatmentPackageRow, 'quota_type' | 'package_type_id'> & { package_type?: { name?: string; code?: string } | null },
  packageTypeById?: Map<string, PackageTypeRow>,
): string {
  if (row.quota_type === 'SESSIONS' || row.quota_type === 'VALUE' || row.quota_type === 'UNLIMITED') {
    return CALC_LABEL[row.quota_type]
  }
  const type = row.package_type && typeof row.package_type === 'object'
    ? row.package_type
    : packageTypeById?.get(String(row.package_type_id))
  return type?.name ?? type?.code ?? 'Chưa phân loại'
}
export const VALIDITY_LABEL: Record<ValidityUnit, string> = {
  DAY: 'ngày',
  WEEK: 'tuần',
  MONTH: 'tháng',
}
export const COLUMN_OPTIONS: { label: string; value: PackageColumnKey }[] = [
  { label: 'Tên gói', value: 'name' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Cách tính', value: 'type' },
  { label: 'Dịch vụ', value: 'services' },
  { label: 'Giá niêm yết', value: 'price' },
  { label: 'Thời hạn', value: 'validity' },
  { label: 'Buổi tặng', value: 'bonus' },
  { label: 'Trạng thái', value: 'status' },
]
export const DEFAULT_COLUMNS: PackageColumnKey[] = ['name', 'branch', 'type', 'price', 'status']
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
