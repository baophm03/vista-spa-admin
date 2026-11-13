import { Can } from '@casl/react'
import { Button, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Typography } from 'antd'

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
  /** Danh sách KTV để gán/đổi người phụ trách (luồng xin nghỉ của KTV cũ) */
  staffOptions: StaffOption[]
  selectedCustomerId?: string
  selectedDate: string
  appointmentCustomFields: CustomFieldDefWithOptions[]
  onCancel: () => void
  onSubmit: () => void
}

export default function AppointmentFormModal({
  open,
  editing,
  form,
  isSaving,
  slots,
  slotsLoading,
  profilesLoading,
  onCustomerSearch,
  onSelectProfile,
  onQuickCustomer,
  profileOptions,
  staffOptions,
  selectedCustomerId,
  selectedDate,
  appointmentCustomFields,
  onCancel,
  onSubmit,
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
        <Form.Item
          name="customer_profile_id"
          label={(
            <Space size={4}>
              <span>Khách hàng</span>
              <Can I="CREATE" a="CUSTOMER">
                <Button type="link" size="small" onClick={onQuickCustomer}>+ Tạo khách mới</Button>
              </Can>
            </Space>
          )}
          rules={[{ required: true, message: 'Chọn khách' }]}
          extra="Lịch hẹn chỉ là hẹn ngày gặp tư vấn — gói liệu trình sẽ được tạo/bán sau buổi tư vấn."
        >
          <Select
            showSearch
            filterOption={false}
            onSearch={onCustomerSearch}
            onChange={(id) => {
              onSelectProfile(profileOptions.find((profile) => profile.id === id) ?? null)
            }}
            loading={profilesLoading}
            placeholder="Chọn khách hàng"
            options={profileOptions.map((p) => ({
              value: p.id,
              label: `${p.full_name} — ${p.phone}`,
            }))}
            notFoundContent={profilesLoading ? 'Đang tìm khách hàng…' : 'Không tìm thấy khách'}
          />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="appt_date" label="Ngày hẹn" rules={[{ required: true, message: 'Chọn ngày hẹn' }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="staff_id"
              label="KTV phụ trách (tùy chọn)"
              extra="Để trống để spa phân công. Khi khách đòi KTV cũ không được nghỉ: đổi lịch hẹn sang KTV khác ở đây."
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Chọn KTV"
                options={staffOptions.map((staff) => ({ value: staff.id, label: staff.label }))}
                notFoundContent="Chưa có danh sách KTV"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="start_time"
          label="Giờ hẹn"
          rules={[{ required: true, message: 'Chọn giờ hẹn còn trống' }]}
          extra="Chỉ hiện giờ có KTV rảnh, không trùng lịch."
        >
          <Select
            disabled={slotsLoading || !selectedDate || !selectedCustomerId}
            loading={slotsLoading}
            placeholder={
              !selectedCustomerId || !selectedDate
                ? 'Chọn khách và ngày trước'
                : slotsLoading
                  ? 'Đang tìm giờ trống…'
                  : slots.length
                    ? 'Chọn giờ còn trống'
                    : 'Không có giờ trống ngày này'
            }
            options={slots.map((slot) => ({ value: slot.start_time.slice(0, 5), label: slot.start_time.slice(0, 5) }))}
            allowClear
            notFoundContent={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Không có giờ trống — thử ngày khác
              </Typography.Text>
            }
          />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
        <CustomFieldFormItems definitions={appointmentCustomFields} />
      </Form>
    </Modal>
  )
}
