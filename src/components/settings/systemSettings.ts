export interface SystemSettingSchema {
  type?: string | string[]
  enum?: unknown[]
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  items?: SystemSettingSchema
  properties?: Record<string, SystemSettingSchema>
}

export interface SystemSetting {
  id: string | null
  scope: string
  branch_id?: string | null
  group: string
  key: string
  value: unknown
  default_value: unknown
  schema: SystemSettingSchema
  branch_allowed: boolean
  source_scope: 'BRANCH' | 'GLOBAL' | 'DEFAULT' | string
  is_overridden: boolean
  updated_by?: string
  updated_at?: string
}

export interface SystemSettingUpdate {
  key: string
  value: unknown
  branch_id?: string
}

export const settingSections = [
  { key: 'member', label: 'Hội viên & hạng thẻ', groups: ['rank', 'customer_code', 'customer'] },
  { key: 'booking', label: 'Đặt lịch hẹn', groups: ['booking', 'reminder', 'job'] },
  { key: 'loyalty', label: 'Tích điểm & ưu đãi', groups: ['points', 'payment', 'commission', 'discount', 'academy', 'lucky_wheel'] },
  { key: 'modules', label: 'Mô-đun chức năng', groups: ['module', 'content', 'zalo'] },
  { key: 'workflow', label: 'Nhãn & trạng thái', groups: ['status', 'treatment', 'session', 'label'] },
] as const

const labels: Record<string, string> = {
  'rank.metric': 'Cách tính hạng', 'rank.period': 'Kỳ xét hạng theo', 'rank.downgrade': 'Quy tắc giảm hạng',
  'rank.boundary': 'Điều kiện đạt ngưỡng', 'rank.near_percent': 'Phần trăm thông báo gần đạt hạng',
  'customer_code.format': 'Định dạng mã khách hàng', 'customer_code.regen_on_rank_up': 'Đổi mã khi khách lên hạng',
  'customer.shared_across_branches': 'Dùng chung hồ sơ khách giữa các cơ sở',
  'booking.slot_minutes': 'Độ dài khung giờ (phút)', 'booking.horizon_days': 'Số ngày được đặt trước',
  'booking.min_cancel_hours': 'Số giờ tối thiểu để hủy lịch', 'booking.auto_approve': 'Tự động duyệt lịch hẹn',
  'booking.pending_expire_hours': 'Thời hạn giữ lịch chờ (giờ)', 'booking.require_staff_service': 'Yêu cầu nhân viên có dịch vụ tương ứng',
  'payment.methods': 'Phương thức thanh toán', 'payment.allow_overpay': 'Cho phép thanh toán dư',
  'reminder.offsets_days': 'Nhắc trước ngày hẹn (ngày)', 'reminder.send_time': 'Giờ gửi nhắc hẹn',
  'reminder.next_session_days': 'Số ngày nhắc buổi tiếp theo', 'points.enabled': 'Bật tích điểm',
  'points.earn_amount': 'Số tiền quy đổi thành điểm', 'points.point_value': 'Giá trị quy đổi một điểm',
  'points.redeem_min_percent': 'Tỷ lệ đổi điểm tối thiểu (%)', 'points.redeem_max_percent': 'Tỷ lệ đổi điểm tối đa (%)',
  'points.redeem_max_points': 'Số điểm tối đa mỗi lần đổi (0/trống = không giới hạn)',
  'points.auto_earn': 'Tự động cộng điểm', 'commission.auto_enabled': 'Tự động tính hoa hồng',
  'discount.max_total_percent': 'Mức giảm tối đa cộng dồn (%)', 'status.labels': 'Nhãn trạng thái',
  'status.colors': 'Màu trạng thái', 'module.academy': 'Khóa học', 'module.content': 'Nội dung',
  'module.report': 'Báo cáo', 'module.lucky_wheel': 'Vòng quay may mắn', 'module.shop': 'Cửa hàng',
  'module.shop_checkout': 'Thanh toán tại cửa hàng', 'module.invoice': 'Hóa đơn',
  'academy.levels': 'Cấp độ khóa học', 'academy.returning_discount_percent': 'Ưu đãi học viên cũ (%)',
  'job.birthday_time': 'Giờ chạy job sinh nhật', 'zalo.enabled': 'Bật tích hợp Zalo',
  'content.max_video_mb': 'Dung lượng video tối đa (MB)', 'content.notify_on_publish': 'Thông báo khi đăng nội dung',
  'treatment.expiry_policy': 'Xử lý liệu trình hết hạn', 'session.required_fields': 'Trường bắt buộc của buổi điều trị',
  'lucky_wheel.max_spins_default': 'Số lượt quay mặc định tối đa', 'label.brand': 'Tên thương hiệu hiển thị',
}

export function settingLabel(key: string) {
  return labels[key] ?? key
}

export function sectionForGroup(group: string) {
  return settingSections.find((section) => (section.groups as readonly string[]).includes(group))
}

export function sameSettingValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}
