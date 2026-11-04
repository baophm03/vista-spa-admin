import { Modal, Space, Switch, Typography } from 'antd'
import type { ContentPostRow } from './constants'

interface PublishModalProps {
  target: ContentPostRow | null
  notify: boolean
  onNotifyChange: (value: boolean) => void
  onOk: () => void
  onCancel: () => void
}

export default function PublishModal({ target, notify, onNotifyChange, onOk, onCancel }: PublishModalProps) {
  return (
    <Modal
      title={`Xuất bản: ${target?.title ?? ''}`}
      open={!!target}
      onOk={onOk}
      onCancel={onCancel}
      okText="Xuất bản"
    >
      <Space direction="vertical">
        <Typography.Text type="secondary">Lần đầu xuất bản có thể gửi 1 thông báo quảng bá qua app (không gửi SMS/Email).</Typography.Text>
        <Space><Switch checked={notify} onChange={onNotifyChange} /><Typography.Text>Gửi thông báo broadcast (chỉ lần đầu)</Typography.Text></Space>
      </Space>
    </Modal>
  )
}
