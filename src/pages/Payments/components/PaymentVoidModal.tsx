import { Form, type FormInstance, Input, Modal, Typography } from 'antd'
import dayjs from 'dayjs'
import type { LedgerRow } from './constants'

interface PaymentVoidModalProps {
  open: boolean
  voidRow: LedgerRow | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
}

export default function PaymentVoidModal({
  open,
  voidRow,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
}: PaymentVoidModalProps) {
  return (
    <Modal
      title="Hủy giao dịch thanh toán"
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Hủy giao dịch"
      okButtonProps={{ danger: true }}
      cancelText="Không"
      confirmLoading={confirmLoading}
      destroyOnHidden
    >
      {voidRow && (
        <div style={{ marginBottom: 12 }}>
          <Typography.Paragraph>
            Giao dịch <Typography.Text strong>{Number(voidRow.amount).toLocaleString('vi-VN')} ₫</Typography.Text> —
            ngày {dayjs(String(voidRow.paid_at)).format('DD/MM/YYYY HH:mm')}
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            Hủy mềm: giao dịch được giữ vết (người hủy, lý do), số nợ của khách được tính lại tự động.
          </Typography.Paragraph>
        </div>
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="void_reason"
          label="Lý do hủy (bắt buộc)"
          rules={[{ required: true, whitespace: true, message: 'Nhập lý do hủy' }]}
        >
          <Input.TextArea rows={2} maxLength={500} placeholder="VD: Thu nhầm tiền, khách yêu cầu hoàn trả" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
