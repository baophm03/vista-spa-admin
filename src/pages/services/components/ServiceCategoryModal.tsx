import { Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import ServiceImageField from '@/components/ServiceImageField'
import type { ServiceCategory } from '@/api/models/serviceCategory'

/** BE include kèm `parent` (id, name) khi list. */
type ServiceCategoryRow = ServiceCategory & { parent?: { id?: string; name?: string } }

function flattenCategories(
  categories: ServiceCategoryRow[],
  parentId: string | null = null,
  depth = 0,
  includeId?: string,
): { value: string; label: string }[] {
  return categories
    .filter((category) => (category.parent_id ?? null) === parentId && (category.is_active !== false || category.id === includeId))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'vi'))
    .flatMap((category) => [
      { value: category.id, label: `${'　'.repeat(depth)}${category.name}${category.is_active === false ? ' (đã ẩn)' : ''}` },
      ...flattenCategories(categories, category.id, depth + 1, includeId),
    ])
}

interface ServiceCategoryModalProps {
  open: boolean
  editing: ServiceCategoryRow | null
  form: FormInstance
  rows: ServiceCategoryRow[]
  saving: boolean
  onCancel: () => void
  onOk: () => void
}

export default function ServiceCategoryModal({
  open,
  editing,
  form,
  rows,
  saving,
  onCancel,
  onOk,
}: ServiceCategoryModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa danh mục dịch vụ' : 'Thêm danh mục dịch vụ'}
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
        <Form.Item name="parent_id" label="Danh mục cha">
          <Select
            allowClear
            placeholder="Danh mục gốc"
            options={flattenCategories(rows, null, 0, editing?.parent_id ?? undefined).filter((option) => option.value !== editing?.id)}
          />
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
