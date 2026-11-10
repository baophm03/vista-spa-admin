import { DatePicker, Form, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { Service } from '@/api/models/service'
import type { ProfileRow, Slot, StaffRow } from '@/pages/Appointments/components/constants'

export interface StandaloneServiceCreateModalProps {
  open: boolean
  form: FormInstance
  isSaving: boolean
  customerOptions: ProfileRow[]
  customersLoading: boolean
  onCustomerSearch: (q: string) => void
  serviceOptions: Service[]
  servicesLoading: boolean
  staffs: StaffRow[]
  slots: Slot[]
  slotStaffIds: string[]
  slotsLoading: boolean
  selectedCustomerId?: string
  selectedServiceId?: string
  selectedDate: string
  customFieldDefs: CustomFieldDefWithOptions[]
  onCancel: () => void
  onSubmit: () => void
}

/** Modal tạo dịch vụ KH (không gắn gói liệu trình) ngay trong trang Dịch vụ KH — có chọn KTV */
export default function StandaloneServiceCreateModal({
  open,
  form,
  isSaving,
  customerOptions,
  customersLoading,
  onCustomerSearch,
  serviceOptions,
  servicesLoading,
  staffs,
  slots,
  slotStaffIds,
  slotsLoading,
  selectedCustomerId,
  selectedServiceId,
  selectedDate,
  customFieldDefs,
  onCancel,
  onSubmit,
}: StandaloneServiceCreateModalProps) {
  // Giá mặc định theo dịch vụ được chọn; dịch vụ có khoảng giá thì cho chốt trong khoảng đó
  const selectedService = serviceOptions.find((service) => service.id === selectedServiceId)
  const priceMin = Number(selectedService?.price ?? 0)
  const priceMax = Math.max(priceMin, Number(selectedService?.price_max ?? priceMin))
  const hasPriceRange = priceMax > priceMin
  return (
    <Modal
      title="Thêm dịch vụ KH"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={isSaving}
      okText={isSaving ? 'Đang tạo…' : 'Lưu'}
      cancelText="Hủy"
      width="min(680px, calc(100vw - 24px))"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
          <Select
            showSearch
            filterOption={false}
            onSearch={onCustomerSearch}
            loading={customersLoading}
            placeholder="Gõ tên hoặc SĐT để tìm khách"
            options={customerOptions.map((c) => ({ value: c.id, label: `${c.full_name} — ${c.phone}` }))}
            notFoundContent={customersLoading ? 'Đang tìm khách hàng…' : 'Không tìm thấy khách'}
          />
        </Form.Item>
        <Form.Item
          name="service_id"
          label="Dịch vụ"
          rules={[{ required: true, message: 'Chọn dịch vụ khách đặt' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={servicesLoading}
            placeholder="Chọn dịch vụ"
            options={serviceOptions.map((s) => ({ value: s.id, label: s.title }))}
            notFoundContent={servicesLoading ? 'Đang tải dịch vụ…' : 'Chưa có dịch vụ đang hoạt động'}
            onChange={(id) => {
              // đổi dịch vụ → gợi ý lại giá mặc định
              const next = serviceOptions.find((service) => service.id === id)
              const price = Number(next?.price ?? 0)
              form.setFieldValue('service_amount', price || undefined)
            }}
          />
        </Form.Item>
        <Form.Item
          name="service_amount"
          label="Giá dịch vụ (₫)"
          initialValue={priceMin || undefined}
          extra={!selectedServiceId
            ? 'Chọn dịch vụ để xem giá niêm yết.'
            : hasPriceRange
              ? `Giá niêm yết: ${priceMin.toLocaleString('vi-VN')}–${priceMax.toLocaleString('vi-VN')} ₫ — có thể chốt giá ngay từ lúc tạo.`
              : priceMin > 0
                ? `Giá niêm yết: ${priceMin.toLocaleString('vi-VN')} ₫ — bỏ trống để dùng giá niêm yết.`
                : 'Dịch vụ này chưa có giá niêm yết — nhập số tiền bán.'}
          rules={[
            { validator: (_rule, value) => value == null || (Number.isInteger(Number(value)) && Number(value) >= 0)
              ? Promise.resolve()
              : Promise.reject(new Error('Giá phải là số nguyên không âm')) },
            { validator: (_rule, value) => value == null || !hasPriceRange || (Number(value) >= priceMin && Number(value) <= priceMax)
              ? Promise.resolve()
              : Promise.reject(new Error(`Giá phải trong khoảng ${priceMin.toLocaleString('vi-VN')}–${priceMax.toLocaleString('vi-VN')} ₫`)) },
          ]}
        >
          <InputNumber min={0} step={1000} precision={0} style={{ width: '100%' }} addonAfter="₫" placeholder={priceMin ? priceMin.toLocaleString('vi-VN') : 'Giá dịch vụ'} />
        </Form.Item>
        <Form.Item name="cs_date" label="Ngày làm" rules={[{ required: true, message: 'Chọn ngày làm' }]}>
          <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="start_time"
          label="Giờ làm"
          rules={[{ required: true, message: 'Chọn giờ còn trống' }]}
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
                  : 'Chọn giờ còn trống'
            }
            options={slots.map((slot) => ({ value: slot.start_time.slice(0, 5), label: slot.start_time.slice(0, 5) }))}
            notFoundContent={
              <span style={{ fontSize: 12, color: '#849197' }}>Không có giờ trống — thử ngày khác</span>
            }
            onChange={(time) => {
              // đổi giờ → reset KTV để chọn lại theo slot mới
              const slot = slots.find((candidate) => candidate.start_time.slice(0, 5) === time)
              const currentStaff = form.getFieldValue('staff_id')
              if (currentStaff && !slot?.staff_ids.includes(currentStaff)) form.setFieldValue('staff_id', undefined)
            }}
            allowClear
          />
        </Form.Item>
        <Form.Item
          name="staff_id"
          label="KTV phụ trách"
          extra="Chọn KTV rảnh ở khung giờ này; có thể gán sau nếu để trống."
        >
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            disabled={slotsLoading || !slotStaffIds.length}
            loading={slotsLoading}
            placeholder={!selectedServiceId || !selectedDate ? 'Chọn dịch vụ, ngày và giờ trước' : 'Chọn KTV rảnh'}
            options={slotStaffIds
              .map((id) => staffs.find((staff) => staff.id === id))
              .filter((staff): staff is StaffRow => !!staff)
              .map((staff) => ({
                value: staff.id,
                label: `${staff.zalo_name || 'Nhân viên'} · ${staff.email || staff.id.slice(0, 8)}`,
              }))}
          />
        </Form.Item>
        <CustomFieldFormItems definitions={customFieldDefs} />
      </Form>
    </Modal>
  )
}
