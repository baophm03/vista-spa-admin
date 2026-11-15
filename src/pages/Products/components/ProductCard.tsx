import type { ReactNode } from "react";
import { AppstoreOutlined, ArrowRightOutlined } from "@ant-design/icons";

export interface ProductCardProps {
    title: string
    imageSrc?: string | null
    isActive: boolean
    category: string
    price: string
    actions?: ReactNode
    onOpen: () => void
}

function Stat({label, value}:{label: string, value: string}) {
     return (
    <div className="min-w-0">
      <div className="text-sm text-[#6F7071]">{label}</div>
      <div className="mt-0.5 break-words text-base font-bold leading-snug text-[var(--brand-dark,#1E1A1F)]" title={value}>
        {value}
      </div>
    </div>
  )
}

export default function ProductCard({title, imageSrc, isActive, category, price, actions, onOpen}: ProductCardProps) {
    return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--brand-border-soft,#ECEFEA)] bg-[var(--brand-bg-card,#FFFFFF)]">
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-[#F1EDF2]">
        {imageSrc ? (
          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-[#B9B4BD]">
            <AppstoreOutlined />
          </div>
        )}
        {actions && <div className="absolute right-3 top-3 rounded-full bg-white/90 shadow-sm">{actions}</div>}
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="m-0 min-w-0 text-xl font-semibold leading-snug text-[var(--brand-dark,#1E1A1F)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
            {title}
          </h3>
          <span
            className={`shrink-0 rounded-full px-3 text-[13px] font-semibold leading-6 ${
              isActive ? 'bg-[#EAF8E8] text-[#2F7A12]' : 'bg-[#FDE4E7] text-[#B4202C]'
            }`}
          >
            {isActive ? 'Đang hiển thị' : 'Đã ẩn'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 px-0.5">
          <Stat label="Danh mục" value={category} />
          <Stat label="Giá niêm yết" value={price} />
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-auto flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#E3DFEA] bg-transparent text-[15px] font-semibold text-[var(--brand-dark,#1E1A1F)] transition-colors hover:border-[var(--brand-primary,#A0148F)] hover:text-[var(--brand-primary,#A0148F)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#A0148F)]"
        >
          Xem chi tiết
          <ArrowRightOutlined />
        </button>
      </div>
    </article>
  )
}