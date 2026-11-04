import type { CardRank } from '@/api/models/cardRank'

export const VALIDITY_META: Record<string, { label: string; color: string }> = {
  ONE_YEAR: { label: '1 năm', color: 'blue' },
  PERMANENT: { label: 'Vĩnh viễn', color: 'green' },
}

export const RANK_HINT = 'Sửa ngưỡng/% chỉ ảnh hưởng lần xét hạng sau; không tự đổi hạng khách hiện có.'

/** Hàng có thể kèm số khách giữ hạng nếu BE trả về (model gen chưa khai báo). */
export type CardRankRow = CardRank & {
  customer_count?: number
  holder_count?: number
  holders_count?: number
  total_customers?: number
}
