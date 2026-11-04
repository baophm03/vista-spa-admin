import { Can } from '@casl/react'
import { Button, Col, DatePicker, Form, Input, Modal, Row, Select, Space, Typography } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { Appointment } from '@/api/models/appointment'
import type { Service } from '@/api/models/service'
import type { ProfileRow, Slot, StaffRow, TreatmentWithMeta } from './constants'

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
  servicesLoading: boolean
  serviceOptions: Service[]
  serviceLockedByPackage: boolean
  serviceFormPrice: number
  serviceFormPriceMax: number
  serviceFormHasRange: boolean
  selectedTreatment?: TreatmentWithMeta
  activeTreatmentsLoading: boolean
  activeTreatmentOptions: { value: string; label: string }[]
  activeTreatments: TreatmentWithMeta[]
  staffs: StaffRow[]
  selectedCustomerId?: string
  selectedServiceId?: string
  selectedDate: string
  selectedStartTime?: string
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
  servicesLoading,
  serviceOptions,
  serviceLockedByPackage,
  serviceFormPrice,
  serviceFormPriceMax,
  serviceFormHasRange,
  selectedTreatment,
  activeTreatmentsLoading,
  activeTreatmentOptions,
  activeTreatments,
  staffs,
  selectedCustomerId,
  selectedServiceId,
  selectedDate,
  selectedStartTime,
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
        >
          <Select
            showSearch
            filterOption={false}
            onSearch={onCustomerSearch}
            onChange={(id) => {
              onSelectProfile(profileOptions.find((profile) => profile.id === id) ?? null)
              form.setFieldsValue({ customer_treatment_id: undefined })
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
            <Form.Item
              name="service_id"
              label="Dịch vụ"
              rules={[{ required: true, message: 'Chọn dịch vụ khách đặt' }]}
              extra={serviceLockedByPackage
                ? 'Dịch vụ cố định theo gói đã chọn — bỏ gói nếu muốn chọn dịch vụ khác.'
                : serviceFormHasRange && !selectedTreatment
                  ? `Dịch vụ có khoảng giá ${serviceFormPrice.toLocaleString('vi-VN')}–${serviceFormPriceMax.toLocaleString('vi-VN')} ₫. Lễ tân chốt giá khi bắt đầu lịch.`
                  : 'Dịch vụ quyết định thời lượng và giờ/KTV còn trống.'}
            >
              <Select
                showSearch
                optionFilterProp="label"
                disabled={serviceLockedByPackage}
                loading={servicesLoading}
                placeholder="Chọn dịch vụ"
                style={{ width: '100%' }}
                options={serviceOptions.map((s) => ({ value: s.id, label: s.title }))}
                notFoundContent={servicesLoading ? 'Đang tải dịch vụ…' : 'Chưa có dịch vụ đang hoạt động'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="appt_date" label="Ngày hẹn" rules={[{ required: true, message: 'Chọn ngày hẹn' }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="start_time"
              label="Giờ hẹn"
              rules={[{ required: true, message: 'Chọn giờ hẹn còn trống' }]}
              extra="Chỉ hiện giờ có KTV rảnh, không trùng lịch."
            >
              <Select
                disabled={slotsLoading || !selectedDate || !selectedServiceId || !selectedCustomerId}
                loading={slotsLoading}
                placeholder={
                  !selectedCustomerId || !selectedServiceId || !selectedDate
                    ? 'Chọn khách, dịch vụ và ngày trước'
                    : slotsLoading
                      ? 'Đang tìm giờ trống…'
                      : slots.length
                        ? 'Chọn giờ còn trống'
                        : 'Không có giờ trống ngày này'
                }
                options={slots.map((slot) => ({ value: slot.start_time.slice(0, 5), label: slot.start_time.slice(0, 5) }))}
                onChange={(time) => {
                  const slot = slots.find((candidate) => candidate.start_time.slice(0, 5) === time)
                  if (!slot?.staff_ids.includes(form.getFieldValue('staff_id'))) form.setFieldsValue({ staff_id: undefined })
                }}
                allowClear
                notFoundContent={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Không có giờ trống — thử ngày khác
                  </Typography.Text>
                }
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="staff_id" label="KTV phụ trách" extra="Có thể gán KTV ngay hoặc khi duyệt lịch.">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                disabled={!selectedStartTime || slotsLoading}
                loading={slotsLoading}
                placeholder={selectedStartTime ? 'Chọn KTV rảnh' : 'Chọn giờ trước'}
                style={{ width: '100%' }}
                options={slots
                  .find((slot) => slot.start_time.slice(0, 5) === selectedStartTime?.slice(0, 5))
                  ?.staff_ids.map((id) => staffs.find((staff) => staff.id === id))
                  .filter((staff): staff is StaffRow => !!staff)
                  .map((staff) => ({
                    value: staff.id,
                    label: `${staff.zalo_name || 'Nhân viên'} · ${staff.email || staff.id.slice(0, 8)}`,
                  }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="customer_treatment_id"
          label="Gói khách đang dùng (không bắt buộc)"
          extra="Chọn gói đã mua để buổi hẹn dùng gói và trừ buổi/định mức khi hoàn tất. Bỏ trống để làm dịch vụ lẻ; nếu dịch vụ có khoảng giá, lễ tân chốt giá khi bắt đầu."
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            disabled={!selectedCustomerId}
            loading={activeTreatmentsLoading}
            placeholder={selectedCustomerId ? 'Chọn gói khách đã mua (nếu có)' : 'Chọn khách trước'}
            options={activeTreatmentOptions}
            notFoundContent={activeTreatmentsLoading ? 'Đang tải gói…' : 'Khách không có gói đang làm'}
            onChange={(id) => {
              const treatment = activeTreatments.find((t) => t.id === id)
              const allowed = treatment?.allowed_service_ids
              if (allowed?.length === 1) {
                form.setFieldsValue({ service_id: allowed[0] })
              } else if (allowed?.length && !allowed.includes(form.getFieldValue('service_id'))) {
                form.setFieldsValue({ service_id: undefined })
              }
            }}
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
