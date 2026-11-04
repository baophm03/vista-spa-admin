import { DatePicker, Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { ShiftTemplate, ScheduleStaff } from '../types'
import { staffLabel } from '../types'

export default function DayOffFormModal({ open, form, staff, scheduledTemplates, isTechnician, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  staff: ScheduleStaff[]
  scheduledTemplates: ShiftTemplate[]
  isTechnician: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal title="Đăng ký ngày nghỉ" open={open} onCancel={onCancel} onOk={onSubmit} okText="Gửi đăng ký" cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(changed) => {
        if (changed.staff_id !== undefined || changed.off_date !== undefined) form.setFieldValue('shift_template_id', undefined)
      }}>
        <Form.Item name="staff_id" label="KTV" rules={[{ required: true, message: 'Chọn KTV' }]}>
          <Select disabled={isTechnician} showSearch optionFilterProp="label" options={staff.map((person) => ({ value: person.id, label: staffLabel(person) }))} />
        </Form.Item>
        <Form.Item name="off_date" label="Ngày nghỉ" rules={[{ required: true, message: 'Chọn ngày nghỉ' }]}><DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} /></Form.Item>
        <Form.Item name="shift_template_id" label="Ca nghỉ (không chọn nghĩa là nghỉ cả ngày)">
          <Select allowClear placeholder="Cả ngày" options={scheduledTemplates.map((template) => ({ value: template.id, label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})` }))} />
        </Form.Item>
        <Form.Item name="reason" label="Lý do"><Input.TextArea maxLength={1000} rows={3} /></Form.Item>
      </Form>
    </Modal>
  )
}
