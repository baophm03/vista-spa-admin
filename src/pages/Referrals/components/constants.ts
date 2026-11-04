import type { Referral } from '@/api/models'

export const REFERRER_TYPES = ['COLLABORATOR', 'CUSTOMER'] as const

export const REFERRER_TYPE_META: Record<string, { label: string; color: string }> = {
  COLLABORATOR: { label: 'Cộng tác viên', color: 'blue' },
  CUSTOMER: { label: 'Khách hàng', color: 'green' },
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ duyệt', color: 'gold' },
  APPROVED: { label: 'Đã duyệt', color: 'blue' },
  REJECTED: { label: 'Từ chối', color: 'red' },
  PAID: { label: 'Đã chi trả', color: 'green' },
}

export const STATUS_KEYS = Object.keys(STATUS_META)

export function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

/** Hàng trả về có thêm `referred_profile` (include ở BE) — model gen chưa khai báo. */
export type ReferralRow = Referral & {
  referred_profile?: { id?: string; full_name?: string; phone?: string; customer_code?: string } | null
  discount_rule?: { id?: string; code?: string; name?: string } | null
  packages?: { id: string; name: string; total_amount: number; status?: string }[]
  commission_entries?: { id: string; amount: number; status?: string; mode?: string; period_date?: string }[]
  commission_total?: number
  commission_status?: string
}

export type CustomerOption = { id: string; full_name?: string; phone?: string; customer_code?: string }

