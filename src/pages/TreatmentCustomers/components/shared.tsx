import type { ReactNode } from 'react'
import { Skeleton } from 'antd'

export function TreatmentLoading({ label, count = 3 }: { label: string; count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="grid gap-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} aria-hidden="true" className="mobile-card">
          <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2, width: ['65%', '35%'] }} />
        </div>
      ))}
    </div>
  )
}
/** Giá trị ô bảng — trống thì gạch mờ */
export const CellVal = ({ v }: { v?: string | null }) =>
  v ? <>{v}</> : <span className="dm-value-empty">—</span>

/** Nhãn nhóm trong thẻ buổi (Đầu buổi / Thực hiện / Kết quả) */
export const SubHead = ({ children }: { children: string }) => (
  <div className="dm-session-sub">{children}</div>
)

/** 1 dòng nhãn | giá trị trong thẻ buổi */
export const TRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="dm-session-row">
    <span className="dm-label">{label}</span>
    <div className="dm-value">{children}</div>
  </div>
)
