import { Skeleton } from 'antd'
import { ProfileOutlined } from '@ant-design/icons'
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
  emptyDescription,
  loading = false,
}: {
  rows: T[]
  rowKey: (row: T, index: number) => string
  renderCard: (row: T, index: number) => ReactNode
  onCardClick?: (row: T) => void
  emptyText?: string
  emptyDescription?: string
  loading?: boolean
}) {
  if (loading) {
    // 3 card skeleton cùng khung .mobile-card để layout không nhảy khi data về
    return (
      <div className="mobile-only mobile-card-list">
        {[0, 1, 2].map((i) => (
          <div className="mobile-card" key={i}>
            <Skeleton active title={{ width: '55%' }} paragraph={{ rows: 2, width: ['100%', '85%'] }} />
          </div>
        ))}
      </div>
    )
  }
  // Trạng thái rỗng theo Figma "Chưa có dữ liệu": card trắng cao, đĩa icon tròn
  // tím nhạt ở giữa + chữ đậm bên dưới
  if (!rows.length) {
    return (
      <div className="mobile-only mobile-card-list">
        <div
          className="mobile-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: '56px 16px',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#f2e5f4',
              color: 'var(--brand-primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            <ProfileOutlined />
          </span>
          <div className="text-center">
            <span style={{ fontSize: 14, fontWeight: 700, color: '#282335' }}>{emptyText}</span>
            {emptyDescription && <div className="mt-1 text-xs text-[#655e71]">{emptyDescription}</div>}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="mobile-only mobile-card-list">
      {rows.map((row, index) => (
        <div
          className="mobile-card"
          key={rowKey(row, index)}
          style={onCardClick ? { cursor: 'pointer' } : undefined}
          onClick={onCardClick ? () => onCardClick(row) : undefined}
        >
          {renderCard(row, index)}
        </div>
      ))}
    </div>
  )
}
