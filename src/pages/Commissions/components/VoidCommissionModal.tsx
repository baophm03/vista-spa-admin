import { Alert, Form, Input, Modal } from 'antd'
import type { FormInstance } from 'antd'

type Props = {
  open: boolean
  form: FormInstance
  loading: boolean
  onClose: () => void
  onSubmit: () => void
}

export default function VoidCommissionModal({ open, form, loading, onClose, onSubmit }: Props) {
  return (
    <Modal
      title="Hủy khoản hoa hồng"
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={loading}
      okText="Xác nhận hủy"
      okButtonProps={{ danger: true }}
      cancelText="Quay lại"
    >
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Khoản này vẫn được lưu trong lịch sử nhưng sẽ không còn được tính vào tổng hoa hồng." />
      <Form form={form} layout="vertical">
        <Form.Item name="void_reason" label="Lý do hủy" rules={[{ required: true, whitespace: true, message: 'Nhập lý do hủy' }]}>
          <Input.TextArea rows={2} maxLength={255} showCount placeholder="VD: Nhập nhầm số tiền, tạo trùng khoản hoa hồng…" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
