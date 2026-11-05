import type { Product } from '@/api/models/product'
import type { ProductCategory } from '@/api/models/productCategory'
import { formatCurrency } from '@/themeRuntime'

/** BE include kèm `category`, ảnh bìa `cover_file` và bộ ảnh `product_galleries[].file`. */
export type ProductRow = Product & {
  category?: { id?: string; name?: string }
  cover_file_id?: string | null
  cover_file?: { id?: string; path?: string } | null
  product_galleries?: Array<{ file_id?: string; sort_order?: number; file?: { id?: string; path?: string } | null }>
}

/** BE list trả thêm active_product_count. */
export type ProductCategoryRow = ProductCategory & { active_product_count?: number }

export const formatPrice = (price: number | null | undefined, currency: string) =>
  price === null || price === undefined ? '—' : formatCurrency(price, currency)

export const PRODUCT_COLUMNS = [
  { value: 'cover', label: 'Ảnh' },
  { value: 'name', label: 'Sản phẩm' },
  { value: 'category', label: 'Danh mục' },
  { value: 'price', label: 'Giá hiển thị' },
  { value: 'link', label: 'Liên kết' },
  { value: 'status', label: 'Trạng thái' },
]

export const DEFAULT_PRODUCT_COLUMNS = PRODUCT_COLUMNS.map((column) => column.value)

