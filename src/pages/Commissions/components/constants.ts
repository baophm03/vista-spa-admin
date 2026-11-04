import type { CommissionEntryPayeeType } from '@/api/models'

export type PayeeType = NonNullable<CommissionEntryPayeeType>

export const PAYEE_LABEL: Record<PayeeType, string> = {
  STAFF: 'KTV',
  COLLABORATOR: 'Cá»™ng tÃ¡c viÃªn',
  CUSTOMER_REFERRER: 'KhÃ¡ch giá»›i thiá»‡u',
}
