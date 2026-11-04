import type { ReactNode } from 'react'

/** Hàng công cụ chuẩn đặt trong tab/người dùng nội bộ: 1 nhóm item căn phải,
 *  mobile (<768px) nút có icon tự ẩn chữ chỉ còn icon — cùng quy ước với PageTitle toolbar. */
export default function ToolbarRow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-3 flex flex-wrap items-center justify-end gap-2 [&_.ant-space]:max-w-full! [&_.ant-space]:flex-wrap! max-md:[&_.ant-btn>span:not(.ant-btn-icon):not(.anticon):not(:only-child)]:hidden! ${className}`}>
      {children}
    </div>
  )
}
