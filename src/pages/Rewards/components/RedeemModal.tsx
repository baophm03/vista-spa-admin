import { Form, type FormInstance, Modal, Select, Typography } from 'antd'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { RewardRow } from './constants'

interface RedeemModalProps {
  redeemTarget: RewardRow | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
  customers: CustomerProfile[]
}

export default function RedeemModal({
  redeemTarget,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
  customers,
}: RedeemModalProps) {
  return (
    <Modal
      title={`Đổi hộ khách: ${redeemTarget?.name ?? ''}`}
      open={!!redeemTarget}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText="Đổi quà"
      cancelText="Đóng"
    >
      <Typography.Paragraph type="secondary">
        Sẽ trừ <strong>{redeemTarget?.points_cost.toLocaleString('vi-VN')} điểm</strong> của khách và tạo lượt đổi Chưa dùng.
      </Typography.Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách' }]}>
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Tìm theo tên hoặc SĐT"
            options={customers.map((c) => ({ value: c.id, label: `${c.full_name} — ${c.phone}` }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

