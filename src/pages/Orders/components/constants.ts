import type { ProductOrder } from '@/api/models/productOrder'
import type { ProductOrderItem } from '@/api/models/productOrderItem'

export type ProductOrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

/** BE include kèm `items` khi list. */
export type ProductOrderRow = ProductOrder & { items?: ProductOrderItem[] }

export const STATUS_META: Record<ProductOrderStatus, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xử lý', color: 'orange' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'blue' },
  COMPLETED: { label: 'Hoàn thành', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

export const NEXT_ACTIONS: Record<ProductOrderStatus, { status: ProductOrderStatus; label: string; danger?: boolean }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Xác nhận' },
    { status: 'CANCELLED', label: 'Hủy đơn', danger: true },
  ],
  CONFIRMED: [
    { status: 'COMPLETED', label: 'Hoàn thành' },
    { status: 'CANCELLED', label: 'Hủy đơn', danger: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
}
