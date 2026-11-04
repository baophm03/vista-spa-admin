import type { CommissionRulePayeeType } from '@/api/models'

export type PayeeType = CommissionRulePayeeType

export const PAYEE_META: Record<PayeeType, { label: string; color: string }> = {
  STAFF: { label: 'KTV', color: 'blue' },
  COLLABORATOR: { label: 'Cộng tác viên', color: 'purple' },
  CUSTOMER_REFERRER: { label: 'Khách giới thiệu', color: 'geekblue' },
}

export const BASE_OPTIONS = [
  { value: 'PAYMENT', label: 'Trên thanh toán' },
  { value: 'SESSION_VALUE', label: 'Trên giá trị buổi' },
]
