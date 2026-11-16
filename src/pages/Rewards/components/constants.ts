import type { Reward } from '@/api/models/reward'
import type { RewardRedemption } from '@/api/models/rewardRedemption'

/** GET /rewards trả kèm loại voucher khi type = VOUCHER (model gen thiếu — mở rộng cục bộ). */
export type RewardRow = Reward & {
  benefit_amount?: number | null
  service_id?: string | null
  voucher?: { id?: string; title?: string; description?: string } | null
  voucher_kind?: 'legacy' | 'treatment-package' | 'academy-course' | 'product'
  voucher_reference?: string | null
  treatment_package_voucher_id?: string | null
  academy_course_voucher_id?: string | null
  product_voucher_id?: string | null
}

/** GET /reward-redemptions trả kèm reward (model gen thiếu — mở rộng cục bộ). */
export type RewardRedemptionRow = RewardRedemption & {
  reward?: RewardRow | null
  customer_profile?: { id: string; customer_code?: string; full_name?: string; phone?: string } | null
}
export type RewardType = 'VOUCHER' | 'GIFT'

export const TYPE_META: Record<RewardType, { label: string; color: string }> = {
  VOUCHER: { label: 'Quà Voucher', color: 'purple' },
  GIFT: { label: 'Quà hiện vật', color: 'gold' },
}

export const REDEMPTION_META: Record<string, { label: string; color: string }> = {
  ISSUED: { label: 'Chưa dùng', color: 'orange' },
  USED: { label: 'Đã dùng', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

export function remainingLabel(row: RewardRow) {
  if (row.quantity_total == null) return 'Không giới hạn'
  return `${Math.max(Number(row.quantity_total) - Number(row.quantity_given ?? 0), 0)}/${row.quantity_total}`
}


