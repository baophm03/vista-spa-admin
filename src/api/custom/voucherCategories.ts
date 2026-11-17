// Facade quản lý voucher theo danh mục (treatment-package / academy-course / product).
// Đặt ngoài src/api/endpoints|models để orval không xóa khi regenerate —
// BE đã expose đủ 3 nhóm route và client generated tương ứng trong src/api/endpoints/*-vouchers.ts.
import { apiClient } from '@/api/mutator/custom-instance'

export type VoucherCategory = 'treatment-package' | 'academy-course' | 'product'

export interface VoucherCategoryRow {
  id: string
  title: string
  description?: string | null
  treatment_package_id?: string | null
  academy_course_id?: string | null
  product_id?: string | null
  product_category_id?: string | null
  branch_id?: string | null
  branch_name?: string | null
  target_name?: string | null
  card_rank_id?: string | null
  card_rank_name?: string | null
  is_loyalty: boolean
  /** AUTO: cấp tự động theo hạng khách; FIXED: gán tay qua trang Voucher khách hàng. */
  issue_mode?: 'AUTO' | 'FIXED' | null
  /** Số điểm thưởng cần để đổi lấy voucher (chỉ áp dụng cho chế độ Tự động); NULL = miễn phí. */
  points_cost?: number | null
  /** GIFT chỉ còn xuất hiện trên dữ liệu cũ; voucher mới dùng PERCENT hoặc AMOUNT. */
  discount_type?: 'PERCENT' | 'AMOUNT' | 'GIFT'
  discount_value?: number | string | null
  minimum_order_amount?: number | string | null
  maximum_discount_amount?: number | string | null
  minimum_tuition?: number | string | null
  max_uses_per_student?: number | null
  quantity_total?: number | null
  quantity_given: number
  start_date?: string | null
  end_date?: string | null
  is_active: boolean
}

export type VoucherCategoryWrite = Omit<Partial<VoucherCategoryRow>, 'discount_type'> & {
  discount_type?: 'PERCENT' | 'AMOUNT'
}

const paths: Record<VoucherCategory, string> = {
  'treatment-package': '/treatment-package-vouchers',
  'academy-course': '/academy-course-vouchers',
  product: '/product-vouchers',
}

export const voucherCategoryPath = (category: VoucherCategory) => paths[category]

export type VoucherCategoryListParams = { page?: number; limit?: number; q?: string; branch_id?: string }

export async function getVoucherCategory(category: VoucherCategory, params?: VoucherCategoryListParams) {
  return (await apiClient.get(paths[category], { params })).data
}

export async function postVoucherCategory(category: VoucherCategory, data: VoucherCategoryWrite) {
  return (await apiClient.post(paths[category], data)).data
}

export async function putVoucherCategory(category: VoucherCategory, id: string, data: VoucherCategoryWrite) {
  return (await apiClient.put(`${paths[category]}/${id}`, data)).data
}

export async function deleteVoucherCategory(category: VoucherCategory, id: string) {
  return (await apiClient.delete(`${paths[category]}/${id}`)).data
}
