import { Form, type FormInstance, Input, Modal, Select } from 'antd'
import type { MemberRow, RankRow } from './constants'

interface RankOverrideModalProps {
  overrideTarget: { row: MemberRow } | null
  confirmLoading: boolean
  onCancel: () => void
  onSubmit: () => void
  ranks: RankRow[]
  form: FormInstance
}

export default function RankOverrideModal({
  overrideTarget,
  confirmLoading,
  onCancel,
  onSubmit,
  ranks,
  form,
}: RankOverrideModalProps) {
  return (
    <Modal
      title={`Gán hạng — ${overrideTarget?.row.full_name || overrideTarget?.row.phone || ''}`}
      open={!!overrideTarget}
      confirmLoading={confirmLoading}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Gán hạng"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="rank_id" label="Hạng mới" rules={[{ required: true, message: 'Chọn hạng mới' }]}>
          <Select placeholder="Chọn hạng" options={ranks.map((r) => ({ value: r.id, label: r.name }))} />
        </Form.Item>
        <Form.Item
          name="reason"
          label="Lý do gán hạng"
          rules={[
            {
              validator: async (_, value) =>
                String(value ?? '').trim() ? Promise.resolve() : Promise.reject(new Error('Nhập lý do')),
            },
          ]}
        >
          <Input.TextArea rows={3} maxLength={500} placeholder="Nhập lý do đặc cách gán hạng" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
