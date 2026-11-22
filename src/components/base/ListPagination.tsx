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
  // Mobile (<768px): pager compact theo thiết kế Figma — dòng đếm bên trái,
  // cụm [<] [trang hiện tại] [>] bên phải thay vì hàng số trang đầy đủ.
  if (isMobile) {
    // Theo Figma "Phân trang": nút 32×32 nền #F0EBF2 không viền, radius 7,
    // icon tím; số trang hiện tại 28×28 nền tím chữ trắng 11px.
    const arrowStyle = (disabled: boolean) => ({
      width: 32,
      height: 32,
      flexShrink: 0,
      padding: 0,
      border: 'none',
      borderRadius: 7,
      background: '#f0ebf2',
      color: 'var(--brand-primary)',
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'default' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 13,
    } as const)
    // Dãy số trang rút gọn: 1 … (current-1) current (current+1) … cuối
    const pages: (number | '…')[] = []
    for (let p = 1; p <= pageCount; p++) {
      if (p === 1 || p === pageCount || Math.abs(p - current) <= 1) pages.push(p)
      else if (pages[pages.length - 1] !== '…') pages.push('…')
    }
    const pageBtnStyle = (active: boolean) => ({
      minWidth: 28,
      height: 28,
      padding: '0 6px',
      border: 'none',
      borderRadius: 7,
      background: active ? 'var(--brand-primary)' : '#f0ebf2',
      color: active ? 'var(--brand-on-primary)' : '#282335',
      fontSize: 11,
      fontWeight: 500,
      cursor: active ? 'default' : 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    } as const)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#655E71' }}>Hiển thị {from} – {to} trong {total} {noun}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button type="button" aria-label="Trang trước" disabled={current <= 1} style={arrowStyle(current <= 1)} onClick={() => onChange(current - 1)}>
            <LeftOutlined />
          </button>
          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} style={{ minWidth: 20, textAlign: 'center', color: '#655E71', fontSize: 11 }}>…</span>
            ) : (
              <button key={p} type="button" aria-label={`Trang ${p}`} style={pageBtnStyle(p === current)} onClick={() => p !== current && onChange(p)}>
                {p}
              </button>
            ),
          )}
          <button type="button" aria-label="Trang sau" disabled={current >= pageCount} style={arrowStyle(current >= pageCount)} onClick={() => onChange(current + 1)}>
            <RightOutlined />
          </button>
        </div>
      </div>
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
