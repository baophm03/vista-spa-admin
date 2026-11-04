import { Alert, Form, Input, InputNumber, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { LookupItem } from '@/api/models/lookupItem'

interface TreatmentPaymentModalProps {
  form: FormInstance
  open: boolean
  currencySymbol: string
  lookupLoading: boolean
  lookupError: string
  activePaymentMethods: LookupItem[]
  onCancel: () => void
  onOk: () => void
}

export default function TreatmentPaymentModal({
  form,
  open,
  currencySymbol,
  lookupLoading,
  lookupError,
  activePaymentMethods,
  onCancel,
  onOk,
}: TreatmentPaymentModalProps) {
  return (
      <Modal
        title="Ghi nhận thanh toán"
      open={open}
        onCancel={onCancel}
        onOk={onOk}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ disabled: lookupLoading || !!lookupError || activePaymentMethods.length === 0 }}
      >
        <Form form={form} layout="vertical" className="mt-3">
          {lookupError && <Alert type="error" showIcon message="Không thể ghi nhận thanh toán" description={lookupError} className="mb-4" />}
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <InputNumber min={1} step={50000} suffix={currencySymbol} className="w-full!" />
          </Form.Item>
          <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
            <Select
              loading={lookupLoading}
              disabled={lookupLoading || !!lookupError || activePaymentMethods.length === 0}
              options={activePaymentMethods.map((item) => ({ value: item.code, label: item.label }))}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

  )
}

