import { Alert, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { Service } from '@/api/models/service'
import { bonusRemaining } from './constants'

interface TreatmentConvertModalProps {
  form: FormInstance
  open: boolean
  row: CustomerTreatment | null
  services: Service[]
  servicesLoading: boolean
  submitting: boolean
  onCancel: () => void
  onOk: () => void
}

/**
 * TA-02 — Đổi buổi tặng sang dịch vụ khác (BR-18): buổi tặng còn lại của gói gốc chuyển thành
 * số buổi MUA của gói mới (cùng gói, giá 0₫, sessions_bonus = 0, parent_treatment_id = gói gốc) — một chiều.
 */
export default function TreatmentConvertModal({
  form,
  open,
  row,
  services,
  servicesLoading,
  submitting,
  onCancel,
  onOk,
}: TreatmentConvertModalProps) {
  const remaining = row ? bonusRemaining(row) : 0

  return (
    <Modal
      title="Đổi buổi tặng sang dịch vụ khác"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Đổi buổi"
      cancelText="Hủy"
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical" className="mt-3">
        {row && (
          <Alert
            type="info"
            showIcon
            className="mb-3!"
            message={`Buổi tặng còn lại: ${remaining} buổi`}
            description="Buổi chuyển sẽ thành buổi mua của gói mới (giá 0₫, không kèm buổi tặng). Thao tác một chiều — không chuyển ngược lại."
          />
        )}
        <Form.Item name="service_id" label="Dịch vụ đích" rules={[{ required: true, message: 'Chọn dịch vụ đích' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Chọn dịch vụ"
            loading={servicesLoading}
            notFoundContent="Chưa có dịch vụ"
            options={services
              .filter((service) => service.is_active !== false)
              .map((service) => ({ value: service.id, label: service.title }))}
          />
        </Form.Item>
        <Form.Item
          name="from_sessions"
          label="Số buổi chuyển"
          rules={[
            { required: true, message: 'Nhập số buổi chuyển' },
            { validator: (_rule, value) => Number(value) >= 1 && Number(value) <= remaining ? Promise.resolve() : Promise.reject(new Error(`Chuyển từ 1 đến ${remaining} buổi (buổi tặng còn lại)`)) },
          ]}
        >
          <InputNumber min={1} max={remaining} precision={0} className="w-full!" />
        </Form.Item>
        <Form.Item name="reason" label="Lý do chuyển đổi" rules={[{ required: true, whitespace: true, message: 'Nhập lý do' }]}>
          <Input.TextArea rows={2} placeholder="VD: Khách yêu cầu đổi sang dịch vụ khác" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
