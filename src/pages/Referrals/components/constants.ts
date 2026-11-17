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
  PAID: { label: 'Đã duyệt · trạng thái cũ', color: 'orange' },
}

export const STATUS_KEYS = ['PENDING', 'APPROVED', 'REJECTED']

/** commission_status do BE derive từ hiệu lực của bút toán hoa hồng. */
export const COMMISSION_STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Còn hiệu lực', color: 'blue' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  VOID: { label: 'Đã hủy', color: 'default' },
}

export function formatVnd(v?: number | null): string {
  if (v == null) return '—'
  return `${Number(v).toLocaleString('vi-VN')} ₫`
}

/** Hàng trả về có thêm `referred_profile` + `referrer_profile` (BE tự resolve) — model gen chưa khai báo. */
export type ReferralRow = Referral & {
  referred_profile?: { id?: string; full_name?: string; phone?: string; customer_code?: string } | null
  referrer_profile?: { id?: string; full_name?: string; phone?: string; customer_code?: string } | null
  discount_rule?: { id?: string; code?: string; name?: string } | null
  packages?: { id: string; name: string; total_amount: number; status?: string }[]
  commission_entries?: {
    id: string
    amount: number
    status?: string
    mode?: string
    period_date?: string
    reason?: string
    payout_status?: 'UNPAID' | 'PAID' | 'RECONCILE'
    paid_at?: string | null
    paid_by?: string | null
    payout_note?: string | null
    void_reason?: string | null
    voided_at?: string | null
  }[]
  commission_total?: number
  commission_status?: string
  commission_paid_total?: number
  commission_unpaid_total?: number
  commission_reconcile_total?: number
  commission_payout_status?: 'UNPAID' | 'PAID' | 'RECONCILE' | null
}

export type CustomerOption = { id: string; full_name?: string; phone?: string; customer_code?: string }

