import { Button, Collapse, DatePicker, Divider, Form, type FormInstance, Input, Modal, Select, Typography } from 'antd'
import type { CustomerHealthRecord } from '@/api/models/customerHealthRecord'
import {
  labelStyle,
  type ExaminerOption,
  type HealthRow,
  type SkinTypeOption,
} from './constants'

interface HealthRecordModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: () => void
  saving: boolean
  editingRecord: CustomerHealthRecord | null
  recordCustomer: HealthRow | null
  form: FormInstance
  staffs: ExaminerOption[]
  skinTypes: SkinTypeOption[]
  skinTypesLoading: boolean
}

export default function HealthRecordModal({
  open,
  onCancel,
  onSubmit,
  saving,
  editingRecord,
  recordCustomer,
  form,
  staffs,
  skinTypes,
  skinTypesLoading,
}: HealthRecordModalProps) {
  return (
    <Modal
      title={editingRecord ? 'Sửa phiếu khám' : 'Tạo phiếu khám'}
      open={open}
      onCancel={onCancel}
      width={720}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onCancel}>Hủy</Button>,
        <Button key="save" type="primary" loading={saving} onClick={onSubmit}>
          {editingRecord ? 'Lưu thay đổi' : 'Lưu phiếu khám'}
        </Button>,
      ]}
    >
      {recordCustomer && (
        <>
          <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 18 }}>
            {recordCustomer.full_name} · {recordCustomer.phone} · {recordCustomer.customer_code}
          </Typography.Text>
          <Form form={form} layout="vertical" requiredMark={false}>
            <Divider orientation="horizontal" titlePlacement="start" plain style={{ marginTop: 0, color: '#52635A', fontSize: 13 }}>Thông tin khám</Divider>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <Form.Item name="checked_date" label={<span style={labelStyle}>Ngày khám</span>} rules={[{ required: true, message: 'Chọn ngày khám' }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="checked_by" label={<span style={labelStyle}>Người khám</span>}>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder="Chọn chuyên viên"
                  options={staffs.map((staff) => {
                    const name = staff.zalo_name || staff.email || staff.id.slice(0, 8)
                    return { value: name, label: name }
                  })}
                />
              </Form.Item>
              <Form.Item name="skin_type" label={<span style={labelStyle}>Loại da</span>}>
                <Select
                  allowClear
                  loading={skinTypesLoading}
                  disabled={skinTypesLoading || skinTypes.length === 0}
                  placeholder={skinTypesLoading ? 'Đang tải loại da...' : 'Chọn loại da'}
                  notFoundContent="Chưa có loại da được cấu hình"
                  options={skinTypes.map((type) => ({ value: type.code, label: type.label }))}
                />
              </Form.Item>
              <Form.Item name="allergies" label={<span style={labelStyle}>Dị ứng</span>}>
                <Input placeholder="Ví dụ: hương liệu, cồn khô" />
              </Form.Item>
            </div>
            <Form.Item name="medical_history" label={<span style={labelStyle}>Tiền sử bệnh lý</span>}>
              <Input.TextArea rows={2} placeholder="Bệnh lý, thuốc đang sử dụng, lưu ý sức khỏe..." />
            </Form.Item>
            <Form.Item name="condition" label={<span style={labelStyle}>Tình trạng da</span>} rules={[{ required: true, whitespace: true, message: 'Nhập tình trạng da' }]}>
              <Input.TextArea rows={3} placeholder="Mô tả tình trạng da khi khám..." />
            </Form.Item>
            <Collapse
              ghost
              style={{ marginTop: 8, background: '#F7FAF8', borderRadius: 12, padding: '0 12px' }}
              items={[{
                key: 'treatment-details',
                forceRender: true,
                label: (
                  <div>
                    <Typography.Text strong>Điều trị và ghi chú</Typography.Text>
                    <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>Tùy chọn</Typography.Text>
                  </div>
                ),
                children: (
                  <>
                    <Form.Item name="protocol" label={<span style={labelStyle}>Phác đồ điều trị</span>}>
                      <Input.TextArea rows={2} placeholder="Các bước và kế hoạch điều trị..." />
                    </Form.Item>
                    <Form.Item name="products_used" label={<span style={labelStyle}>Sản phẩm đã dùng</span>}>
                      <Input.TextArea rows={2} placeholder="Nhập tên sản phẩm đã sử dụng trong lần khám này..." />
                    </Form.Item>
                    <Form.Item name="advice" label={<span style={labelStyle}>Lời dặn KTV</span>}>
                      <Input.TextArea rows={2} placeholder="Hướng dẫn chăm sóc hoặc lưu ý cho khách..." />
                    </Form.Item>
                    <Form.Item name="note" label={<span style={labelStyle}>Ghi chú</span>} style={{ marginBottom: 0 }}>
                      <Input.TextArea rows={2} placeholder="Ghi chú thêm cho lần khám..." />
                    </Form.Item>
                  </>
                ),
              }]}
            />
          </Form>
        </>
      )}
    </Modal>
  )
}
