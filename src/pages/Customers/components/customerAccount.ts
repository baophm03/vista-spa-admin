import type { CustomerProfileRow } from './CustomerProfileOverviewTab'

/** Sau khi gộp hồ sơ khách vào bảng users: hạng nằm ở `membership` của chính hồ sơ,
 *  "đã liên kết" = khách đã đăng nhập Mini App bằng Zalo (có zalo_id). Giữ fallback field cũ (user / user_id). */
export const customerRankName = (row: CustomerProfileRow): string | undefined =>
  row.membership?.card_rank?.name || row.user?.membership?.card_rank?.name || undefined

export const isCustomerLinked = (row: CustomerProfileRow): boolean => !!(row.zalo_id || row.user_id)

/** Tài khoản Zalo: 2 trạng thái */
export const customerAccountLabel = (row: CustomerProfileRow): string => (isCustomerLinked(row) ? 'Đã liên kết' : 'Chưa liên kết')
