import { DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch } from 'antd'
import type { FormInstance } from 'antd'
import { TYPE_LABEL, type VoucherRow } from './constants'

interface VoucherModalProps {
  form: FormInstance
  open: boolean
  editing: VoucherRow | null
  onCancel: () => void
  onOk: () => void
}

export default function VoucherModal({ form, open, editing, onCancel, onOk }: VoucherModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa voucher' : 'Thêm voucher'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="title" label="Tên chương trình" rules={[{ required: true, message: 'Nhập tên' }]}>
          <Input placeholder="VD: Giảm 50k cho hóa đơn đầu" />
        </Form.Item>
        <Space style={{ display: 'flex' }}>
          <Form.Item name="type" label="Áp dụng hạng" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value: Number(value), label }))} />
          </Form.Item>
          <Form.Item name="required_points" label="Điểm đổi" rules={[{ required: true, message: 'Nhập điểm' }]} style={{ flex: 1 }}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }}>
          <Form.Item name="start_date" label="Bắt đầu" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="end_date" label="Kết thúc" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Space>
        <Form.Item name="is_active" label="Hoạt động" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
