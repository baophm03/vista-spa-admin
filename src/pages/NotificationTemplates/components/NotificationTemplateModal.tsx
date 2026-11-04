import { Modal } from 'antd'
import type { ReactNode } from 'react'

interface Props { open: boolean; saving?: boolean; onCancel: () => void; onSave: () => void; children: ReactNode }
export default function NotificationTemplateModal({ open, saving, onCancel, onSave, children }: Props) {
  return <Modal title="Chỉnh sửa mẫu thông báo" open={open} onCancel={onCancel} onOk={onSave} confirmLoading={saving} okText="Lưu mẫu" cancelText="Hủy" destroyOnHidden width={720}>{children}</Modal>
}
