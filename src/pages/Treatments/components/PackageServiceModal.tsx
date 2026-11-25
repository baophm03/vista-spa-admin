import { Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { Branch } from '@/api/models/branch'

export type PackageServiceFormValues = { title: string; branch_id?: string | null; description?: string | null }

interface PackageServiceModalProps {
  form: FormInstance<PackageServiceFormValues>
  open: boolean
  editing: boolean
  saving: boolean
  branches: Branch[]
  onCancel: () => void
  onOk: () => void
}

export default function PackageServiceModal({ form, open, editing, saving, branches, onCancel, onOk }: PackageServiceModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa gói dịch vụ' : 'Thêm gói dịch vụ'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      destroyOnHidden
      width={560}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="title" label="Tên dịch vụ" rules={[{ required: true, whitespace: true, message: 'Nhập tên dịch vụ' }]}>
          <Input maxLength={255} placeholder="VD: Trị mụn chuyên sâu" />
        </Form.Item>
        <Form.Item name="branch_id" label="Cơ sở">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả cơ sở"
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} maxLength={5000} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
