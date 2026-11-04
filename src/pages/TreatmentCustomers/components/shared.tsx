import type { ReactNode } from 'react'
/** Giá trị ô bảng — trống thì gạch mờ */
export const CellVal = ({ v }: { v?: string | null }) =>
  v ? <>{v}</> : <span className="text-[#C4C6C9]">—</span>

/** Dòng subheader pha nằm trong bảng buổi (tint nhạt, full-width) */
export const SubHead = ({ children }: { children: string }) => (
  <div className="border-t border-[var(--brand-border-soft)] bg-[var(--brand-bg)] px-4 py-[9px] text-[12.5px] font-extrabold uppercase tracking-[1.2px] text-[var(--brand-dark)]">
    {children}
  </div>
)

/** 1 dòng nhãn | giá trị trong bảng buổi */
export const TRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex border-t border-[var(--brand-border-soft)] px-4 py-[11px]">
    <span className="w-[150px] shrink-0 pt-px pr-3 text-[13.5px] font-bold text-[#3F4145]">{label}</span>
    <span className="-my-[11px] min-w-0 flex-1 border-l border-[var(--brand-border-soft)] py-[11px] pl-4 text-[14.5px] font-semibold leading-[1.6] text-[#26211F]">
      {children}
    </span>
  </div>
)
