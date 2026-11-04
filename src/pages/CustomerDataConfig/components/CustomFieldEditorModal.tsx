import { Checkbox, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { CustomFieldDef } from '@/api/models/customFieldDef'
import type { CustomFieldDefEntity } from '@/api/models/customFieldDefEntity'
import type { LookupList } from '@/api/models/lookupList'

export interface CustomFieldFormValues {
  label: string
  key: string
  data_type: string
  option_source?: string
  lookup_list_id?: string
  options_text?: string
  sort_order?: number
  required?: boolean
  visible_to_customer?: boolean
}

interface CustomFieldEditorModalProps {
  entity: CustomFieldDefEntity
  sectionTitle?: string
  editing: CustomFieldDef | null
  form: FormInstance<CustomFieldFormValues>
  lookupLists: LookupList[]
  open: boolean
  saving: boolean
  onClose: () => void
  onSave: () => void
}

export default function CustomFieldEditorModal({
  entity,
  sectionTitle,
  editing,
  form,
  lookupLists,
  open,
  saving,
  onClose,
  onSave,
}: CustomFieldEditorModalProps) {
  return (
    <Modal
      title={editing ? `Sửa trường ${sectionTitle}` : `Thêm trường ${sectionTitle}`}
      open={open}
      onCancel={onClose}
      onOk={() => void onSave()}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="label" label="Tên hiển thị" rules={[{ required: true, message: 'Nhập tên trường' }]}>
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item name="key" label="Key" rules={[{ required: true, message: 'Nhập key' }, { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: 'Key bắt đầu bằng chữ và chỉ gồm chữ, số, gạch dưới' }]}>
          <Input disabled={!!editing} maxLength={100} />
        </Form.Item>
        <Form.Item name="data_type" label="Kiểu dữ liệu" rules={[{ required: true }]}>
          <Select disabled={!!editing} options={[
            { value: 'text', label: 'Văn bản' },
            { value: 'number', label: 'Số' },
            { value: 'date', label: 'Ngày' },
            { value: 'select', label: 'Chọn một' },
            { value: 'multiselect', label: 'Chọn nhiều' },
            { value: 'bool', label: 'Có/Không' },
          ]} />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.data_type !== next.data_type || prev.option_source !== next.option_source}>
          {({ getFieldValue }) => ['select', 'multiselect'].includes(getFieldValue('data_type')) && (
            <>
              <Form.Item name="option_source" label="Nguồn lựa chọn" rules={[{ required: true }]}>
                <Select onChange={(value) => {
                  if (value === 'manual') form.setFieldValue('lookup_list_id', undefined)
                  else form.setFieldValue('options_text', undefined)
                }} options={[
                  { value: 'manual', label: 'Nhập lựa chọn thủ công' },
                  { value: 'lookup', label: 'Dùng danh mục dùng chung' },
                ]} />
              </Form.Item>
              {getFieldValue('option_source') === 'lookup' ? (
                <Form.Item name="lookup_list_id" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn danh mục đang hoạt động"
                    options={lookupLists.map((list) => ({ value: list.id, label: `${list.name} · ${list.key}` }))}
                    notFoundContent="Chưa có danh mục đang hoạt động"
                  />
                </Form.Item>
              ) : (
                <Form.Item name="options_text" label="Các lựa chọn" rules={[{ required: true, message: 'Nhập ít nhất một lựa chọn' }]}>
                  <Input.TextArea rows={4} placeholder={'Mỗi lựa chọn một dòng\nhoặc phân cách bằng dấu phẩy'} />
                </Form.Item>
              )}
            </>
          )}
        </Form.Item>
        <Form.Item name="sort_order" label="Thứ tự hiển thị"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="required" valuePropName="checked"><Checkbox>Bắt buộc nhập</Checkbox></Form.Item>
        {entity === 'CUSTOMER_PROFILE' && <Form.Item name="visible_to_customer" valuePropName="checked"><Checkbox>Hiển thị với khách hàng</Checkbox></Form.Item>}
      </Form>
    </Modal>
  )
}
