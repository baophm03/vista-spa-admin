import { Typography } from 'antd'
import type { ReactNode } from 'react'

/**
 * Tiêu đề trang + thanh công cụ chuẩn nằm DƯỚI tiêu đề.
 * - left:  các nút/khối điều khiển chung (tìm kiếm, lọc, tải lại…)
 * - right: hành động chính (thường là nút tạo mới)
 * Tất cả item cùng nằm 1 nhóm, căn phải (justify-end); mobile (<768px) nút có icon tự ẩn chữ chỉ còn icon.
 */
export default function PageTitle({ children, subtitle, left, right }: { children: ReactNode; subtitle?: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex min-w-0 flex-col gap-3">
      <div className="min-w-0">
        <Typography.Title level={4} className="m-0! min-w-0 break-words text-xl! sm:text-2xl!">
          {children}
        </Typography.Title>
        {subtitle && (
          <Typography.Text type="secondary" className="mt-1 block text-sm!">
            {subtitle}
          </Typography.Text>
        )}
      </div>
      {(left || right) && (
        <div className="flex flex-wrap items-center justify-end gap-2 [&_.ant-space]:max-w-full! [&_.ant-space]:flex-wrap! max-md:[&_.ant-btn>span:not(.ant-btn-icon):not(.anticon):not(:only-child)]:hidden!">
          {left}
          {right}
        </div>
      )}
    </div>
  )
}
