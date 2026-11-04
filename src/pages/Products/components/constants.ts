import type { Product } from '@/api/models/product'
import type { ProductCategory } from '@/api/models/productCategory'
import { formatCurrency } from '@/themeRuntime'

/** BE include kèm `category` (id, name) khi list. */
export type ProductRow = Product & { category?: { id?: string; name?: string } }

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

