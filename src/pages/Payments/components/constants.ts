import type { PaymentLog } from '@/api/models/paymentLog'

export const PAY_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'Quẹt thẻ',
  OTHER: 'Khác',
}

export type PaymentColumnKey = 'paid_at' | 'customer' | 'package' | 'branch' | 'amount' | 'method' | 'entered_by'

export const PAYMENT_COLUMN_OPTIONS: { label: string; value: PaymentColumnKey }[] = [
  { label: 'Thời gian', value: 'paid_at' },
  { label: 'Khách hàng', value: 'customer' },
  { label: 'Gói / dịch vụ', value: 'package' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Số tiền', value: 'amount' },
  { label: 'Phương thức', value: 'method' },
  { label: 'Thu ngân', value: 'entered_by' },
]

export const DEFAULT_VISIBLE_COLUMNS = PAYMENT_COLUMN_OPTIONS.map((column) => column.value)

export interface LedgerRow extends PaymentLog {
  branch_id?: string
  customer_treatment?: {
    customer_profile?: { full_name?: string; phone?: string }
    package_snapshot?: { name?: string }
    branch_id?: string
  } | null
  appointment?: {
    branch_id?: string
    service?: { title?: string }
    customer_profile?: { full_name?: string; phone?: string }
  } | null
}

