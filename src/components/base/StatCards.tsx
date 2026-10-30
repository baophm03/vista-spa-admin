import type { ReactNode } from 'react'

export type StatTone = 'primary' | 'secondary' | 'tertiary' | 'neutral'

export interface StatItem {
  key: string
  label: string
  value: ReactNode
  icon: ReactNode
  tone?: StatTone
  /** Chú thích nhỏ dưới giá trị (nguồn số liệu, phạm vi thời gian...). */
  note?: ReactNode
}

interface StatCardsProps {
  items: StatItem[]
}

const TONE_STYLES: Record<StatTone, { disc: string; discInk: string; circle: string; ink: string }> = {
  // Nền đĩa/circle pha 7-9% màu gốc vào trắng (nhạt hơn --brand-tint 14%);
  // icon primary luôn dùng --brand-dark (giữ hue, luôn đọc được trên nền nhạt bất kể primary sáng/tối)
  primary: {
    disc: 'color-mix(in srgb, var(--brand-primary) 9%, #FFFFFF)',
    discInk: 'var(--brand-dark)',
    circle: 'color-mix(in srgb, var(--brand-primary) 7%, #FFFFFF)',
    ink: 'var(--brand-dark, #26352D)',
  },
  secondary: {
    disc: 'color-mix(in srgb, var(--brand-secondary) 9%, #FFFFFF)',
    discInk: 'var(--brand-secondary-ink)',
    circle: 'color-mix(in srgb, var(--brand-secondary) 7%, #FFFFFF)',
    ink: 'var(--brand-secondary-ink)',
  },
  tertiary: {
    disc: 'color-mix(in srgb, var(--brand-tertiary) 16%, #FFFFFF)',
    discInk: 'var(--brand-tertiary-ink)',
    circle: 'color-mix(in srgb, var(--brand-tertiary) 12%, #FFFFFF)',
    ink: 'var(--brand-tertiary-ink)',
  },
  neutral: {
    disc: '#ECEFEA',
    discInk: '#5B6760',
    circle: '#E6EAE7',
    ink: '#3F4A44',
  },
}

/** Hàng card thống kê cho đầu trang danh sách — ngôn ngữ thiết kế chung với
 *  card hạng thẻ ở /points: nền trắng, đĩa icon tint theo tone, vòng tròn
 *  trang trí góc, hover nhấc nhẹ. Chỉ truyền số liệu đáng tin cậy.
 *  Layout là CSS grid auto-fit nên 4 hay 5 card cũng chia đều một hàng. */
export default function StatCards({ items }: StatCardsProps) {
  if (items.length === 0) return null
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))',
        gap: 14,
        marginBottom: 18,
      }}
    >
      {items.map((item) => {
        const tone = TONE_STYLES[item.tone ?? 'primary']
        return (
          <div key={item.key} className="stat-card" style={{ borderColor: 'var(--brand-border-soft, #ECEFEA)' }}>
              <span aria-hidden className="stat-card-circle" style={{ background: tone.circle }} />
              <span
                aria-hidden
                className="stat-card-disc"
                style={{ background: tone.disc, color: tone.discInk }}
              >
                {item.icon}
              </span>
              <div className="stat-card-body" style={{ color: tone.ink }}>
                <span className="stat-card-label">{item.label}</span>
                <span className="stat-card-value">{item.value}</span>
                {item.note && (
                  <span style={{ fontSize: 12, color: '#6F7071', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.note}
                  </span>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}
