import { Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { AcademyCourse } from '@/api/models/academyCourse'

export default function RegistrationCreateModal({ open, form, courses, creating, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  courses: AcademyCourse[]
  creating?: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal
      title="Thêm đăng ký học viên"
      open={open}
      onOk={onSubmit}
      onCancel={onCancel}
      confirmLoading={creating}
      okText="Thêm đăng ký"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical">
        <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên học viên' }]}>
          <Input placeholder="Tên học viên" />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
          <Input placeholder="0901234567" />
        </Form.Item>
        <Form.Item name="email" label="Email">
          <Input type="email" placeholder="email@example.com" />
        </Form.Item>
        <Form.Item name="course_id" label="Khóa học" rules={[{ required: true, message: 'Chọn khóa học' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn khóa học"
            options={courses.filter((c) => c.is_active !== false).map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} placeholder="Nguồn liên hệ, nhu cầu, thời gian thuận tiện gọi…" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
