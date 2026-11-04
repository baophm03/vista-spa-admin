import type { ReactNode } from 'react'
/** Giá trị ô bảng — trống thì gạch mờ */
export const CellVal = ({ v }: { v?: string | null }) =>
  v ? <>{v}</> : <span style={{ color: '#C4C6C9' }}>—</span>

/** Dòng subheader pha nằm trong bảng buổi (tint nhạt, full-width) */
export const SubHead = ({ children }: { children: string }) => (
  <div
    style={{
      padding: '9px 16px',
      background: 'var(--brand-bg)',
      borderTop: '1px solid var(--brand-border-soft)',
      fontSize: 12.5,
      fontWeight: 800,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: 'var(--brand-dark)',
    }}
  >
    {children}
  </div>
)

/** 1 dòng nhãn | giá trị trong bảng buổi */
export const TRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', padding: '11px 16px', borderTop: '1px solid var(--brand-border-soft)' }}>
    <span style={{ width: 150, flexShrink: 0, fontSize: 13.5, fontWeight: 700, color: '#3F4145', paddingTop: 1, paddingRight: 12 }}>{label}</span>
    <span
      style={{
        flex: 1,
        fontSize: 14.5,
        fontWeight: 600,
        color: '#26211F',
        lineHeight: 1.6,
        minWidth: 0,
        borderLeft: '1px solid var(--brand-border-soft)',
        paddingLeft: 16,
        margin: '-11px 0',
        paddingTop: 11,
        paddingBottom: 11,
      }}
    >
      {children}
    </span>
  </div>
)

