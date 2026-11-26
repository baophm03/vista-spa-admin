import { Skeleton } from 'antd'
import StatCards, { type StatItem } from './StatCards'

/** Mobile counterpart to the desktop-only StatCards group. */
export default function MobileStatCards({ items, loading = false }: { items: StatItem[]; loading?: boolean }) {
  if (loading) {
    return (
      <div
        className="mobile-only"
        style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}
      >
        {Array.from({ length: Math.max(items.length, 2) }).map((_, i) => (
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
    <div className="mobile-only">
      <StatCards items={items} />
    </div>
  )
}
