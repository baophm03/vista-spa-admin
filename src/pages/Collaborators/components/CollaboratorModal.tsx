import { Form, Input, InputNumber, Modal, Select, Space } from 'antd'

export default function CollaboratorModal({ editing, open, onClose, onSubmit, loading, form, collaboratorTypes, typeMeta }: any) {
  return (
    <Modal title={editing ? `Sửa CTV: ${editing.name}` : 'Thêm cộng tác viên'} open={open} onCancel={onClose}
      onOk={onSubmit} confirmLoading={loading} okText="Lưu" cancelText="Hủy">
      <Form form={form} layout="vertical">
        <Form.Item name="referral_code" label="Mã giới thiệu"
          rules={[{ required: true, message: 'Nhập mã giới thiệu' }]}
          extra={editing ? 'Không thể đổi mã nếu mã này đã được dùng trong lịch sử giới thiệu' : undefined}>
          <Input maxLength={50} placeholder="VD: CTV001" disabled={!!editing && Number(editing.referral_use_count ?? editing.referral_count ?? 0) > 0} />
        </Form.Item>
        <Form.Item name="name" label="Tên CTV" rules={[{ required: true, message: 'Nhập tên CTV' }]}><Input maxLength={255} /></Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="phone" label="SĐT" style={{ flex: 1 }}><Input maxLength={20} /></Form.Item>
          <Form.Item name="type" label="Loại" style={{ flex: 1 }}>
            <Select allowClear placeholder="Chọn loại" options={collaboratorTypes.map((t: string) => ({ value: t, label: typeMeta[t]?.label ?? t }))} />
          </Form.Item>
        </Space>
        <Form.Item name="commission_percent" label="% hoa hồng tham khảo" extra="Chỉ dùng làm gợi ý khi nhập tay tại mục Hoa hồng; không tự động tính.">
          <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={3} maxLength={2000} /></Form.Item>
        {editing && <Form.Item name="is_active" label="Trạng thái" rules={[{ required: true }]}>
          <Select options={[{ value: true, label: 'Đang hoạt động' }, { value: false, label: 'Đã ẩn' }]} />
        </Form.Item>}
      </Form>
    </Modal>
  )
}
