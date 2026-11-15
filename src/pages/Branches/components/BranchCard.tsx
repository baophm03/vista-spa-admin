import type { ReactNode } from 'react'
import { ArrowRightOutlined } from '@ant-design/icons'

export interface BranchCardProps {
  name: string
  code: string
  isActive: boolean
  address: string
  phone: string
  actions?: ReactNode
  onOpen?: () => void
  actionLabel?: string
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-[#6F7071]">{label}</div>
      <div className="mt-0.5 break-words text-base font-bold leading-snug text-[var(--brand-dark,#1E1A1F)]" title={value}>
        {value}
      </div>
    </div>
  )
}

export default function BranchCard({ name, code, isActive, address, phone, actions, onOpen, actionLabel = 'Chỉnh sửa' }: BranchCardProps) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--brand-border-soft,#ECEFEA)] bg-[var(--brand-bg-card,#FFFFFF)]">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="m-0 text-xl font-semibold leading-snug text-[var(--brand-dark,#1E1A1F)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
              {name}
            </h3>
            <div className="mt-1 text-sm text-[#6F7071]">{code}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-3 text-[13px] font-semibold leading-6 ${
                isActive ? 'bg-[#EAF8E8] text-[#2F7A12]' : 'bg-[#FDE4E7] text-[#B4202C]'
              }`}
            >
              {isActive ? 'Đang hoạt động' : 'Đã ngừng'}
            </span>
            {actions}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 px-0.5 sm:grid-cols-2">
          <Stat label="Điện thoại" value={phone} />
          <Stat label="Địa chỉ" value={address} />
        </div>

        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="mt-auto flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#E3DFEA] bg-transparent text-[15px] font-semibold text-[var(--brand-dark,#1E1A1F)] transition-colors hover:border-[var(--brand-primary,#A0148F)] hover:text-[var(--brand-primary,#A0148F)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#A0148F)]"
          >
            {actionLabel}
            <ArrowRightOutlined />
          </button>
        )}
      </div>
    </article>
  )
}