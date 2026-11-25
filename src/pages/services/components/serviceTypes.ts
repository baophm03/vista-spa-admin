import type { Service } from '@/api/models/service'
import type { ServiceCategory } from '@/api/models/serviceCategory'
import type { ServiceCategorySummary } from '@/api/models/serviceCategorySummary'
import { formatCurrency } from '@/themeRuntime'

/** BE list include kèm `service_category`, ảnh bìa `image_file` và bộ ảnh `service_galleries[].file`. */
export type ServiceRow = Service & {
  branch_id?: string | null
  service_category?: { id?: string; name?: string }
  image_file?: { id?: string; path?: string } | null
  service_galleries?: Array<{ file_id?: string; sort_order?: number; file?: { id?: string; path?: string } | null }>
}

/** Danh mục 1 cấp; `summary` có khi gọi list với with_summary=true. */
export type ServiceCategoryRow = ServiceCategory & {
  summary?: ServiceCategorySummary
  image_file?: { id?: string; path?: string } | null
}

/** id ảo của nhóm dịch vụ chưa có danh mục (route /services/categories/none, query category_id=none). */
export const UNCATEGORIZED_ID = 'none'

export function formatServicePrice(price: number | string | null | undefined, priceMax: number | string | null | undefined, currency: string) {
  const one = (value: number | string | null | undefined) =>
    value === null || value === undefined || value === '' ? '—' : formatCurrency(value, currency)
  return priceMax != null && Number(priceMax) !== Number(price) ? `${one(price)} – ${one(priceMax)}` : one(price)
}

/** Option chọn danh mục (1 cấp): danh mục đang dùng + danh mục đã ẩn đang được chọn sẵn. */
export function categoryOptions(categories: ServiceCategoryRow[], includeInactiveId?: string) {
  return categories
    .filter((category) => category.is_active !== false || category.id === includeInactiveId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'vi'))
    .map((category) => ({ value: category.id, label: `${category.name}${category.is_active === false ? ' (đã ẩn)' : ''}` }))
}
