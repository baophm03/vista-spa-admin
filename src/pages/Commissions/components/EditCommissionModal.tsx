import { Alert, Form, Input, InputNumber, Modal, Space } from 'antd'
import type { FormInstance } from 'antd'

type Props = {
  open: boolean
  targetMode?: string
  form: FormInstance
  loading: boolean
  onClose: () => void
  onSubmit: () => void
}

export default function EditCommissionModal({ open, targetMode, form, loading, onClose, onSubmit }: Props) {
  return (
    <Modal
      title="Sửa bút toán hoa hồng"
      open={open}
      onCancel={onClose}
      onOk={onSubmit}
      confirmLoading={loading}
      okText="Lưu"
      cancelText="Hủy"
    >
      {targetMode === 'AUTO' && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="Bút toán tự động sẽ chuyển thành NHẬP TAY vĩnh viễn sau khi sửa (không còn tính lại tự động)."
        />
      )}
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="amount" label="Số tiền (₫)" style={{ flex: 1 }} rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="percent" label="% hoa hồng" style={{ flex: 1 }}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="reason" label="Lý do sửa" rules={[{ required: true, message: 'Nhập lý do' }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
