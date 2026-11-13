import type { AcademyRegistration } from '@/api/models/academyRegistration'
import type { AcademyCourse } from '@/api/models/academyCourse'

/** Trường mới theo đặc tả 5.34 AC-09 (chưa có trong client sinh tự động). */
export type RegistrationRow = AcademyRegistration & {
  assigned_to?: string | null
  contacted_at?: string | null
  tuition_before_discount?: number | string | null
  academy_course_voucher_id?: string | null
  voucher_discount_amount?: number | string | null
  course_voucher_title?: string | null
  user?: { id: string; zalo_name?: string } | null
  course?: AcademyCourse | null
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Mới đăng ký', color: 'gold' },
  CONFIRMED: { label: 'Đã liên hệ', color: 'blue' },
  ATTENDED: { label: 'Đã nhập học', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'red' },
}

/** Máy trạng thái một chiều: chỉ cho chọn trạng thái phía TRƯỚC. */
export const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'ATTENDED', 'CANCELLED'],
  CONFIRMED: ['ATTENDED', 'CANCELLED'],
  ATTENDED: [],
  CANCELLED: [],
}

/** Theo dõi khoản thu (AC-04): trạng thái thanh toán học phí */
export const PAYMENT_STATUS_META: Record<string, { label: string; color: string }> = {
  UNPAID: { label: 'Chưa thanh toán', color: 'red' },
  PARTIAL: { label: 'Thanh toán một phần', color: 'gold' },
  PAID: { label: 'Đã thanh toán', color: 'green' },
}
