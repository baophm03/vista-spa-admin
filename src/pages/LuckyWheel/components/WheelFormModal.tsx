import { Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import type { FormInstance } from 'antd'
import { useBrandCurrency } from '@/themeRuntime'

interface Branch { id: string; name: string }

export default function WheelFormModal({ open, form, branches, onCancel, onSubmit }: {
  open: boolean
  form: FormInstance
  branches: Branch[]
  onCancel: () => void
  onSubmit: () => void
}) {
  const { symbol: currencySymbol } = useBrandCurrency()
  return (
    <Modal title="Thêm vòng quay" open={open} onCancel={onCancel} onOk={onSubmit} okText="Lưu" cancelText="Hủy">
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Tên vòng quay" rules={[{ required: true, message: 'Nhập tên' }]}>
          <Input placeholder="VD: Quay may mắn tháng 10" />
        </Form.Item>
        <Space style={{ display: 'flex' }}>
          <Form.Item name="branch_id" label="Cơ sở (bỏ trống = tất cả)" style={{ flex: 1 }}>
            <Select allowClear options={branches.map((b) => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="spins_per_user" label="Lượt/user" rules={[{ required: true }]} style={{ flex: 1 }}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="min_year_spent" label="Doanh số tối thiểu năm" rules={[{ required: true }]}>
          <InputNumber min={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
