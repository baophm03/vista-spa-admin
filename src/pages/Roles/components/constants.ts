export interface RoleRow {
  id: string
  role_name: string
  code?: string | null
  description?: string | null
  [k: string]: unknown
}

export interface PermRow {
  id: string
  key: string
  module: string
  action: string
  description?: string
}

export const SYSTEM_ROLES = ['Admin']

/** Nhãn tiếng Việt cho module quyền. */
export const MODULE_LABELS: Record<string, string> = {
  academy: 'Học viện',
  appointment: 'Lịch hẹn',
  branch: 'Cơ sở',
  card_rank: 'Hạng thẻ',
  collaborator: 'Cộng tác viên',
  commission: 'Hoa hồng',
  content: 'Nội dung app',
  customer: 'Khách hàng',
  custom_field: 'Trường tùy chỉnh',
  day_off: 'Ngày nghỉ',
  discount: 'Giảm giá & ưu đãi',
  health_metric: 'Chỉ số sức khỏe/da',
  import: 'Nhập dữ liệu',
  lookup: 'Danh mục chọn',
  membership: 'Thành viên & Điểm',
  notification: 'Thông báo',
  payment: 'Thanh toán',
  package_type: 'Loại gói liệu trình',
  permission: 'Phân quyền',
  report: 'Báo cáo',
  reward: 'Quà đổi điểm',
  referral: 'Giới thiệu khách',
  schedule: 'Lịch làm việc',
  service: 'Dịch vụ',
  session: 'Buổi điều trị',
  setting: 'Cấu hình',
  shift_template: 'Ca làm',
  staff_profile: 'Hồ sơ chuyên viên/KTV',
  treatment: 'Điều chỉnh gói khách',
  treatment_package: 'Gói liệu trình',
  voucher: 'Voucher',
  wheel: 'Vòng quay may mắn',
}

/** Nhãn tiếng Việt cho action; vài cặp (module, action) cần nhãn riêng. */
export const ACTION_LABELS: Record<string, string> = {
  create: 'Thêm mới',
  read: 'Xem',
  update: 'Sửa',
  delete: 'Xóa',
  approve: 'Duyệt',
  start: 'Bắt đầu',
  done: 'Kết thúc buổi',
  complete: 'Hoàn tất buổi',
  export: 'Xuất dữ liệu',
  all: 'Toàn bộ cơ sở',
  manage: 'Quản lý',
  points_adjust: 'Điều chỉnh điểm',
  rank_override: 'Gán hạng',
  recalculate: 'Tính lại hạng',
  redeem_admin: 'Đổi hộ khách',
  spin_admin: 'Quản lý lượt quay',
  revenue: 'Doanh thu',
  debt: 'Công nợ',
  customer: 'Khách hàng',
  rank: 'Hạng thẻ',
  appointment: 'Lịch hẹn',
  session: 'Buổi điều trị',
  commission: 'Hoa hồng',
  adjust: 'Điều chỉnh gói',
  convert: 'Chuyển buổi tặng',
}

export const ACTION_OVERRIDES: Record<string, string> = {
  'report.customer.read': 'Khách mới',
  'report.read': 'Báo cáo tổng hợp',
  'report.rank.read': 'Cơ cấu hạng thẻ',
  'report.session.read': 'Buổi đã sử dụng',
}

const readableToken = (value: string) =>
  value
    .replaceAll('_', ' ')
    .replaceAll('.', ' ')
    .replace(/\b\w/g, (character) => character.toLocaleUpperCase('vi-VN'))

export const moduleLabel = (module: string) => MODULE_LABELS[module] ?? readableToken(module)

export const actionLabel = (permission: PermRow) =>
  permission.description?.trim() ||
  ACTION_OVERRIDES[permission.key] ||
  ACTION_LABELS[permission.action] ||
  readableToken(permission.action)
