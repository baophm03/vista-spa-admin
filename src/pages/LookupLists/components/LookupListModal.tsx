import { Modal } from 'antd'
import type { ReactNode } from 'react'

interface Props { title: string; open: boolean; onCancel: () => void; onSubmit?: () => void; children: ReactNode; footer?: ReactNode; loading?: boolean }
export default function LookupListModal({ title, open, onCancel, onSubmit, children, footer, loading }: Props) {
  return <Modal title={title} open={open} onCancel={onCancel} onOk={onSubmit} confirmLoading={loading} footer={footer} destroyOnHidden>{children}</Modal>
}
