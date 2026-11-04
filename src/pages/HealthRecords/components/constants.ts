import dayjs from 'dayjs'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import type { CustomerProfileRow } from '@/components/CustomerProfileOverviewTab'
import type { Appointment } from '@/api/models/appointment'

export const labelStyle = { fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8D93', fontWeight: 600 } as const

export interface HealthFields {
  checked_date?: string
  checked_by?: string
  medical_history?: string
  skin_type?: string
  condition?: string
  allergies?: string
  protocol?: string
  products_used?: string
  advice?: string
  note?: string
}

export type HealthRow = CustomerProfileRow & { latestRecord?: CustomerHealthRecord | null }

export type ServiceHistoryAppointment = Appointment & {
  service?: { title?: string; price?: number | string | null } | null
  staff?: { zalo_name?: string } | null
  service_amount?: number | string | null
  visit_done_at?: string | null
  diary?: string | null
  result?: string | null
}

export interface SkinTypeOption {
  code: string
  label: string
  sort_order?: number
}

export type ExaminerOption = { id: string; zalo_name?: string | null; email?: string | null }

export function readLegacyHealth(row: HealthRow): HealthFields {
  const fields = (row.custom_fields ?? {}) as Record<string, unknown>
  const value = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = fields[key]
      if (typeof candidate === 'string' && candidate.trim()) return candidate
    }
    return undefined
  }
  return {
    checked_date: value('checked_date'),
    checked_by: value('checked_by'),
    medical_history: value('tien_su_benh_ly', 'medical_history'),
    skin_type: value('skin_type', 'loai_da'),
    condition: value('condition', 'tinh_trang_da_ban_dau', 'tinh_trang_da'),
    allergies: value('allergies', 'di_ung'),
    protocol: value('phac_do_dieu_tri', 'protocol'),
    products_used: value('san_pham_su_dung', 'products_used'),
    advice: value('loi_dan_ktv', 'advice'),
    note: value('ghi_chu', 'note') || row.note || undefined,
  }
}

export function skinTypeLabel(value: string | null | undefined, options: SkinTypeOption[]): string | undefined {
  if (!value) return undefined
  const normalizedValue = value.trim().toLocaleLowerCase('vi')
  const option = options.find((item) =>
    item.code.trim().toLocaleLowerCase('vi') === normalizedValue
    || item.label.trim().toLocaleLowerCase('vi') === normalizedValue,
  )
  return option?.label ?? value
}

export function skinTypeCode(value: string | null | undefined, options: SkinTypeOption[]): string | undefined {
  if (!value) return undefined
  const normalizedValue = value.trim().toLocaleLowerCase('vi')
  return options.find((option) =>
    option.code.trim().toLocaleLowerCase('vi') === normalizedValue
    || option.label.trim().toLocaleLowerCase('vi') === normalizedValue,
  )?.code ?? value
}

export function currentHealth(row: HealthRow, skinTypes: SkinTypeOption[]): HealthFields {
  const record = row.latestRecord
  const fields = !record ? readLegacyHealth(row) : {
    checked_date: record.checked_date,
    checked_by: record.checked_by ?? undefined,
    medical_history: record.medical_history ?? undefined,
    skin_type: record.skin_type ?? undefined,
    condition: record.condition,
    allergies: record.allergies ?? undefined,
    protocol: record.protocol ?? undefined,
    products_used: record.products_used ?? undefined,
    advice: record.advice ?? undefined,
    note: record.note ?? undefined,
  }
  return { ...fields, skin_type: skinTypeLabel(fields.skin_type, skinTypes) }
}

export const healthDetails = (fields: HealthFields) => [
  { label: 'Tiền sử bệnh lý', value: fields.medical_history },
  { label: 'Loại da', value: fields.skin_type },
  { label: 'Tình trạng da', value: fields.condition },
  { label: 'Dị ứng', value: fields.allergies },
  { label: 'Phác đồ điều trị', value: fields.protocol },
  { label: 'Sản phẩm đã dùng', value: fields.products_used },
  { label: 'Lời dặn KTV', value: fields.advice },
  { label: 'Ghi chú', value: fields.note },
]

export function displayDate(date?: string) {
  return date && dayjs(date).isValid() ? dayjs(date).format('DD/MM/YYYY') : '—'
}
