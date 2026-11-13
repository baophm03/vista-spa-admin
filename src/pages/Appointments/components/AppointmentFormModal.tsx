import { Col, DatePicker, Form, Input, Modal, Row, Select, Space } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { Appointment } from '@/api/models/appointment'
import type { ProfileRow, Slot } from './constants'

export interface StaffOption {
  id: string
  label: string
  branchId?: string
}

export interface AppointmentFormModalProps {
  open: boolean
  editing: Appointment | null
  form: FormInstance
  isSaving: boolean
  slots: Slot[]
  slotsLoading: boolean
  profilesLoading: boolean
  onCustomerSearch: (value: string) => void
  onSelectProfile: (profile: ProfileRow | null) => void
  onQuickCustomer: () => void
  profileOptions: ProfileRow[]
  staffOptions: StaffOption[]
  timeOptions: { value: string; label: string }[]
  selectedDate: string
  appointmentCustomFields: CustomFieldDefWithOptions[]
  onCancel: () => void
  onSubmit: () => void
}

export default function AppointmentFormModal({
  open, editing, form, isSaving, slots, slotsLoading, profilesLoading,
  onCustomerSearch, onSelectProfile, profileOptions, staffOptions, timeOptions,
  selectedDate, appointmentCustomFields, onCancel, onSubmit,
}: AppointmentFormModalProps) {
  const selectedTime = Form.useWatch('start_time', form) as string | undefined
  const timeHasStaff = slots.some((slot) => slot.start_time.slice(0, 5) === selectedTime && slot.staff_ids.length > 0)

  return (
    <Modal
      title={editing ? 'Đổi lịch hẹn' : 'Thêm lịch hẹn'}
      width="min(880px, calc(100vw - 24px))"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={isSaving}
      okText={isSaving ? (editing ? 'Đang cập nhật…' : 'Đang tạo…') : 'Lưu'}
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="customer_profile_id"
          label={(<Space size={4}><span>Khách hàng</span></Space>)}
          rules={[{ required: true, message: 'Chọn khách' }]}
        >
          <Select showSearch filterOption={false} onSearch={onCustomerSearch} onChange={(id) => onSelectProfile(profileOptions.find((profile) => profile.id === id) ?? null)} loading={profilesLoading} placeholder="Chọn khách hàng" options={profileOptions.map((p) => ({ value: p.id, label: `${p.full_name} — ${p.phone}` }))} notFoundContent={profilesLoading ? 'Đang tìm khách hàng…' : 'Không tìm thấy khách'} />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="appt_date" label="Ngày hẹn" rules={[{ required: true, message: 'Chọn ngày hẹn' }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="start_time" label="Giờ hẹn" rules={[{ required: true, message: 'Chọn giờ hẹn' }]}>
              <Select disabled={!selectedDate || !timeOptions.length} options={timeOptions} placeholder={!selectedDate ? 'Chọn ngày hẹn trước' : timeOptions.length ? 'Chọn giờ trong ca làm' : 'Chưa cấu hình ca làm việc'} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="staff_id" label="KTV phụ trách (tùy chọn)">
          <Select allowClear showSearch optionFilterProp="label" disabled={!selectedTime || slotsLoading} placeholder={slotsLoading ? 'Đang tải KTV…' : selectedTime ? 'Chọn KTV đang trống' : 'Chọn ngày và giờ trước'} options={staffOptions.map((staff) => ({ value: staff.id, label: staff.label }))} notFoundContent={timeHasStaff ? 'Không có KTV phù hợp' : 'Khung giờ này chưa có KTV trống'} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        <CustomFieldFormItems definitions={appointmentCustomFields} />
      </Form>
    </Modal>
  )
}
