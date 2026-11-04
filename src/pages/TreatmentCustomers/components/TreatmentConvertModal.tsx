import { Alert, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import { bonusRemainingOf } from './constants'

interface TreatmentConvertModalProps {
  form: FormInstance
  open: boolean
  convertRow: CustomerTreatment | null
  profileName: (row: CustomerTreatment) => string
  serviceOptions: { value: string; label: string }[]
  submitting: boolean
  onCancel: () => void
  onOk: () => void
}

export default function TreatmentConvertModal({
  form,
  open,
  convertRow,
  profileName,
  serviceOptions,
  submitting,
  onCancel,
  onOk,
}: TreatmentConvertModalProps) {
  return (
      <Modal
        title={`Đổi buổi tặng — ${convertRow ? profileName(convertRow) : ''}`}
      open={open}
        onCancel={onCancel}
        onOk={onOk}
        okText="Chuyển đổi"
        cancelText="Hủy"
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          className="mb-3"
          message={`Còn ${convertRow ? bonusRemainingOf(convertRow) : 0} buổi tặng khả dụng`}
          description="Chỉ chuyển được buổi TẶNG còn lại, không ảnh hưởng buổi đã mua. Thao tác một chiều — không thể đổi ngược."
        />
        <Form form={form} layout="vertical">
          <Form.Item name="service_id" label="Dịch vụ đích" rules={[{ required: true, message: 'Chọn dịch vụ đích' }]}>
            <Select showSearch optionFilterProp="label" options={serviceOptions} placeholder="Chọn dịch vụ muốn chuyển sang" />
          </Form.Item>
          <Form.Item
            name="from_sessions"
            label="Số buổi chuyển"
            rules={[
              { required: true, message: 'Nhập số buổi' },
              { type: 'number', min: 1, message: 'Tối thiểu 1 buổi' },
              { type: 'number', max: convertRow ? bonusRemainingOf(convertRow) : 0, message: 'Vượt số buổi tặng còn lại' },
            ]}
          >
            <InputNumber min={1} max={convertRow ? bonusRemainingOf(convertRow) : 0} className="w-full!" />
          </Form.Item>
          <Form.Item name="reason" label="Lý do (bắt buộc)" rules={[{ required: true, whitespace: true, message: 'Nhập lý do' }]}>
            <Input.TextArea rows={2} maxLength={500} placeholder="VD: Khách không làm mụn nữa, đổi sang gội đầu dưỡng sinh" />
          </Form.Item>
        </Form>
      </Modal>

  )
}

