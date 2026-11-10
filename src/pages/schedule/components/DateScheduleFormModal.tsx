import { Form, Input, Modal, Select, DatePicker } from 'antd'
import type { FormInstance } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import type { ShiftTemplate as ShiftTemplateRow, SchedulePageData, ScheduleStaff } from '../types'
import { staffLabel } from '../types'

interface Props {
  open: boolean
  form: FormInstance
  /** Sửa 1 dòng lịch ngày cụ thể (đổi ngày/ca/ghi chú) — null khi tạo mới (bulk) */
  editing: { id: string; work_date: string; shift_template_id: string; note?: string | null } | null
  staff: ScheduleStaff[]
  branches: SchedulePageData['branches']
  branchFilter?: string
  selectedBranch?: string
  staffForSelectedBranch: ScheduleStaff[]
  templates: ShiftTemplateRow[]
  saving: boolean
  onCancel: () => void
  onSubmit: () => void
}

/** Modal đăng ký ca làm theo NGÀY CỤ THỂ (làm thêm ngoài lịch lặp theo thứ). */
export default function DateScheduleFormModal({ open, form, editing, staff, branches, branchFilter, selectedBranch, staffForSelectedBranch, templates, saving, onCancel, onSubmit }: Props) {
  return (
    <Modal
      title={editing ? 'Sửa lịch theo ngày' : 'Đăng ký làm theo ngày'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      destroyOnHidden
    >
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
        <Form.Item name="work_dates" label={editing ? 'Ngày làm' : 'Ngày làm (chọn nhiều ngày)'} rules={[{
          validator: (_, value: Dayjs[] | Dayjs | undefined) => {
            const filled = editing ? !!value : Array.isArray(value) && value.length > 0
            return filled ? Promise.resolve() : Promise.reject(new Error('Chọn ngày làm'))
          },
        }]}>
          {editing ? (
            <DatePicker allowClear placeholder="Chọn ngày" format="DD/MM/YYYY" />
          ) : (
            <DatePicker multiple style={{ width: '100%' }} placeholder="Chọn một hoặc nhiều ngày" format="DD/MM/YYYY" />
          )}
        </Form.Item>
        <Form.Item name="shift_template_id" label={editing ? 'Ca' : 'Ca (chọn nhiều)'} rules={[{
          validator: (_, value: string | string[] | undefined) => {
            const filled = Array.isArray(value) ? value.length > 0 : !!value
            return filled ? Promise.resolve() : Promise.reject(new Error('Chọn ca'))
          },
        }]}>
          <Select
            mode={editing ? undefined : 'multiple'}
            placeholder={editing ? 'Chọn ca' : 'Chọn một hoặc nhiều ca'}
            options={templates.filter((template) => template.is_active !== false && (!template.branch_id || template.branch_id === selectedBranch)).map((template) => ({ value: template.id, label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})` }))}
          />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú (ví dụ: làm thêm tuần sự kiện)">
          <Input.TextArea rows={2} placeholder="Ghi chú cho lịch ngày cụ thể" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export const toFormDates = (value: string | string[] | undefined) => {
  if (!value) return undefined
  return Array.isArray(value) ? value.map((date) => dayjs(date)) : dayjs(value)
}
