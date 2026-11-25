// Types dùng chung cho domain voucher (trang Voucher, Voucher khách hàng, ưu đãi khi
// thanh toán, quà đổi điểm, đăng ký học viên). Trước đây nằm ở facade src/api/custom/*;
// facade đã bị xoá — CRUD đi qua generated client (src/api/endpoints/*-vouchers*).

export type VoucherCategory = 'treatment-package' | 'academy-course' | 'product'

export const MOBILE_TAB_LABELS: Record<VoucherCategory, string> = {
  'treatment-package': 'Liệu trình & DV lẻ',
  'academy-course': 'Khóa học',
  product: 'Sản phẩm',
}

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

export type VoucherCustomerSource = 'AUTO' | 'FIXED'
export type VoucherCustomerStatus = 'ACTIVE' | 'USED' | 'REVOKED'

/** Một voucher khách hàng đang có: tự động theo hạng hoặc được gán tay. */
export interface VoucherCustomerRow {
  assignment_id?: string | null
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
  user_id?: string
  /** Cơ sở admin chọn khi gán — hiển thị ở cột "Cơ sở". */
  branch_id?: string
  note?: string | null
}

export const CATEGORY_META: Record<VoucherCategory, { label: string; targetField: keyof VoucherCategoryRow; targetLabel: string }> = {
  // Dùng chung cho gói liệu trình và dịch vụ lẻ (gói SINGLE_SESSION) — cùng bảng treatment_package
  'treatment-package': { label: 'Voucher liệu trình & dịch vụ lẻ', targetField: 'treatment_package_id', targetLabel: 'Gói liệu trình / dịch vụ lẻ áp dụng' },
  'academy-course': { label: 'Voucher khóa học', targetField: 'academy_course_id', targetLabel: 'Khóa học áp dụng' },
  product: { label: 'Voucher sản phẩm', targetField: 'product_id', targetLabel: 'Phạm vi sản phẩm' },
}
