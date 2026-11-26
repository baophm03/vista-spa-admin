import { Form, Input, InputNumber, Modal } from 'antd'
import type { FormInstance } from 'antd'
import ServiceImageField from '@/components/ServiceImageField'
import type { ServiceCategoryRow } from './serviceTypes'

interface ServiceCategoryModalProps {
  open: boolean
  editing: ServiceCategoryRow | null
  form: FormInstance
  saving: boolean
  onCancel: () => void
  onOk: () => void
}

/** Danh mục dịch vụ chỉ 1 cấp — không có danh mục cha. */
export default function ServiceCategoryModal({
  open,
  editing,
  form,
  saving,
  onCancel,
  onOk,
}: ServiceCategoryModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa danh mục dịch vụ' : 'Thêm danh mục dịch vụ'}
      className="service-category-modal"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Nhập tên danh mục' }]}>
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="sort_order" label="Thứ tự hiển thị" rules={[{ type: 'number', min: 0 }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="image_file_id" label="Ảnh danh mục">
          <ServiceImageField />
        </Form.Item>
      </Form>
    </Modal>
  )
}
