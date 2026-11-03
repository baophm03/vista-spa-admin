import type { ReactNode } from 'react'

/** Khối thông tin label:value trong card mobile */
export function MobileCardRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mobile-card-row">
      <span className="mobile-card-label">{label}</span>
      <span className="mobile-card-value">{value}</span>
    </div>
  )
}

/** Danh sách card hiển thị thay table trên mobile (đi kèm Table có class "desktop-only").
 *  Tự bọc trong container "mobile-only" để CSS ẩn/hiện theo bề rộng màn hình. */
export default function MobileCards<T>({
  rows,
  rowKey,
  renderCard,
  onCardClick,
  emptyText = 'Chưa có dữ liệu',
  loading = false,
}: {
  rows: T[]
  rowKey: (row: T) => string
  renderCard: (row: T, index: number) => ReactNode
  onCardClick?: (row: T) => void
  emptyText?: string
  loading?: boolean
}) {
  if (loading) return <div className="mobile-only mobile-card-list"><div className="mobile-card">Đang tải…</div></div>
  if (!rows.length) return <div className="mobile-only mobile-card-list"><div className="mobile-card" style={{ textAlign: 'center', color: '#849197' }}>{emptyText}</div></div>
  return (
    <div className="mobile-only mobile-card-list">
      {rows.map((row, index) => (
        <div
          className="mobile-card"
          key={rowKey(row)}
          style={onCardClick ? { cursor: 'pointer' } : undefined}
          onClick={onCardClick ? () => onCardClick(row) : undefined}
        >
          {renderCard(row, index)}
        </div>
      ))}
    </div>
  )
}
