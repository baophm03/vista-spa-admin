import type { CommissionEntryPayeeType } from '@/api/models'

export type PayeeType = NonNullable<CommissionEntryPayeeType>

export const PAYEE_LABEL: Record<PayeeType, string> = {
  STAFF: 'KTV',
  COLLABORATOR: 'Cộng tác viên',
  CUSTOMER_REFERRER: 'Khách giới thiệu',
}
