import type { Reward } from '@/api/models/reward'
import type { RewardRedemption } from '@/api/models/rewardRedemption'

/** GET /rewards trả kèm voucher cấp khi type = VOUCHER (model gen thiếu — mở rộng cục bộ). */
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
export type RewardRedemptionRow = RewardRedemption & { reward?: RewardRow | null }
export type RewardType = 'VOUCHER' | 'GIFT' | 'BENEFIT'

export const TYPE_META: Record<RewardType, { label: string; color: string }> = {
  VOUCHER: { label: 'Voucher', color: 'purple' },
  GIFT: { label: 'Quà vật phẩm', color: 'gold' },
  BENEFIT: { label: 'Quyền lợi', color: 'cyan' },
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

export type RedemptionColumnKey = 'reward' | 'points_spent' | 'status' | 'created_at' | 'cancel_reason'

export const REDEMPTION_COLUMN_OPTIONS: { label: string; value: RedemptionColumnKey }[] = [
  { label: 'Quà', value: 'reward' },
  { label: 'Điểm đã trừ', value: 'points_spent' },
  { label: 'Trạng thái', value: 'status' },
  { label: 'Ngày đổi', value: 'created_at' },
  { label: 'Lý do hủy', value: 'cancel_reason' },
]

export const DEFAULT_REDEMPTION_COLUMNS = REDEMPTION_COLUMN_OPTIONS.map((column) => column.value)

