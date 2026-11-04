import { Form, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { ShiftTemplate as ShiftTemplateRow, SchedulePageData, ScheduleStaff } from '../types'
import { staffLabel } from '../types'

export const WEEKDAYS = [
  { value: 1, label: 'T2' }, { value: 2, label: 'T3' }, { value: 3, label: 'T4' },
  { value: 4, label: 'T5' }, { value: 5, label: 'T6' }, { value: 6, label: 'T7' }, { value: 7, label: 'CN' },
]

/** Rule bắt buộc cho field có thể là mảng (chọn nhiều) hoặc số đơn (sửa 1 dòng). */
export const requiredValue = (messageText: string) => ({
  validator: (_: unknown, value: unknown) => {
    const filled = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ''
    return filled ? Promise.resolve() : Promise.reject(new Error(messageText))
  },
})

interface StaffScheduleWithStaff {
  id: string
  staff_id: string
  shift_template_id: string
  weekday: number
}

export default function WeeklyScheduleFormModal({ open, form, editing, staff, branches, branchFilter, selectedBranch, staffForSelectedBranch, templates, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  editing: StaffScheduleWithStaff | null
  staff: ScheduleStaff[]
  branches: SchedulePageData['branches']
  branchFilter?: string
  selectedBranch?: string
  staffForSelectedBranch: ScheduleStaff[]
  templates: ShiftTemplateRow[]
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal title={editing ? 'Sửa lịch tuần' : 'Xếp ca làm việc'} open={open} onCancel={onCancel} onOk={onSubmit} okText="Lưu" cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(changed) => {
        if (changed.branch_id !== undefined) {
          const currentStaff = staff.find((person) => person.id === form.getFieldValue('staff_id'))
          if (currentStaff?.branch_id !== changed.branch_id) form.setFieldsValue({ staff_id: undefined, shift_template_id: undefined })
        }
        if (changed.staff_id !== undefined) form.setFieldValue('shift_template_id', undefined)
      }}>
        <Form.Item
          name="staff_id"
          label="KTV"
          rules={[{ required: true, message: 'Chọn KTV' }, {
            validator: async (_, staffId: string | undefined) => {
              if (!staffId) return
              const person = staff.find((candidate) => candidate.id === staffId)
              if (!selectedBranch || !person?.branch_id || person.branch_id !== selectedBranch) {
                throw new Error('KTV phải được gán vào đúng cơ sở đã chọn')
              }
            },
          }]}
        >
          <Select
            disabled={!selectedBranch}
            showSearch
            optionFilterProp="label"
            notFoundContent="Không có KTV đã được gán vào cơ sở này"
            options={staffForSelectedBranch.map((person) => ({ value: person.id, label: staffLabel(person) }))}
          />
        </Form.Item>
        <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
          <Select options={(branchFilter ? branches.filter((branch) => branch.id === branchFilter) : branches).map((branch) => ({ value: branch.id, label: branch.name }))} />
        </Form.Item>
        <Form.Item name="weekday" label={editing ? 'Thứ trong tuần' : 'Thứ trong tuần (chọn nhiều)'} rules={[requiredValue('Chọn thứ')]}>
          <Select mode={editing ? undefined : 'multiple'} placeholder={editing ? 'Chọn thứ' : 'Chọn một hoặc nhiều thứ'} options={WEEKDAYS} />
        </Form.Item>
        <Form.Item name="shift_template_id" label={editing ? 'Ca' : 'Ca (chọn nhiều)'} rules={[requiredValue('Chọn ca')]}>
          <Select
            mode={editing ? undefined : 'multiple'}
            placeholder={editing ? 'Chọn ca' : 'Chọn một hoặc nhiều ca'}
            options={templates.filter((template) => template.is_active !== false && (!template.branch_id || template.branch_id === selectedBranch)).map((template) => ({ value: template.id, label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})` }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
