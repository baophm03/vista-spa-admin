import { Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { Branch } from '@/api/models/branch'

export interface QuickCustomerModalProps {
  open: boolean
  form: FormInstance
  branches: Branch[]
  onCancel: () => void
  onOk: () => void
}

export default function QuickCustomerModal({ open, form, branches, onCancel, onOk }: QuickCustomerModalProps) {
  return (
    <Modal
      title="Tạo nhanh khách hàng"
      width="min(640px, calc(100vw - 24px))"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Tạo khách"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input placeholder="Tên khách hàng" />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
          <Input placeholder="0901234567" />
        </Form.Item>
        <Form.Item name="email" label="Email">
          <Input type="email" placeholder="email@example.com" />
        </Form.Item>
        <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
          <Select
            placeholder="Chọn cơ sở"
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
