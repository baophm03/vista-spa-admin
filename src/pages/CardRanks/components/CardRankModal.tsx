import {
  Alert,
  ColorPicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
} from 'antd'
import type { FormInstance } from 'antd'
import { RANK_HINT, VALIDITY_META, type CardRankRow } from './constants'

interface Props {
  open: boolean
  editing: CardRankRow | null
  form: FormInstance
  saving: boolean
  onCancel: () => void
  onSubmit: () => void
}

export default function CardRankModal({ open, editing, form, saving, onCancel, onSubmit }: Props) {
  return (
    <Modal
      title={editing ? `Sửa hạng: ${editing.name}` : 'Thêm hạng thẻ'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu" cancelText="Hủy"
      width="min(880px, calc(100vw - 24px))"
    >
      <Alert
        type="info" showIcon style={{ marginTop: 12, marginBottom: 12 }}
        message={RANK_HINT}
      />
      <Form form={form} layout="vertical">
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item
            name="code" label="Mã hạng" style={{ flex: 1 }}
            rules={editing ? undefined : [{ required: true, message: 'Nhập mã hạng' }]}
            extra={editing ? 'Mã hạng không thể thay đổi' : undefined}
          >
            <Input maxLength={50} placeholder="VD: SILVER" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự sắp xếp" rules={[{ required: true, message: 'Nhập thứ tự' }]} style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="name" label="Tên hạng" rules={[{ required: true, message: 'Nhập tên hạng' }]}>
          <Input maxLength={255} placeholder="VD: Bạc" />
        </Form.Item>
        <Form.Item
          name="color"
          label="Màu thẻ"
          extra="Hiển thị trên thẻ hạng ở trang Điểm & Hạng thành viên"
          getValueFromEvent={(_color: unknown, hex: string) => hex || undefined}
        >
          <ColorPicker
            format="hex"
            showText
            allowClear
            disabledAlpha
            presets={[{ label: 'Gợi ý', colors: ['#8A6A1F', '#1E6FD0', '#C07A10', '#2B77C9', '#A11E42'] }]}
          />
        </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="min_spent" label="Chi tiêu tối thiểu (₫)" rules={[{ required: true, message: 'Nhập ngưỡng tối thiểu' }]} style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="VD: 5000000" />
          </Form.Item>
          <Form.Item name="max_spent" label="Chi tiêu tối đa (₫)" style={{ flex: 1 }} extra="Bỏ trống nếu không giới hạn trên">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
          </Form.Item>
          <Form.Item name="discount_percent" label='% giảm giá của hạng (%)' style={{ flex: 1 }} extra='Tính vào trần xếp chồng ưu đãi'>
            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} placeholder="VD: 10" />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="validity" label="Hiệu lực thẻ" rules={[{ required: true, message: 'Chọn hiệu lực' }]} style={{ flex: 1 }}>
            <Select options={Object.entries(VALIDITY_META).map(([value, meta]) => ({ value, label: meta.label }))} />
          </Form.Item>
          <Form.Item name="auto_assign" label="Tự gán hạng" valuePropName="checked" style={{ flex: 1 }} extra="Tự động xét hạng khi khách đạt ngưỡng chi tiêu">
            <Switch />
          </Form.Item>
        </Space>
        <Form.Item name="benefits" label="Quyền lợi">
          <Input.TextArea rows={3} maxLength={2000} placeholder="Mô tả quyền lợi của hạng thẻ" />
        </Form.Item>
      </Form>
    </Modal>
  )
}
