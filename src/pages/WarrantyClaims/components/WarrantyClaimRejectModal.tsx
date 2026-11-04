import { Form, Input, Modal } from 'antd'
import type { FormInstance } from 'antd'
import type { ClaimRow } from './constants'

interface WarrantyClaimRejectModalProps {
  form: FormInstance
  target: ClaimRow | null
  submitting: boolean
  onCancel: () => void
  onOk: () => void
}

export default function WarrantyClaimRejectModal({ form, target, submitting, onCancel, onOk }: WarrantyClaimRejectModalProps) {
  return (
    <Modal
      title="Từ chối bảo hành"
      open={!!target}
      onCancel={onCancel}
      onOk={onOk}
      okText="Từ chối"
      okButtonProps={{ danger: true }}
      cancelText="Đóng"
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="reason" label="Lý do từ chối" rules={[{ required: true, message: 'Bắt buộc nhập lý do từ chối' }]}>
          <Input.TextArea rows={3} maxLength={1000} placeholder="Nhập lý do từ chối cụ thể" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
