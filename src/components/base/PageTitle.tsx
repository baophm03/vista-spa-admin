import { Typography } from 'antd'
import type { ReactNode } from 'react'

export default function PageTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {children}
      </Typography.Title>
      {extra}
    </div>
  )
}
