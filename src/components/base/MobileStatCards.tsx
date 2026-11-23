import { Skeleton } from 'antd'
import { TONE_STYLES, type StatItem } from './StatCards'

/** Hàng chỉ số compact cho mobile (<768px) — bám theo thiết kế
 *  "Vista Admin / Chỉ số liệu trình" trong Figma: card trắng viền mảnh,
 *  radius 12, label nhỏ phía trên + số liệu to theo tone (không icon/note).
 *  Đi kèm StatCards bọc "desktop-only": cùng một data, hai dạng hiển thị. */
export default function MobileStatCards({ items, loading = false }: { items: StatItem[]; loading?: boolean }) {
  // 4 card thì xếp 2×2 cho đều; ≤3 card xếp một hàng như bản Figma
  const cols = items.length === 4 ? 2 : Math.min(Math.max(items.length, 1), 3)
  if (loading) {
    return (
      <div
        className="mobile-only"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 14 }}
      >
        {Array.from({ length: Math.max(cols, 2) }).map((_, i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              border: '1px solid var(--brand-border-soft)',
              borderRadius: 12,
              padding: '8px 10px',
              minHeight: 64,
            }}
          >
            <Skeleton active title={false} paragraph={{ rows: 2, width: ['70%', '50%'] }} style={{ marginTop: 4 }} />
          </div>
        ))}
      </div>
    )
  }
  if (items.length === 0) return null
  return (
    <div
      className="mobile-only"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8, marginBottom: 14 }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            minWidth: 0,
            background: '#fff',
            border: '1px solid var(--brand-border-soft)',
            borderRadius: 12,
            padding: '8px 10px',
            minHeight: 64,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 6,
            boxShadow: '0 1px 2px rgba(var(--brand-dark-rgb), 0.04)',
          }}
        >
          <span style={{ fontSize: 11.5, fontWeight: 500, color: '#655E71', lineHeight: 1.3 }}>
            {item.label}
          </span>
          <span
            title={typeof item.value === 'string' ? item.value : undefined}
            style={{
              fontSize: 19,
              fontWeight: 700,
              lineHeight: 1.2,
              color: TONE_STYLES[item.tone ?? 'primary'].ink,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}
