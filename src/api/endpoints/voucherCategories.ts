import { apiClient } from '@/api/mutator/custom-instance'

export type VoucherCategory = 'treatment-package' | 'academy-course' | 'product'

export interface VoucherCategoryRow {
  id: string
  title: string
  description?: string | null
  treatment_package_id?: string | null
  academy_course_id?: string | null
  product_id?: string | null
  target_name?: string | null
  card_rank_id?: string | null
  card_rank_name?: string | null
  is_loyalty: boolean
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

const paths: Record<VoucherCategory, string> = {
  'treatment-package': '/treatment-package-vouchers',
  'academy-course': '/academy-course-vouchers',
  product: '/product-vouchers',
}

export const voucherCategoryPath = (category: VoucherCategory) => paths[category]

export async function getVoucherCategory(category: VoucherCategory) {
  return (await apiClient.get(paths[category])).data
}

export async function postVoucherCategory(category: VoucherCategory, data: Partial<VoucherCategoryRow>) {
  return (await apiClient.post(paths[category], data)).data
}

export async function putVoucherCategory(category: VoucherCategory, id: string, data: Partial<VoucherCategoryRow>) {
  return (await apiClient.put(`${paths[category]}/${id}`, data)).data
}

export async function deleteVoucherCategory(category: VoucherCategory, id: string) {
  return (await apiClient.delete(`${paths[category]}/${id}`)).data
}
