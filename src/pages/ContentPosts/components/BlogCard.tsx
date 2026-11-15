import type { ReactNode } from 'react'
import { ArrowRightOutlined, PictureOutlined, PushpinFilled } from '@ant-design/icons'

export type BlogCardStatusTone = 'draft' | 'published' | 'archived'

export interface BlogCardProps {
  title: string
  /** "Tóm tắt ngắn" của bài, hiển thị tối đa 3 dòng */
  excerpt?: string | null
  /** Tên chuyên mục, hiện thành chip trên ảnh */
  category?: string
  imageSrc?: string | null
  /** Đã format sẵn, vd "13/11/2026" */
  date?: string
  /** Tên tác giả; không truyền thì ẩn avatar + tên */
  author?: string
  /** Thông tin phụ cạnh ngày, vd "120 lượt xem" */
  meta?: string
  /** Nhãn trạng thái (Nháp / Đã xuất bản / Đã gỡ) — dùng cho trang quản trị */
  status?: { label: string; tone: BlogCardStatusTone }
  pinned?: boolean
  /** Menu thao tác, đặt góc phải trên của ảnh */
  actions?: ReactNode
  /** Chữ ở nút cuối thẻ, mặc định "Đọc tiếp" */
  actionLabel?: string
  /** Không truyền thì ẩn nút cuối thẻ */
  onOpen?: () => void
}

const STATUS_CLASS: Record<BlogCardStatusTone, string> = {
  draft: 'bg-[#F1EDF2] text-[#5E5563]',
  published: 'bg-[#EAF8E8] text-[#2F7A12]',
  archived: 'bg-[#FDE4E7] text-[#B4202C]',
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export default function BlogCard({
  title,
  excerpt,
  category,
  imageSrc,
  date,
  author,
  meta,
  status,
  pinned,
  actions,
  actionLabel = 'Đọc tiếp',
  onOpen,
}: BlogCardProps) {
  const subline = [date, meta].filter(Boolean).join(' · ')

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[20px] border border-[#ECE6DD] bg-white text-[#1F1B18]">
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-[#EDE6DC]">
        {imageSrc ? (
          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl text-[#B9B4BD]">
            <PictureOutlined />
          </div>
        )}
        {category && (
          <span className="absolute left-3.5 top-3.5 max-w-[60%] truncate rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold leading-[1.2]">
            {category}
          </span>
        )}
        {actions && <div className="absolute right-3 top-3 rounded-full bg-white/90 shadow-sm">{actions}</div>}
      </div>

      <div className="flex flex-1 flex-col gap-3 px-[22px] pb-[22px] pt-5">
        {status && (
          <span className={`w-fit rounded-full px-3 text-xs font-semibold leading-6 ${STATUS_CLASS[status.tone]}`}>
            {status.label}
          </span>
        )}

        <h3 className="m-0 overflow-hidden text-[21px] font-bold leading-[1.3] tracking-[-0.01em] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
          {pinned && <PushpinFilled className="mr-1.5 text-[16px] text-[var(--brand-primary,#A8432F)]" aria-label="Bài ghim" />}
          {title}
        </h3>

        {excerpt && (
          <p className="m-0 overflow-hidden text-[15px] leading-6 text-[#4F4842] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
            {excerpt}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#F0EBE3] pt-[17px]">
          <div className="flex min-w-0 items-center gap-2.5">
            {author && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F6E7E1] text-xs font-bold text-[#A8432F]">
                {initials(author)}
              </span>
            )}
            <div className="min-w-0">
              {author && <div className="truncate text-[13px] font-semibold leading-[1.3]">{author}</div>}
              {subline && <div className="truncate text-xs leading-[1.3] text-[#6B635B]">{subline}</div>}
            </div>
          </div>

          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-[var(--brand-primary,#A8432F)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#A8432F)]"
            >
              {actionLabel}
              <ArrowRightOutlined className="text-xs" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
