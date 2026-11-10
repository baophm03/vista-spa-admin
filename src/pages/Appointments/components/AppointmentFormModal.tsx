import { Can } from '@casl/react'
import { Button, Col, DatePicker, Form, Input, Modal, Row, Segmented, Select, Space, Typography } from 'antd'

import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { Appointment } from '@/api/models/appointment'
import type { Service } from '@/api/models/service'
import type { TreatmentPackage } from '@/api/models/treatmentPackage'
import type { ProfileRow, Slot } from './constants'

export type AppointmentBookingType = 'service' | 'treatment'

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
  bookingType: AppointmentBookingType
  onBookingTypeChange: (type: AppointmentBookingType) => void
  treatmentPackagesLoading: boolean
  treatmentPackages: TreatmentPackage[]
  selectedCustomerId?: string
  selectedServiceId?: string
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
  servicesLoading,
  serviceOptions,
  bookingType,
  onBookingTypeChange,
  treatmentPackagesLoading,
  treatmentPackages,
  selectedCustomerId,
  selectedServiceId,
  selectedDate,
  appointmentCustomFields,
  onCancel,
  onSubmit,
}: AppointmentFormModalProps) {
  const isTreatment = bookingType === 'treatment'
  const selectedPackageId = Form.useWatch('treatment_package_id', form)
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
              form.setFieldsValue({ treatment_package_id: undefined, service_id: undefined })
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
        <Form.Item label="Loại lịch hẹn" required>
          <Segmented
            block
            value={bookingType}
            options={[
              { label: 'Dịch vụ', value: 'service' },
              { label: 'Liệu trình', value: 'treatment' },
            ]}
            onChange={(value) => {
              const next = value as AppointmentBookingType
              form.setFieldsValue(
                next === 'treatment'
                  ? { service_id: undefined, treatment_package_id: undefined }
                  : { treatment_package_id: undefined },
              )
              onBookingTypeChange(next)
            }}
          />
        </Form.Item>
        {isTreatment ? (
          <Form.Item
            name="treatment_package_id"
            label="Gói liệu trình"
            rules={[{ required: true, message: 'Chọn gói liệu trình' }]}
            extra="Nội dung buổi gặp với khách."
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={treatmentPackagesLoading}
              placeholder="Chọn gói liệu trình"
              options={treatmentPackages
                .filter((pkg) => pkg.is_active !== false)
                .map((pkg) => ({ value: pkg.id, label: pkg.name }))}
              notFoundContent={treatmentPackagesLoading ? 'Đang tải gói…' : 'Chưa có gói liệu trình'}
            />
          </Form.Item>
        ) : (
          <Form.Item
            name="service_id"
            label="Dịch vụ"
            rules={[{ required: true, message: 'Chọn dịch vụ khách đặt' }]}
            extra="Nội dung buổi gặp với khách."
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={servicesLoading}
              placeholder="Chọn dịch vụ"
              style={{ width: '100%' }}
              options={serviceOptions.map((s) => ({ value: s.id, label: s.title }))}
              notFoundContent={servicesLoading ? 'Đang tải dịch vụ…' : 'Chưa có dịch vụ đang hoạt động'}
            />
          </Form.Item>
        )}
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="appt_date" label="Ngày hẹn" rules={[{ required: true, message: 'Chọn ngày hẹn' }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
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
            disabled={slotsLoading || !selectedDate || (!selectedServiceId && !selectedPackageId) || !selectedCustomerId}
            loading={slotsLoading}
            placeholder={
              !selectedCustomerId || (!selectedServiceId && !selectedPackageId) || !selectedDate
                ? 'Chọn khách, dịch vụ/gói và ngày trước'
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
