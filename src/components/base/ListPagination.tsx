import { Pagination } from 'antd'

interface ListPaginationProps {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
  /** Danh từ chỉ loại bản ghi, ví dụ "khách hàng", "đơn hàng". */
  noun: string
  hideOnSinglePage?: boolean
}

/** Thanh phân trang chuẩn (theo thiết kế trang Khách hàng):
 *  tổng số bản ghi nằm bên trái, cụm nút chuyển trang gộp khối bên phải.
 *  Đặt dưới `<Table pagination={false}>`; với bảng phân trang client-side,
 *  dùng `paginateRows()` để cắt dữ liệu theo trang. */
export default function ListPagination({ page, limit, total, onChange, noun, hideOnSinglePage }: ListPaginationProps) {
  const pageCount = Math.ceil(total / limit)
  if (total === 0 || (hideOnSinglePage && pageCount <= 1)) return null
  const current = Math.min(Math.max(page, 1), pageCount)
  const from = (current - 1) * limit + 1
  const to = Math.min(current * limit, total)
  return (
    <div
      className="list-pagination"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 16 }}
    >
      <span className="list-pagination-count">Hiển thị {from} - {to} trong {total} {noun}</span>
      <Pagination
        current={current}
        pageSize={limit}
        total={total}
        onChange={onChange}
        showSizeChanger={false}
      />
    </div>
  )
}
