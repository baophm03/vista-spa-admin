import { CheckOutlined, MinusOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'

interface Props {
  checked: boolean
  indeterminate?: boolean
  onToggle: () => void
  children: ReactNode
}

/** Hàng chọn kiểu mockup: nút tròn tím có tick trắng khi chọn, viền xám khi bỏ chọn. */
export default function CheckCircle({ checked, indeterminate = false, onToggle, children }: Props) {
  const active = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 17,
          height: 17,
          borderRadius: 5,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          background: active ? 'var(--brand-primary)' : 'transparent',
          border: active ? '1px solid var(--brand-primary)' : '2px solid #C9CDD2',
          transition: 'background .15s, border-color .15s',
        }}
      >
        {indeterminate && !checked ? (
          <MinusOutlined style={{ fontSize: 9, color: '#fff' }} />
        ) : checked ? (
          <CheckOutlined style={{ fontSize: 10, color: '#fff' }} />
        ) : null}
      </span>
      {children}
    </button>
  )
}
