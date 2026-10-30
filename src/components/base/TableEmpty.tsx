import { Typography } from 'antd'
import type { ReactNode } from 'react'

interface TableEmptyProps {
  /** Tiêu đề chính dưới ảnh. */
  title?: string
  /** Mô tả bổ sung (điều kiện lọc, hướng dẫn chọn...). */
  description?: ReactNode
}

/** Empty state dùng chung cho mọi bảng — ảnh minh họa SVG pha màu brand,
 *  thay thế các Empty/text lẻ tẻ từng trang. */
export default function TableEmpty({ title = 'Chưa có dữ liệu', description }: TableEmptyProps) {
  return (
    <div style={{ padding: '28px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width="132" height="104" viewBox="0 0 132 104" fill="none" aria-hidden style={{ marginBottom: 8 }}>
        {/* vòng tròn nền */}
        <circle cx="66" cy="52" r="44" fill="var(--brand-tint, #F1EAF6)" opacity="0.55" />
        {/* thẻ phía sau */}
        <rect x="34" y="24" width="64" height="44" rx="8" fill="var(--brand-tint, #F1EAF6)" />
        {/* thẻ chính */}
        <rect x="28" y="34" width="64" height="44" rx="8" fill="#FFFFFF" stroke="var(--brand-border-strong, #DCD3E4)" strokeWidth="1.5" />
        <rect x="36" y="43" width="26" height="6" rx="3" fill="var(--brand-primary, #8E63A9)" opacity="0.75" />
        <rect x="36" y="55" width="42" height="4" rx="2" fill="var(--brand-border-strong, #DCD3E4)" />
        <rect x="36" y="64" width="34" height="4" rx="2" fill="var(--brand-border-strong, #DCD3E4)" />
        {/* hạt sáng */}
        <circle cx="100" cy="30" r="4" fill="var(--brand-tertiary, #FFD700)" opacity="0.85" />
        <circle cx="26" cy="24" r="2.5" fill="var(--brand-tertiary, #FFD700)" opacity="0.7" />
        <path d="M104 72l2.2 4.6 4.6 2.2-4.6 2.2-2.2 4.6-2.2-4.6-4.6-2.2 4.6-2.2z" fill="var(--brand-secondary, #D01A7E)" opacity="0.55" />
      </svg>
      <Typography.Text strong style={{ fontSize: 14 }}>{title}</Typography.Text>
      {description && (
        <Typography.Text type="secondary" style={{ fontSize: 13, maxWidth: 380, textAlign: 'center' }}>
          {description}
        </Typography.Text>
      )}
    </div>
  )
}
