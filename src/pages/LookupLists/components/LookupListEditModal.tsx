import { Form, type FormInstance, Input, Modal, Switch, Typography } from 'antd'
import type { LookupList } from '@/api/models/lookupList'

interface LookupListEditModalProps {
  editingList: LookupList | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance<{ name: string; is_active: boolean }>
}

export default function LookupListEditModal({
  editingList,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
}: LookupListEditModalProps) {
  return (
    <Modal
      title="Sửa danh mục"
      open={!!editingList}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText="Lưu thay đổi"
      cancelText="Hủy"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item
          name="name"
          label="Tên danh mục"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên danh mục' }, { max: 100 }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Typography.Text type="secondary">
          Mã danh mục không đổi. Tắt danh mục sẽ ngừng cho phép dùng danh mục này ở các lựa chọn mới.
        </Typography.Text>
      </Form>
    </Modal>
  )
}
