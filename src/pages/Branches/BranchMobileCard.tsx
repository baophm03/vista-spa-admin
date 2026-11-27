import { MobileCardRow } from '@/components/base/MobileCards'
import type { Branch } from '@/api/models/branch'

export type BranchColumnKey = 'image' | 'code' | 'name' | 'address' | 'phone' | 'status'

/** Thẻ cơ sở trên mobile/tablet (thiết kế Figma MobileCS). Thiết kế không có ảnh trong thẻ nên cột "Ảnh" chỉ áp dụng cho bảng desktop. */
export default function BranchMobileCard({ row, visibleColumns }: { row: Branch; visibleColumns: BranchColumnKey[] }) {
  const show = (key: BranchColumnKey) => visibleColumns.includes(key)
  const hasHead = show('name') || show('status')
  const hasRows = show('code') || show('address') || show('phone')

  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-[7px] rounded-xl border border-[#E6DFEA] bg-[var(--vista-neutral-0)] p-3">
      {hasHead && (
        <div className="flex w-full items-center gap-2">
          <p className="m-0 min-w-0 flex-1 break-words text-[15px] font-bold text-[#282335]">
            {show('name') ? row.name : row.code}
          </p>
          {show('status') && (
            <span
              className={
                row.is_active
                  ? 'shrink-0 rounded-[7px] bg-[var(--vista-green-50)] px-[7px] py-1 text-[11px] font-medium text-[var(--vista-green-700)]'
                  : 'shrink-0 rounded-[7px] bg-[var(--vista-neutral-100)] px-[7px] py-1 text-[11px] font-medium text-[var(--vista-neutral-800)]'
              }
            >
              {row.is_active ? 'Đang hoạt động' : 'Đã ngừng'}
            </span>
          )}
        </div>
      )}
      {hasHead && hasRows && <div className="h-px w-full bg-[#E6DFEA]" />}
      {show('code') && <MobileCardRow label="Mã cơ sở" value={row.code} />}
      {show('address') && <MobileCardRow label="Địa chỉ" value={row.address?.trim() || '—'} />}
      {show('phone') && <MobileCardRow label="Số điện thoại" value={row.phone?.trim() || '—'} />}
    </div>
  )
}