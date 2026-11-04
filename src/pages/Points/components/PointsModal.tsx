import { Modal } from 'antd'
import type { ReactNode } from 'react'

interface Props { title: string; open: boolean; loading?: boolean; onCancel: () => void; onSubmit: () => void; children: ReactNode }
export default function PointsModal({ title, open, loading, onCancel, onSubmit, children }: Props) {
  return <Modal title={title} open={open} confirmLoading={loading} onCancel={onCancel} onOk={onSubmit} okText="Lưu" cancelText="Hủy">{children}</Modal>
}
