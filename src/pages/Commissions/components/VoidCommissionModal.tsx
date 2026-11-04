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
      title="Hủy bút toán hoa hồng"
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={loading}
      okText="Hủy bút toán"
      okButtonProps={{ danger: true }}
      cancelText="Đóng"
    >
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="Bút toán không bị xóa, chỉ đánh dấu VOID và loại khỏi tổng hợp." />
      <Form form={form} layout="vertical">
        <Form.Item name="void_reason" label="Lý do hủy" rules={[{ required: true, message: 'Nhập lý do hủy' }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
