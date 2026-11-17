// Facade "Voucher khách hàng" — gán/xem voucher theo danh mục (treatment-package / academy-course / product).
// Đặt ngoài src/api/endpoints|models để orval không xóa khi regenerate —
// pattern giống voucherCategories.ts; BE expose 3 nhóm route *-voucher-customers.
import { apiClient } from '@/api/mutator/custom-instance'
import type { VoucherCategory } from './voucherCategories'

export type VoucherCustomerSource = 'AUTO' | 'FIXED'
export type VoucherCustomerStatus = 'ACTIVE' | 'USED' | 'REVOKED'

/** Một voucher khách hàng đang có: tự động theo hạng hoặc được gán tay. */
export interface VoucherCustomerRow {
  assignment_id?: string | null
  customer_profile_id?: string | null
  user_id?: string | null
  user_name?: string | null
  user_phone?: string | null
  branch_id?: string | null
  branch_name?: string | null
  rank_name?: string | null
  voucher_id: string
  voucher_title: string
  discount_type?: 'PERCENT' | 'AMOUNT' | 'GIFT' | null
  discount_value?: number | string | null
  points_cost?: number | null
  start_date?: string | null
  end_date?: string | null
  source: VoucherCustomerSource
  status: VoucherCustomerStatus
  note?: string | null
  assigned_at?: string | null
}

export interface VoucherCustomerAssignment {
  voucher_id: string
  customer_profile_id?: string
  user_id?: string
  /** Cơ sở admin chọn khi gán — hiển thị ở cột "Cơ sở". */
  branch_id?: string
  note?: string | null
}

const paths: Record<VoucherCategory, string> = {
  'treatment-package': '/treatment-package-voucher-customers',
  'academy-course': '/academy-course-voucher-customers',
  product: '/product-voucher-customers',
}

export const voucherCustomerPath = (category: VoucherCategory) => paths[category]

export async function getVoucherCustomerView(category: VoucherCategory, params: { q?: string; user_id?: string; customer_profile_id?: string; branch_id?: string } = {}) {
  return (
    await apiClient.get(paths[category], {
      params: {
        ...(params.q ? { q: params.q } : {}),
        ...(params.user_id ? { user_id: params.user_id } : {}),
        ...(params.customer_profile_id ? { customer_profile_id: params.customer_profile_id } : {}),
        ...(params.branch_id ? { branch_id: params.branch_id } : {}),
      },
    })
  ).data
}

export async function assignVoucherCustomer(category: VoucherCategory, body: VoucherCustomerAssignment) {
  return (await apiClient.post(paths[category], body)).data
}

export async function revokeVoucherCustomer(category: VoucherCategory, assignmentId: string) {
  return (await apiClient.delete(`${paths[category]}/${assignmentId}`)).data
}

/** Đánh dấu 1 lượt gán voucher là ĐÃ DÙNG (khi staff áp voucher vào gói lúc thanh toán). */
export async function useVoucherCustomer(category: VoucherCategory, assignmentId: string) {
  return (await apiClient.patch(`${paths[category]}/${assignmentId}`, { status: 'USED' })).data
}
