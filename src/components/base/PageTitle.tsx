import { Typography } from 'antd'
import type { ReactNode } from 'react'

export default function PageTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-5 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Typography.Title level={4} className="m-0! min-w-0 break-words text-xl! sm:text-2xl!">
        {children}
      </Typography.Title>
      {extra && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end [&_.ant-space]:max-w-full! [&_.ant-space]:flex-wrap! max-sm:[&_.ant-space]:w-full!">
          {extra}
        </div>
      )}
    </div>
  )
}
