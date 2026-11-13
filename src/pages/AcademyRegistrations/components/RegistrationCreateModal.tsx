import dayjs from 'dayjs'
import { Alert, Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { AcademyCourse } from '@/api/models/academyCourse'
import type { VoucherCategoryRow } from '@/api/custom/voucherCategories'

export default function RegistrationCreateModal({ open, form, courses, vouchers, creating, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  courses: AcademyCourse[]
  vouchers: VoucherCategoryRow[]
  creating?: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  const selectedCourseId = Form.useWatch('course_id', form)
  const selectedVoucherId = Form.useWatch('academy_course_voucher_id', form)
  const today = dayjs().format('YYYY-MM-DD')
  const availableVouchers = vouchers.filter((voucher) =>
    voucher.is_active &&
    (!voucher.academy_course_id || voucher.academy_course_id === selectedCourseId) &&
    (!voucher.start_date || voucher.start_date.slice(0, 10) <= today) &&
    (!voucher.end_date || voucher.end_date.slice(0, 10) >= today) &&
    (voucher.quantity_total == null || Number(voucher.quantity_given) < Number(voucher.quantity_total)),
  )
  const selectedVoucher = availableVouchers.find((voucher) => voucher.id === selectedVoucherId)
  const voucherSummary = (voucher: VoucherCategoryRow) => {
    if (voucher.discount_type === 'AMOUNT') return `Giảm ${Number(voucher.discount_value ?? 0).toLocaleString('vi-VN')} đ`
    if (voucher.discount_type === 'PERCENT') return `Giảm ${Number(voucher.discount_value ?? 0).toLocaleString('vi-VN')}%`
    return 'Tặng quà / quyền lợi'
  }

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
            onChange={() => form.setFieldsValue({ academy_course_voucher_id: undefined })}
          />
        </Form.Item>
        <Form.Item name="academy_course_voucher_id" label="Voucher khóa học">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            disabled={!selectedCourseId}
            placeholder={selectedCourseId ? 'Không dùng voucher' : 'Chọn khóa học trước'}
            options={availableVouchers.map((voucher) => ({ value: voucher.id, label: `${voucher.title} — ${voucherSummary(voucher)}` }))}
          />
        </Form.Item>
        {selectedVoucher && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={voucherSummary(selectedVoucher)}
            description={[
              selectedVoucher.description,
              Number(selectedVoucher.minimum_tuition ?? 0) > 0 ? `Áp dụng khi học phí từ ${Number(selectedVoucher.minimum_tuition).toLocaleString('vi-VN')} đ.` : 'Không yêu cầu mức học phí tối thiểu.',
              `Tối đa ${selectedVoucher.max_uses_per_student ?? 1} lần mỗi học viên. Hệ thống kiểm tra hạng khách, điều kiện học viên cũ và số lượng khi lưu.`,
            ].filter(Boolean).join(' ')}
          />
        )}
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} placeholder="Nguồn liên hệ, nhu cầu, thời gian thuận tiện gọi…" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
