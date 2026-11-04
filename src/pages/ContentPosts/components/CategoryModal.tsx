import { Form, Input, InputNumber, Modal, Select, Space, Switch } from 'antd'
import type { FormInstance } from 'antd'
import type { ContentCategory } from '@/api/models/contentCategory'
import { DISPLAY_TYPE_OPTIONS } from './constants'
import type { CategoryFormValues } from './constants'

interface CategoryModalProps {
  open: boolean
  editing: ContentCategory | null
  form: FormInstance<CategoryFormValues>
  saving: boolean
  onCancel: () => void
  onOk: () => void
}

export default function CategoryModal({ open, editing, form, saving, onCancel, onOk }: CategoryModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa chuyên mục' : 'Tạo chuyên mục'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={saving}
      okText="Lưu"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Tên chuyên mục" rules={[{ required: true, message: 'Nhập tên' }]}>
          <Input placeholder="Ví dụ: Góc sức khỏe & làm đẹp" />
        </Form.Item>
        <Form.Item name="slug" label="Slug" rules={[{ required: true, message: 'Nhập slug' }]}>
          <Input placeholder="goc-suc-khoe" />
        </Form.Item>
        <Form.Item name="display_type" label="Kiểu hiển thị trên app" rules={[{ required: true }]}>
          <Select options={DISPLAY_TYPE_OPTIONS} />
        </Form.Item>
        <Space wrap>
          <Form.Item name="sort_order" label="Thứ tự">
            <InputNumber min={0} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="is_active" label="Kích hoạt" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}
