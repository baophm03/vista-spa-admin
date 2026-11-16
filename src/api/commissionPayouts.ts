import { customInstance } from './mutator/custom-instance'

export type MarkCommissionPayoutsBody = {
  commission_entry_ids: string[]
  paid_at?: string
  payout_note?: string
}

export function markCommissionPayouts(data: MarkCommissionPayoutsBody) {
  return customInstance<unknown>({
    url: '/commissions/payouts',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}
