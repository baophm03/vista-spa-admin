import { Form, type FormInstance, Input, Modal } from 'antd'

interface LookupListCreateModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
}

export default function LookupListCreateModal({
  open,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
}: LookupListCreateModalProps) {
  return (
    <Modal
      title="Tạo danh mục tự tạo"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText="Tạo danh mục"
      cancelText="Hủy"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="key"
          label="Mã danh mục"
          rules={[
            { required: true, message: 'Nhập mã danh mục' },
            { max: 50 },
            { pattern: /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/, message: 'Chỉ dùng chữ, số, dấu chấm, gạch dưới hoặc gạch ngang' },
          ]}
        >
          <Input maxLength={50} placeholder="vd customer.sources" />
        </Form.Item>
        <Form.Item
          name="name"
          label="Tên danh mục"
          rules={[{ required: true, message: 'Nhập tên danh mục' }, { max: 100 }]}
        >
          <Input maxLength={100} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

