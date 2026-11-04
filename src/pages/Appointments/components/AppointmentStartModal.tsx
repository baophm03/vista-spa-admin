import { Form, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { useGetCustomerTreatments } from '@/api/endpoints/customer-treatments'
import type { usePostAppointmentsIdStart } from '@/api/endpoints/appointments'
import type { AppointmentRow } from './constants'

export interface AppointmentStartModalProps {
  appointment: AppointmentRow | null
  form: FormInstance
  startMutation: ReturnType<typeof usePostAppointmentsIdStart>
  startTreatmentsQuery: ReturnType<typeof useGetCustomerTreatments>
  startTreatmentOptions: { value: string; label: string }[]
  selectedStartTreatmentId?: string
  startingServiceHasRange: boolean
  startingServicePrice: number
  startingServicePriceMax: number
  sessionCustomFields: CustomFieldDefWithOptions[]
  onCancel: () => void
  onSubmit: () => void
}

export default function AppointmentStartModal({
  appointment,
  form,
  startMutation,
  startTreatmentsQuery,
  startTreatmentOptions,
  selectedStartTreatmentId,
  startingServiceHasRange,
  startingServicePrice,
  startingServicePriceMax,
  sessionCustomFields,
  onCancel,
  onSubmit,
}: AppointmentStartModalProps) {
  const startingAppointment = appointment
  return (
    <Modal
      title="Thông tin buổi điều trị"
      width="min(760px, calc(100vw - 24px))"
      open={!!startingAppointment}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={startMutation.isPending}
      okText={startMutation.isPending ? 'Đang bắt đầu…' : 'Bắt đầu buổi'}
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        {startingAppointment && !startingAppointment.customer_treatment_id && (
          <Form.Item
            name="customer_treatment_id"
            label="Gói khách đang dùng (không bắt buộc)"
            extra="Chọn gói đã mua để tạo buổi và trừ buổi/định mức của gói khi hoàn tất; không nhập giá dịch vụ. Bỏ trống = dịch vụ lẻ, lễ tân chốt giá nếu dịch vụ có khoảng giá."
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              loading={startTreatmentsQuery.isLoading}
            placeholder="Không dùng gói — làm dịch vụ lẻ"
              options={startTreatmentOptions}
              notFoundContent={startTreatmentsQuery.isLoading ? 'Đang tải gói…' : 'Khách không có gói phù hợp với dịch vụ này'}
              onChange={(value) => { if (value) form.setFieldValue('service_amount', undefined) }}
            />
          </Form.Item>
        )}
        {startingAppointment && !startingAppointment.customer_treatment_id && !selectedStartTreatmentId && startingServiceHasRange && (
          <Form.Item
            name="service_amount"
            label="Giá dịch vụ lẻ đã thống nhất"
            rules={[{ required: true, message: 'Nhập giá chốt trước khi bắt đầu' }]}
            extra={`Nhập giá khách đã đồng ý trong khoảng ${startingServicePrice.toLocaleString('vi-VN')}–${startingServicePriceMax.toLocaleString('vi-VN')} ₫. Giá này sẽ được dùng khi thu tiền.`}
          >
            <InputNumber
              min={startingServicePrice}
              max={startingServicePriceMax}
              precision={0}
              step={1000}
              style={{ width: '100%' }}
              addonAfter="₫"
              placeholder="Nhập giá chốt"
            />
          </Form.Item>
        )}
        <CustomFieldFormItems definitions={sessionCustomFields} />
      </Form>
    </Modal>
  )
}
