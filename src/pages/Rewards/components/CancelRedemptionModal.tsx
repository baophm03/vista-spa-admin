import { Form, type FormInstance, Input, Modal, Typography } from 'antd'
import type { RewardRedemptionRow } from './constants'

interface CancelRedemptionModalProps {
  cancelTarget: RewardRedemptionRow | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
}

export default function CancelRedemptionModal({
  cancelTarget,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
}: CancelRedemptionModalProps) {
  return (
    <Modal
      title={`Hủy lượt đổi: ${cancelTarget?.reward?.name ?? ''}`}
      open={!!cancelTarget}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText="Hủy lượt đổi"
      okButtonProps={{ danger: true }}
      cancelText="Đóng"
    >
      <Typography.Paragraph type="secondary">
        Sẽ hoàn <strong>{Number(cancelTarget?.points_spent ?? 0).toLocaleString('vi-VN')} điểm</strong> và trả lại số lượng quà. Chỉ hủy được lượt chưa sử dụng.
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item name="reason" label="Lý do hủy" rules={[{ required: true, message: 'Nhập lý do hủy' }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

