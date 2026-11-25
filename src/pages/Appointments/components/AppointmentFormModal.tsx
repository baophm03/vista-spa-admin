import { Col, DatePicker, Form, Input, Modal, Row, Select, Space, Switch, Typography } from 'antd'
import { displayName } from '@/utils/displayName'
import type { FormInstance } from 'antd'
import type { Dayjs } from 'dayjs'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { Appointment } from '@/api/models/appointment'
import type { ProfileRow } from './constants'
import type { Branch } from '@/api/models'

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
  slotsLoading: boolean
  profilesLoading: boolean
  onCustomerSearch: (value: string) => void
  onSelectProfile: (profile: ProfileRow | null) => void
  onQuickCustomer: () => void
  profileOptions: ProfileRow[]
  /** Chế độ "chọn KTV trước": toàn bộ KTV (không lọc theo slot) */
  allStaffOptions: StaffOption[]
  timeOptions: { value: string; label: string }[]
  selectedDate: string
  disablePastDate: (date: Dayjs) => boolean
  branches: Branch[]
  appointmentCustomFields: CustomFieldDefWithOptions[]
  pickStaffFirst: boolean
  onPickStaffFirstChange: (v: boolean) => void
  onCancel: () => void
  onSubmit: () => void
}

export default function AppointmentFormModal({
  open, editing, form, isSaving, slotsLoading, profilesLoading,
  onCustomerSearch, onSelectProfile, profileOptions, allStaffOptions, timeOptions,
  selectedDate, disablePastDate, branches, appointmentCustomFields, pickStaffFirst, onPickStaffFirstChange,
  onCancel, onSubmit,
}: AppointmentFormModalProps) {

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
        <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn cơ sở"
            notFoundContent="Chưa có cơ sở"
            options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
            onChange={() => form.setFieldValue('start_time', undefined)}
          />
        </Form.Item>
        <Form.Item
          name="user_id"
          label={(<Space size={4}><span>Khách hàng</span></Space>)}
          rules={[{ required: true, message: 'Chọn khách' }]}
        >
          <Select showSearch filterOption={false} onSearch={onCustomerSearch} onChange={(id) => onSelectProfile(profileOptions.find((profile) => profile.id === id) ?? null)} loading={profilesLoading} placeholder="Chọn khách hàng" options={profileOptions.map((p) => ({ value: p.id, label: `${displayName(p)} — ${p.phone}` }))} notFoundContent={profilesLoading ? 'Đang tìm khách hàng…' : 'Không tìm thấy khách'} />
        </Form.Item>
        <div className="flex items-center justify-between mb-3">
          <Typography.Text strong style={{ fontSize: 13 }}>Chọn KTV</Typography.Text>
          <Switch checked={pickStaffFirst} onChange={onPickStaffFirstChange} />
        </div>
        {pickStaffFirst && (
          <Form.Item
            name="staff_id"
            label="KTV phụ trách"
            rules={[{ required: true, message: 'Chọn KTV' }]}
          >
            <Select allowClear showSearch optionFilterProp="label" loading={slotsLoading} placeholder="Chọn KTV" options={allStaffOptions.map((staff) => ({ value: staff.id, label: staff.label }))} onChange={() => form.setFieldValue('start_time', undefined)} />
          </Form.Item>
        )}
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="appt_date" label="Ngày hẹn" rules={[{ required: true, message: 'Chọn ngày hẹn' }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabledDate={disablePastDate} onChange={() => form.setFieldValue('start_time', undefined)} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="start_time" label="Giờ hẹn" rules={[{ required: true, message: 'Chọn giờ hẹn' }]}>
              <Select loading={slotsLoading} disabled={!selectedDate || !timeOptions.length} options={timeOptions} placeholder={!selectedDate ? 'Chọn ngày hẹn trước' : slotsLoading ? 'Đang tải giờ hẹn…' : timeOptions.length ? 'Chọn giờ trống' : 'Không còn giờ hẹn phù hợp'} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        <CustomFieldFormItems definitions={appointmentCustomFields} />
      </Form>
    </Modal>
  )
}
