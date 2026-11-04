import { Input, Modal } from 'antd'

export default function DayOffRejectModal({ open, reason, onReasonChange, onCancel, onSubmit }: {
  open: boolean
  reason: string
  onReasonChange: (v: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal title="Từ chối ngày nghỉ" open={open} onCancel={onCancel} onOk={onSubmit} okText="Từ chối" cancelText="Hủy">
      <Input.TextArea autoFocus rows={3} maxLength={1000} value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Nhập lý do từ chối" />
    </Modal>
  )
}
