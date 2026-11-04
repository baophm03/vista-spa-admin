export const EVENTS = [
  { key: 'APPT_REMINDER', label: 'Nhắc lịch hẹn', description: 'Gửi theo mốc nhắc lịch đã cấu hình.' },
  { key: 'BIRTHDAY', label: 'Chúc mừng sinh nhật', description: 'Gửi vào ngày sinh nhật của khách.' },
  { key: 'CONTENT_PUBLISHED', label: 'Nội dung mới', description: 'Gửi khi bài viết được xuất bản và chọn thông báo.' },
  { key: 'NEXT_SESSION_REMINDER', label: 'Nhắc buổi liệu trình tiếp theo', description: 'Nhắc khách trước ngày buổi điều trị đã lên lịch.' },
  { key: 'RANK_NEAR', label: 'Sắp đạt hạng', description: 'Gửi khi khách gần đạt điều kiện lên hạng.' },
  { key: 'RANK_UP', label: 'Khách được nâng hạng', description: 'Gửi khi khách được nâng hạng thành viên.' },
  { key: 'SESSION_THANKS', label: 'Cảm ơn sau buổi điều trị', description: 'Gửi sau khi buổi dịch vụ hoặc liệu trình hoàn tất.' },
  { key: 'WHEEL_RESULT', label: 'Kết quả vòng quay', description: 'Gửi kết quả lượt quay may mắn.' },
]

export const CHANNELS = [
  { key: 'app', label: 'Trong ứng dụng' },
  { key: 'email', label: 'Email' },
  { key: 'zalo', label: 'Zalo OA' },
] as const

export const VARIABLE_LABELS: Record<string, string> = {
  customer_name: 'Tên khách hàng',
  appt_date: 'Ngày hẹn',
  appt_time: 'Giờ hẹn',
  service_name: 'Dịch vụ / liệu trình',
  branch_name: 'Chi nhánh',
  rank_name: 'Hạng thành viên',
  progress_percent: 'Mức độ đạt hạng',
  remaining_amount: 'Số tiền còn thiếu',
  session_date: 'Ngày điều trị',
  session_time: 'Giờ điều trị',
  staff_name: 'Kỹ thuật viên',
  prize_name: 'Quà nhận được',
  content_title: 'Tiêu đề nội dung',
  content_summary: 'Mô tả nội dung',
}

export const PREVIEW_VALUES: Record<string, string> = {
  customer_name: 'Nguyễn Minh Anh', appt_date: '05/11/2026', appt_time: '09:00', service_name: 'Peel da sinh học',
  branch_name: 'NewSky Vista', rank_name: 'Vàng', progress_percent: '90', remaining_amount: '1.000.000 ₫',
  session_date: '05/11/2026', session_time: '09:00', staff_name: 'Nguyễn Minh Anh', prize_name: 'Giảm 50.000 ₫',
  content_title: 'Chăm sóc da mùa hanh khô', content_summary: 'Khám phá các bước chăm sóc da phù hợp trong mùa hanh khô.',
}

export function previewTemplate(text: string | null | undefined) {
  return String(text ?? '').replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key: string) => PREVIEW_VALUES[key] ?? `{{${key}}}`)
}

