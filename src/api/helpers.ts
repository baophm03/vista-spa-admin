/**
 * Đọc payload từ envelope Response chuẩn của BE: { status, message, responseData, meta, code, details }.
 * Toàn bộ endpoint (cả legacy lẫn mới) đã hợp nhất về một envelope này.
 */
export interface PagedMeta {
  page?: number
  limit?: number
  total?: number
}

export function pickData<T = unknown>(body: unknown): T {
  const b = body as { responseData?: unknown; data?: unknown } | null
  return (b?.responseData ?? b?.data ?? (b as T)) as T
}

export function pickMeta(body: unknown): PagedMeta | undefined {
  const meta = (body as { meta?: PagedMeta })?.meta
  return meta ?? undefined
}

export function pickErrorCode(body: unknown): string | null {
  return ((body as { code?: string | null })?.code ?? null) || null
}

export function pickDetails(body: unknown): Record<string, unknown> | null {
  return ((body as { details?: Record<string, unknown> | null })?.details ?? null) || null
}

const userFacingLabels: Record<string, string> = {
  'discount.override': 'quyền duyệt mức giảm ngoài khoảng',
  'discount.read': 'quyền xem quy tắc ưu đãi',
  'commission.rule_manage': 'quyền quản lý quy tắc hoa hồng',
  'commission.read': 'quyền xem hoa hồng',
  'commission.auto_enabled': 'tính năng tính hoa hồng tự động',
  'collaborator.read': 'quyền xem danh sách cộng tác viên',
  'referral.read': 'quyền xem lịch sử giới thiệu',
  'module.invoice': 'cấu hình hóa đơn',
  'payment.methods': 'danh mục phương thức thanh toán',
  'health.metrics': 'danh mục chỉ số sức khỏe',
  'points.earn_amount': 'mức tích điểm theo doanh thu',
  'points.point_value': 'giá trị mỗi điểm',
  'points.redeem_min_percent': 'mức giảm tối thiểu theo giá trị hóa đơn',
  'points.redeem_max_percent': 'mức giảm tối đa theo giá trị hóa đơn',
  'points.redeem_balance_max_percent': 'số điểm tối đa được dùng mỗi lần',
  branch_id: 'cơ sở',
  customer_profile_id: 'hồ sơ khách hàng',
  user_id: 'tài khoản',
  appt_date: 'ngày hẹn',
  start_time: 'giờ bắt đầu',
  end_time: 'giờ kết thúc',
  service_id: 'dịch vụ',
  service_ids: 'danh sách dịch vụ',
  course_id: 'khóa học',
  full_name: 'họ và tên',
  phone_number: 'số điện thoại',
  role_id: 'vai trò',
  logo_file_id: 'tệp logo',
  custom_fields: 'thông tin tùy chỉnh',
  commission_percent: 'tỷ lệ hoa hồng',
  referral_code: 'mã giới thiệu',
  referrer_type: 'loại người giới thiệu',
  valid_from: 'ngày bắt đầu hiệu lực',
  valid_to: 'ngày kết thúc hiệu lực',
  void_reason: 'lý do hủy',
  customer_treatment_id: 'liệu trình',
  has_warranty: 'chính sách bảo hành',
  visible_to_customer: 'trạng thái hiển thị với khách',
  sort_order: 'thứ tự hiển thị',
  data_type: 'loại dữ liệu',
  lookup_list_id: 'danh mục liên kết',
  staff_id: 'nhân viên',
  work_date: 'ngày làm việc',
  shift_template_id: 'ca làm việc',
  shift_template_ids: 'danh sách ca làm việc',
  package_id: 'gói liệu trình',
  expires_at: 'ngày hết hạn',
  total_amount: 'tổng tiền',
  from_sessions: 'số buổi chuyển',
  product_amount: 'tiền sản phẩm',
  file_id: 'tệp đính kèm',
  default_quota_type: 'cách tính số buổi mặc định',
  allow_unlimited: 'tùy chọn không giới hạn',
  min_spent: 'mức chi tiêu tối thiểu',
  max_spent: 'mức chi tiêu tối đa',
  has_debt: 'tình trạng công nợ',
  metric_code: 'mã chỉ số',
  value_num: 'giá trị chỉ số',
  column_mapping: 'cách ghép cột dữ liệu',
  display_type: 'kiểu hiển thị',
  requires_rank_id: 'hạng thẻ áp dụng',
  payment_method: 'phương thức thanh toán',
  trans_date: 'ngày giao dịch',
  customer_code: 'mã khách hàng',
  birth_month: 'tháng sinh',
  reject_reason: 'lý do từ chối',
  event_key: 'loại sự kiện',
  rank_id: 'hạng thẻ',
  name: 'tên',
  title: 'tiêu đề',
  status: 'trạng thái',
  amount: 'số tiền',
  percent: 'tỷ lệ phần trăm',
  reason: 'lý do',
  phone: 'số điện thoại',
  email: 'email',
}

const humanizeApiMessage = (rawMessage: string, fallback: string): string => {
  let message = rawMessage.trim()
  if (!message) return fallback
  for (const [identifier, label] of Object.entries(userFacingLabels).sort(([a], [b]) => b.length - a.length)) {
    const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    message = message.replace(new RegExp(`(?<![\\w@])${escaped}(?![\\w])`, 'gi'), label)
  }
  message = message
    .replace(/\bpermission\s+(?=quyền\b)/gi, '')
    .replace(/\bcần quyền\s+quyền\b/gi, 'cần quyền')

  const hasUntranslatedIdentifier = /(?<![@\w])[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b|(?<![@\w-])[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+\b/i.test(message)
  const hasTechnicalValidationWording = /\b(?:must|cannot|unknown setting key|valid uuid|include a value|duplicate setting|integer between|greater than)\b/i.test(message)
  if (hasUntranslatedIdentifier || hasTechnicalValidationWording) {
    return 'Thông tin chưa hợp lệ hoặc còn thiếu. Vui lòng kiểm tra lại nội dung đã nhập.'
  }

  return message.replace(/`([^`]+)`/g, '$1')
}

/** Trích thông điệp lỗi từ axios error (body có `message`) hoặc Error thường. */
export function errorMessage(err: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  if (!err) return fallback
  const anyErr = err as { response?: { data?: { message?: unknown } }; message?: unknown }
  const apiMessage = anyErr?.response?.data?.message
  if (typeof apiMessage === 'string' && apiMessage) return humanizeApiMessage(apiMessage, fallback)
  if (typeof anyErr?.message === 'string' && anyErr.message) return humanizeApiMessage(anyErr.message, fallback)
  return fallback
}

/** Tải blob (CSV export, QR PNG...) kèm bearer token từ store — dùng cho endpoint trả file. */
export async function downloadBlob(path: string, filename: string): Promise<void> {
  const { apiClient } = await import('@/api/mutator/custom-instance')
  const response = await apiClient.get(path, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data as Blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Mở trang HTML in (phiếu hóa đơn 5.39 INV) ở tab mới — trình duyệt tự bật hộp thoại In. */
export async function openHtmlPrint(path: string): Promise<void> {
  const { apiClient } = await import('@/api/mutator/custom-instance')
  const response = await apiClient.get(path, {
    responseType: 'text',
    transformResponse: [(data: unknown) => data],
  } as never)
  const blob = new Blob([String(response.data)], { type: 'text/html; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
