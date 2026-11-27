import { Button, Skeleton } from 'antd'
import { WarningOutlined } from '@ant-design/icons'

/** Trạng thái "Đang tải…": nhãn + 3 card khung xương (mobile/tablet). */
export function MobileLoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true">
      <span className="text-[13px] text-[#6F7071]">Đang tải…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-[#E9DDF0] bg-white px-4 py-4">
          <Skeleton active title={false} paragraph={{ rows: 3, width: ['78%', '55%', '35%'] }} />
        </div>
      ))}
    </div>
  )
}

/** Card lỗi tải: tiêu đề đỏ + mô tả + nút "Thử lại" căn phải. */
export function MobileErrorCard({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="grid gap-2 rounded-2xl border border-[#F5C2C7] bg-[#FDF1F2] px-4 py-4">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-[#B42318]">
        <WarningOutlined aria-hidden />
        <span>{title}</span>
      </div>
      <p className="m-0 text-[13px] text-[#6F7071]">Đã có lỗi xảy ra, vui lòng thử lại sau</p>
      <div className="flex justify-end">
        <Button className="h-11! rounded-xl! px-3! font-semibold!" onClick={onRetry}>Thử lại</Button>
      </div>
    </div>
  )
}

/** Card trống: một dòng chữ (vd "Chưa có ca làm việc"), tùy chọn mô tả phụ. */
export function MobileEmptyCard({ title, description }: { title: string; description?: string }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-[#E9DDF0] bg-white px-4 py-6 text-center">
      <span className="text-[14px] font-semibold text-[#292331]">{title}</span>
      {description && <span className="text-[13px] text-[#6F7071]">{description}</span>}
    </div>
  )
}
