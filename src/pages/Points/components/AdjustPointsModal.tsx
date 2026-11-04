import { Form, type FormInstance, Input, InputNumber, Modal } from 'antd'
import type { MemberRow } from './constants'

interface AdjustPointsModalProps {
  adjusting: MemberRow | null
  confirmLoading: boolean
  onCancel: () => void
  onSubmit: () => void
  form: FormInstance
}

export default function AdjustPointsModal({
  adjusting,
  confirmLoading,
  onCancel,
  onSubmit,
  form,
}: AdjustPointsModalProps) {
  return (
    <Modal
      title={`Điều chỉnh điểm — ${adjusting?.full_name || adjusting?.phone || ''}`}
      open={!!adjusting}
      confirmLoading={confirmLoading}
      okButtonProps={{ disabled: confirmLoading }}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="delta"
          label="Điểm thay đổi (+ cộng, − trừ)"
          help={
            Number(adjusting?.membership?.lifetime_points ?? 0) > 0
              ? `Hiện có ${Number(adjusting?.membership?.lifetime_points ?? 0).toLocaleString('vi-VN')} điểm. Nhập -${Number(adjusting?.membership?.lifetime_points ?? 0).toLocaleString('vi-VN')} để đưa số dư về 0.`
              : 'Nhập số dương để cộng hoặc số âm để trừ.'
          }
          rules={[
            { required: true, message: 'Nhập số điểm' },
            {
              validator: async (_, value) =>
                Number.isInteger(Number(value)) ? Promise.resolve() : Promise.reject(new Error('Số điểm phải là số nguyên')),
            },
          ]}
        >
          <InputNumber style={{ width: '100%' }} step={10} precision={0} />
        </Form.Item>
        <Form.Item
          name="reason"
          label="Lý do"
          rules={[
            {
              validator: async (_, value) =>
                String(value ?? '').trim() ? Promise.resolve() : Promise.reject(new Error('Nhập lý do')),
            },
          ]}
        >
          <Input placeholder="VD: Bù điểm chương trình ưu đãi" maxLength={500} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

