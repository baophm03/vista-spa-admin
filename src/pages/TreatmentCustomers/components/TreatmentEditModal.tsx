import { DatePicker, Form, Input, InputNumber, Modal } from 'antd'
import type { FormInstance } from 'antd'
import CustomFieldFormItems from '@/components/CustomFieldFormItems'
import type { CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import type { CustomerTreatment } from '@/api/models/customerTreatment'

interface TreatmentEditModalProps {
  form: FormInstance
  open: boolean
  row: CustomerTreatment | null
  currencySymbol: string
  customFieldDefs: CustomFieldDefWithOptions[]
  submitting: boolean
  onCancel: () => void
  onOk: () => void
}

/**
 * CT-04 — PUT /treatment-customers/{id}/admin: sửa số tiền (chỉ khi chưa có thanh toán hợp lệ),
 * hạn sử dụng, ghi chú, custom fields. Số buổi/buổi tặng không sửa ở đây — đi qua flow điều chỉnh có audit.
 */
export default function TreatmentEditModal({
  form,
  open,
  row,
  currencySymbol,
  customFieldDefs,
  submitting,
  onCancel,
  onOk,
}: TreatmentEditModalProps) {
  const hasPayment = Number(row?.paid_amount ?? 0) > 0

  return (
    <Modal
      className="treatment-form-modal"
      title="Sửa liệu trình"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical" className="mt-3">
        <Form.Item
          name="total_amount"
          label="Số tiền"
          extra={hasPayment ? 'Đã có thanh toán — không thể sửa số tiền.' : 'Chỉ sửa được khi chưa có thanh toán hợp lệ.'}
        >
          <InputNumber min={0} step={100000} suffix={currencySymbol} disabled={hasPayment} className="w-full!" />
        </Form.Item>
        <Form.Item name="expires_at" label="Hạn sử dụng">
          <DatePicker className="w-full!" />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
        <CustomFieldFormItems definitions={customFieldDefs} />
      </Form>
    </Modal>
  )
}
