export interface ListPaginationOptions {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
  /** Danh từ chỉ loại bản ghi, ví dụ "khách hàng", "đơn hàng". */
  noun: string
}

/** Cắt dữ liệu client-side theo trang; tự kẹp page về khoảng hợp lệ
 *  để không ra bảng trống khi dữ liệu thu hẹp sau khi lọc. */
export function paginateRows<T>(rows: T[], page: number, limit: number): T[] {
  const pageCount = Math.ceil(rows.length / limit)
  const current = Math.min(Math.max(page, 1), Math.max(pageCount, 1))
  return rows.slice((current - 1) * limit, current * limit)
}
