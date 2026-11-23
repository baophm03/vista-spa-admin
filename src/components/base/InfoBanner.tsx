import { InfoCircleFilled } from '@ant-design/icons'
import type { ReactNode } from 'react'

/** Banner thông tin nhẹ kiểu Figma: nền tím nhạt, icon tím, chữ đậm + mô tả — thay Alert info bị nhuộm màu primary. */
export default function InfoBanner({ title, description, className }: { title: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        gap: 8,
        padding: '10px 12px',
        borderRadius: 10,
        background: '#f2e5f4',
        border: '1px solid #E6DFEA',
      }}
    >
      <InfoCircleFilled style={{ color: 'var(--brand-primary)', fontSize: 15, marginTop: 1 }} />
      <div>
        <div style={{ fontWeight: 600, color: '#282335', fontSize: 13, marginBottom: description ? 3 : 0 }}>{title}</div>
        {description && <div style={{ color: '#655e71', fontSize: 12, lineHeight: 1.5 }}>{description}</div>}
      </div>
    </div>
  )
}
