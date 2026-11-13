import type { VoucherCategory, VoucherCategoryRow } from '@/api/endpoints/voucherCategories'

export type { VoucherCategory, VoucherCategoryRow }

export const CATEGORY_META: Record<VoucherCategory, { label: string; targetField: keyof VoucherCategoryRow; targetLabel: string }> = {
  'treatment-package': { label: 'Voucher gói liệu trình', targetField: 'treatment_package_id', targetLabel: 'Gói liệu trình áp dụng' },
  'academy-course': { label: 'Voucher khóa học', targetField: 'academy_course_id', targetLabel: 'Khóa học áp dụng' },
  product: { label: 'Voucher sản phẩm', targetField: 'product_id', targetLabel: 'Sản phẩm áp dụng' },
}
