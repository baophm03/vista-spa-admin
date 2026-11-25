import type { ServiceCustomer } from '@/api/models/serviceCustomer'

/** Lượt dịch vụ lẻ của khách (BE: service_customer) kèm quan hệ include từ API. */
export type ServiceCustomerRow = ServiceCustomer & {
  user?: { id?: string; customer_code?: string | null; full_name?: string | null; zalo_name?: string | null; phone?: string | null } | null
  branch?: { id?: string; name?: string } | null
  service?: { id?: string; title?: string; price?: number | string | null; price_max?: number | string | null; session_count?: number } | null
  staff?: { id?: string; zalo_name?: string | null; full_name?: string | null; email?: string | null } | null
}

export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'gold' },
  approved: { label: 'Đã lên lịch', color: 'blue' },
  in_progress: { label: 'Đang thực hiện', color: 'processing' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã huỷ', color: 'default' },
}

export const PAYMENT_STATUS_META: Record<string, { label: string; color: string }> = {
  UNPAID: { label: 'Chưa thanh toán', color: 'red' },
  PARTIAL: { label: 'Thanh toán một phần', color: 'orange' },
  PAID: { label: 'Đã thanh toán', color: 'green' },
}

export const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))

/** Mốc giờ 30 phút cho ô chọn giờ (07:00 – 21:30). */
export const TIME_OPTIONS = Array.from({ length: 30 }, (_, index) => {
  const minutes = 7 * 60 + index * 30
  const value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return { value, label: value }
})

export const timeLabel = (row: Pick<ServiceCustomerRow, 'start_time' | 'end_time'>) =>
  `${String(row.start_time ?? '').slice(0, 5)}${row.end_time ? ` – ${String(row.end_time).slice(0, 5)}` : ''}`

export const serviceTitle = (row: ServiceCustomerRow) =>
  row.service?.title ?? (row.service_snapshot as { title?: string } | null | undefined)?.title ?? 'Dịch vụ lẻ'
