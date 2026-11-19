import { Alert, Form, Input, Modal, Select, DatePicker } from 'antd'
import type { FormInstance } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import type { ShiftTemplate as ShiftTemplateRow, SchedulePageData, ScheduleStaff } from '../types'
import { staffLabel } from '../types'
import { hasShiftStarted, isPastScheduleDate } from '../registrationTime'

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
  /** KTV tự đăng ký: khóa KTV + cơ sở theo hồ sơ và nhắc rule tuần */
  lockStaffAndBranch?: boolean
  saving: boolean
  onCancel: () => void
  onSubmit: () => void
}

/** Modal đăng ký ca làm theo NGÀY CỤ THỂ (làm thêm ngoài lịch lặp theo thứ). */
export default function DateScheduleFormModal({ open, form, editing, staff, branches, branchFilter, selectedBranch, staffForSelectedBranch, templates, lockStaffAndBranch, saving, onCancel, onSubmit }: Props) {
  const nextMonday = dayjs().subtract((dayjs().day() + 6) % 7, 'day').add(1, 'week')
  const workDates = Form.useWatch('work_dates', form) as Dayjs[] | Dayjs | undefined
  const dates = Array.isArray(workDates) ? workDates : workDates ? [workDates] : []
  const unavailable = (template: ShiftTemplateRow, selectedDates: Dayjs[]) =>
    !editing && selectedDates.some((date) => hasShiftStarted(date.format('YYYY-MM-DD'), template.start_time))
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
      {lockStaffAndBranch && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Nhân viên chỉ được tự đăng ký ca cho tuần kế tiếp"
          description={`Cần đăng ký trước 00h thứ 2 đầu tuần kế tiếp (tuần kế tiếp: ${nextMonday.format('DD/MM')} – ${nextMonday.add(6, 'day').format('DD/MM')}). Muốn thay đổi ca tuần hiện tại: dùng tab Xin nghỉ hoặc liên hệ Admin.`}
        />
      )}
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} onValuesChange={(changed) => {
        if (changed.branch_id !== undefined) {
          const currentStaff = staff.find((person) => person.id === form.getFieldValue('staff_id'))
          form.setFieldsValue({
            staff_id: currentStaff?.branch_id === changed.branch_id ? currentStaff?.id : undefined,
            shift_template_id: undefined,
          })
        }
        if (changed.staff_id !== undefined) form.setFieldValue('shift_template_id', undefined)
      }}>
        <Form.Item
          name="staff_id"
          label="Nhân viên"
          rules={[{ required: true, message: 'Chọn nhân viên' }, {
            validator: async (_, staffId: string | undefined) => {
              if (!staffId) return
              const person = staff.find((candidate) => candidate.id === staffId)
              if (!selectedBranch || !person?.branch_id || person.branch_id !== selectedBranch) {
                throw new Error('Nhân viên phải được gán vào đúng cơ sở đã chọn')
              }
            },
          }]}
        >
          <Select
            disabled={lockStaffAndBranch || !selectedBranch}
            showSearch
            optionFilterProp="label"
            notFoundContent="Không có nhân viên đã được gán vào cơ sở này"
            options={staffForSelectedBranch.map((person) => ({ value: person.id, label: staffLabel(person) }))}
          />
        </Form.Item>
        <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]} hidden={lockStaffAndBranch}>
          <Select disabled={lockStaffAndBranch} options={(branchFilter ? branches.filter((branch) => branch.id === branchFilter) : branches).map((branch) => ({ value: branch.id, label: branch.name }))} />
        </Form.Item>
        <Form.Item name="work_dates" label={editing ? 'Ngày làm' : 'Ngày làm (chọn nhiều ngày)'} rules={[{
          validator: (_, value: Dayjs[] | Dayjs | undefined) => {
            const filled = editing ? !!value : Array.isArray(value) && value.length > 0
            if (!editing && Array.isArray(value) && value.some((date) => isPastScheduleDate(date.format('YYYY-MM-DD')))) {
              return Promise.reject(new Error('Không thể đăng ký ngày đã qua'))
            }
            return filled ? Promise.resolve() : Promise.reject(new Error('Chọn ngày làm'))
          },
        }]}>
          {editing ? (
            <DatePicker allowClear placeholder="Chọn ngày" format="DD/MM/YYYY" />
          ) : (
            <DatePicker multiple disabledDate={(date) => isPastScheduleDate(date.format('YYYY-MM-DD'))} style={{ width: '100%' }} placeholder="Chọn một hoặc nhiều ngày" format="DD/MM/YYYY" />
          )}
        </Form.Item>
        <Form.Item name="shift_template_id" dependencies={['work_dates']} label={editing ? 'Ca' : 'Ca (chọn nhiều)'} rules={[{
          validator: (_, value: string | string[] | undefined) => {
            const filled = Array.isArray(value) ? value.length > 0 : !!value
            const selected = form.getFieldValue('work_dates')
            const ids = Array.isArray(value) ? value : [value]
            if (Array.isArray(selected) && templates.some((template) => ids.includes(template.id) && unavailable(template, selected))) {
              return Promise.reject(new Error('Có ca đã bắt đầu vào một trong các ngày đã chọn'))
            }
            return filled ? Promise.resolve() : Promise.reject(new Error('Chọn ca'))
          },
        }]}>
          <Select
            mode={editing ? undefined : 'multiple'}
            placeholder={editing ? 'Chọn ca' : 'Chọn một hoặc nhiều ca'}
            options={templates.filter((template) => template.is_active !== false && (!template.branch_id || template.branch_id === selectedBranch)).map((template) => {
              const disabled = unavailable(template, dates)
              return { value: template.id, disabled, label: `${template.name} (${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)})${disabled ? ' · Đã qua giờ' : ''}` }
            })}
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
