export const PRIZE_TYPE_META: Record<string, { label: string; color: string }> = {
  VOUCHER: { label: 'Voucher', color: 'gold' },
  SERVICE: { label: 'Dịch vụ', color: 'purple' },
  POINTS: { label: 'Điểm', color: 'geekblue' },
  NONE: { label: 'Không trúng', color: 'default' },
}

interface OddsPrize {
  id?: string
  weight?: number | string | null
  is_active?: boolean
  quantity_total?: number | string | null
  quantity_given?: number | string | null
}

/** BE chọn giải theo weight/tổng weight của các giải còn lượt (wheelService.spin). */
function isDrawable(prize: OddsPrize) {
  if (prize.is_active === false) return false
  if (prize.quantity_total == null) return true
  return Number(prize.quantity_given ?? 0) < Number(prize.quantity_total)
}

/** Tổng trọng số đang tham gia chia giải — dùng làm mẫu số khi tính tỉ lệ. */
export function totalPrizeWeight(prizes: OddsPrize[]) {
  return prizes.filter(isDrawable).reduce((sum, prize) => sum + Math.max(Number(prize.weight ?? 0), 0), 0)
}

/** Tỉ lệ trúng thực tế của 1 giải (%) — null khi chưa thể tính (chưa có trọng số nào). */
export function prizeChance(weight: number | string | null | undefined, totalWeight: number) {
  const value = Math.max(Number(weight ?? 0), 0)
  if (!Number.isFinite(value) || totalWeight <= 0) return null
  return (value / totalWeight) * 100
}

/** Tỉ lệ của 1 giải trong danh sách: giải đã tắt/hết lượt không còn cơ hội trúng → 0%. */
export function prizeChanceOf(prize: OddsPrize, totalWeight: number) {
  if (!isDrawable(prize)) return 0
  return prizeChance(prize.weight, totalWeight)
}

export function formatChance(chance: number | null) {
  if (chance == null) return '—'
  if (chance > 0 && chance < 0.1) return '< 0,1%'
  return `${chance.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
}
