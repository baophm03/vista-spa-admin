import { Modal } from 'antd'
import type { ReactNode } from 'react'

interface Props { title: string; open: boolean; onCancel: () => void; onSubmit?: () => void; children: ReactNode; footer?: ReactNode; width?: number }
export default function HealthRecordModal({ title, open, onCancel, onSubmit, children, footer, width }: Props) {
  return <Modal title={title} open={open} onCancel={onCancel} onOk={onSubmit} footer={footer} width={width}>{children}</Modal>
}
