import { Form, Input, Modal, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { Branch } from '@/api/models/branch'

interface Values { name: string; address?: string; phone?: string }
interface Props {
  open: boolean
  editing: Branch | null
  nextCode?: string
  form: FormInstance<Values>
  saving: boolean
  onCancel: () => void
  onSubmit: () => void
}

export default function BranchModal({ open, editing, nextCode, form, saving, onCancel, onSubmit }: Props) {
  return (
    <Modal title={editing ? 'Sửa thông tin cơ sở' : 'Thêm cơ sở'} open={open} onCancel={onCancel}
      onOk={onSubmit} okText="Lưu" cancelText="Hủy" confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="Mã cơ sở" extra={editing ? 'Mã do hệ thống tự sinh, không thể chỉnh sửa.' : 'Mã hiển thị là dự kiến.'}>
          <Typography.Text code>{editing?.code ?? nextCode ?? 'Tự sinh khi lưu'}</Typography.Text>
        </Form.Item>
        <Form.Item name="name" label="Tên cơ sở" rules={[{ required: true, whitespace: true, message: 'Nhập tên cơ sở' }]}>
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ"><Input.TextArea rows={3} maxLength={500} /></Form.Item>
        <Form.Item name="phone" label="Số điện thoại"><Input maxLength={20} inputMode="tel" /></Form.Item>
      </Form>
    </Modal>
  )
}
