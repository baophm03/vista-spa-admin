import { Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'

interface Profile { user_id?: string; full_name: string; phone: string }
interface Props { open: boolean; form: FormInstance; profiles: Profile[]; eventMeta: Record<string, { label: string }>
  onCancel: () => void; onSubmit: () => void }

export default function NotificationModal({ open, form, profiles, eventMeta, onCancel, onSubmit }: Props) {
  return <Modal title="Gửi thông báo" open={open} onCancel={onCancel} onOk={onSubmit} okText="Gửi" cancelText="Hủy">
    <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
      <Form.Item name="channel" label="Kênh gửi" rules={[{ required: true }]}><Select options={[{ value: 'app', label: 'Thông báo trong ứng dụng' }, { value: 'email', label: 'Email' }]} /></Form.Item>
      <Form.Item name="event_key" label="Loại thông báo" rules={[{ required: true }]}><Select options={Object.entries(eventMeta).map(([value, meta]) => ({ value, label: meta.label }))} /></Form.Item>
      <Form.Item name="user_id" label="Đối tượng nhận (bỏ trống = broadcast tất cả)"><Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả khách hàng" options={profiles.filter((p) => p.user_id).map((p) => ({ value: p.user_id, label: `${p.full_name} — ${p.phone}` }))} /></Form.Item>
      <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}><Input placeholder="VD: Ưu đãi tháng 11" /></Form.Item>
      <Form.Item name="body" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}><Input.TextArea rows={3} placeholder="Nội dung thông báo gửi qua app..." /></Form.Item>
    </Form>
  </Modal>
}
