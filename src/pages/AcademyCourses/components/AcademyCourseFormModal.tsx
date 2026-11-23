import { DatePicker, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import ServiceImageField from '@/components/ServiceImageField'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { AcademyCourse } from '@/api/models/academyCourse'
import type { Branch } from '@/api/models/branch'
import { CATEGORY_OPTIONS, LEVEL_OPTIONS, type CourseFormValues } from './constants'

export default function AcademyCourseFormModal({ open, form, editing, branches, courseFields, saving, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance<CourseFormValues>
  editing: AcademyCourse | null
  branches: Branch[]
  courseFields: CustomFieldDefWithOptions[]
  saving?: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal
      title={editing ? 'Sửa khóa học' : 'Thêm khóa học'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      width={720}
      className="academy-course-form-modal"
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        labelCol={{ span: 24 }}
        wrapperCol={{ span: 24 }}
        className="academy-course-form"
      >
        <Form.Item name="code" label="Mã khóa học" rules={[{ required: true, whitespace: true, message: 'Nhập mã khóa học' }]}>
          <Input disabled={!!editing} maxLength={50} />
        </Form.Item>
        <Form.Item name="name" label="Tên khóa học" rules={[{ required: true, whitespace: true, message: 'Nhập tên khóa học' }]}>
          <Input maxLength={255} />
        </Form.Item>
        <div className="academy-course-select-grid">
          <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: 'Chọn danh mục' }]}>
            <Select options={CATEGORY_OPTIONS} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="level" label="Trình độ" rules={[{ required: true }]}>
            <Select options={LEVEL_OPTIONS} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="branch_id" label="Cơ sở" className="academy-course-branch-field">
            <Select disabled={!!editing} allowClear options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} style={{ width: '100%' }} />
          </Form.Item>
        </div>
        <Form.Item name="cover_file_id" label="Ảnh bìa">
          <ServiceImageField />
        </Form.Item>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={3} /></Form.Item>
        <div className="academy-course-pricing-grid">
          <Form.Item name="tuition" label="Học phí" rules={[{ required: true, type: 'number', min: 0 }]} className="academy-course-tuition-field">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="duration_hours" label="Thời lượng (giờ)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="max_students" label="Số học viên tối đa"><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        </div>
        <div className="academy-course-dates-grid">
          <Form.Item name="start_date" label="Ngày bắt đầu"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end_date" label="Ngày kết thúc"><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        </div>
        {editing && <Form.Item name="is_active" label="Trạng thái"><Select options={[{ value: true, label: 'Đang mở' }, { value: false, label: 'Đã ẩn' }]} /></Form.Item>}
        <CustomFieldFormItems definitions={courseFields} />
      </Form>
    </Modal>
  )
}
