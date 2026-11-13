import { Alert, Form, Input, Modal, Select, Space, TimePicker } from 'antd'
import type { FormInstance } from 'antd'
import type { ShiftTemplate } from '../types'
import type { SchedulePageData } from '../types'

export const ALL_BRANCHES = '__all_branches__'

export default function ShiftCatalogFormModal({ open, form, editing, branches, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  editing: ShiftTemplate | null
  branches: SchedulePageData['branches']
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal title={editing ? 'Sửa ca làm' : 'Tạo ca làm'} open={open} onCancel={onCancel} onOk={onSubmit} okText="Lưu" cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Tên ca" rules={[{ required: true, whitespace: true, message: 'Nhập tên ca' }]}><Input maxLength={100} placeholder="Ví dụ: Ca sáng" /></Form.Item>
        <Space size={16} style={{ display: 'flex' }}>
          <Form.Item name="start_time" label="Bắt đầu" rules={[{ required: true, message: 'Chọn giờ bắt đầu' }]} style={{ flex: 1 }}><TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end_time" label="Kết thúc" rules={[{ required: true, message: 'Chọn giờ kết thúc' }]} style={{ flex: 1 }}><TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} /></Form.Item>
        </Space>
        {!editing && <Form.Item name="branch_id" label="Cơ sở áp dụng" rules={[{ required: true, message: 'Chọn phạm vi áp dụng' }]}>
          <Select options={[{ value: ALL_BRANCHES, label: 'Mọi cơ sở' }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
        </Form.Item>}
        {editing && <Form.Item name="is_active" label="Trạng thái" rules={[{ required: true }]}><Select options={[{ value: true, label: 'Đang hoạt động' }, { value: false, label: 'Tắt' }]} /></Form.Item>}
        {!editing && <Alert type="info" showIcon message="Giờ mẫu là giá trị khởi tạo; hãy chỉnh theo jam vận hành đã được cơ sở xác nhận." />}
      </Form>
    </Modal>
  )
}
