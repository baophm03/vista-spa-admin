import { Grid, Pagination } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'

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
  const isMobile = !Grid.useBreakpoint().md
  const pageCount = Math.ceil(total / limit)
  if (total === 0 || (hideOnSinglePage && pageCount <= 1)) return null
  const current = Math.min(Math.max(page, 1), pageCount)
  const from = (current - 1) * limit + 1
  const to = Math.min(current * limit, total)
  if (isMobile) {
    // Mobile: chỉ cụm nút căn giữa (bỏ dòng "Hiển thị x – y trong n"), mọi nút cùng cỡ 36×36,
    // cách nhau 8px, bo 8px (docs/mobile-design-guide.md); trang hiện tại nền tím chữ trắng.
    const arrowStyle = (disabled: boolean) => ({
      width: 36,
      height: 36,
      flexShrink: 0,
      padding: 0,
      border: 'none',
      borderRadius: 8,
      background: '#f0ebf2',
      color: 'var(--brand-primary)',
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'default' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
    } as const)
    const pages: (number | '…')[] = pageCount <= 5
      ? Array.from({ length: pageCount }, (_, index) => index + 1)
      : current <= 2
        ? [1, 2, 3, '…', pageCount]
        : current >= pageCount - 1
          ? [1, '…', pageCount - 2, pageCount - 1, pageCount]
          : [1, ...(current > 3 ? ['…' as const] : []), current - 1, current, current + 1, ...(current < pageCount - 2 ? ['…' as const] : []), pageCount]
    const pageBtnStyle = (active: boolean) => ({
      minWidth: 36,
      height: 36,
      padding: '0 8px',
      border: 'none',
      borderRadius: 8,
      background: active ? 'var(--brand-primary)' : '#f0ebf2',
      color: active ? 'var(--brand-on-primary)' : '#282335',
      fontSize: 13,
      fontWeight: 500,
      cursor: active ? 'default' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as const)
    return (
      <nav aria-label={`Phân trang ${noun}`} style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%' }}>
          <button type="button" aria-label="Trang trước" disabled={current <= 1} style={arrowStyle(current <= 1)} onClick={() => onChange(current - 1)}>
            <LeftOutlined />
          </button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} style={{ minWidth: 20, textAlign: 'center', color: '#655E71', fontSize: 13 }}>…</span>
            ) : (
              <button key={p} type="button" aria-label={`Trang ${p}`} aria-current={p === current ? 'page' : undefined} style={pageBtnStyle(p === current)} onClick={() => p !== current && onChange(p)}>
                {p}
              </button>
            ),
          )}
          <button type="button" aria-label="Trang sau" disabled={current >= pageCount} style={arrowStyle(current >= pageCount)} onClick={() => onChange(current + 1)}>
            <RightOutlined />
          </button>
        </div>
      </nav>
    )
  }
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
