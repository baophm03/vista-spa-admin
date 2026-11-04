import { Alert, Col, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import type { PackageTypeForm, PackageTypeRow, QuotaType } from './constants'
import { PACKAGE_TYPE_QUOTA_OPTIONS } from './constants'

interface TreatmentTypeModalProps {
  form: FormInstance<PackageTypeForm>
  open: boolean
  editing: PackageTypeRow | null
  selectedDefaultQuota: QuotaType | undefined
  saving: boolean
  onCancel: () => void
  onOk: () => void
}

export default function TreatmentTypeModal({ form, open, editing, selectedDefaultQuota, saving, onCancel, onOk }: TreatmentTypeModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa loại gói' : 'Thêm loại gói'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      width="min(760px, calc(100vw - 24px))"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="code"
              label="Mã loại"
              rules={[
                { required: true, whitespace: true, message: 'Nhập mã loại' },
                { pattern: /^[A-Z][A-Z0-9_]{0,49}$/, message: 'Dùng chữ in hoa, số hoặc dấu gạch dưới; ví dụ COMBO' },
              ]}
            >
              <Input disabled={!!editing} placeholder="VD: COMBO" onChange={(event) => form.setFieldValue('code', event.target.value.toUpperCase())} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="name" label="Tên loại" rules={[{ required: true, whitespace: true, message: 'Nhập tên loại' }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="default_quota_type" label="Hạn mức mặc định" rules={[{ required: true }]}>
              <Select
                options={PACKAGE_TYPE_QUOTA_OPTIONS}
                onChange={(value: QuotaType) => {
                  if (value === 'UNLIMITED') form.setFieldsValue({ has_warranty: true, allow_unlimited: true })
                }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="sort_order" label="Thứ tự hiển thị">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        {selectedDefaultQuota === 'UNLIMITED' && <Alert type="info" showIcon message="Loại trọn gói cần bật bảo hành và cho phép không giới hạn." style={{ marginBottom: 12 }} />}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="has_warranty" label="Có bảo hành" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="allow_unlimited" label="Cho phép trọn gói" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          {editing && (
            <Col span={8}>
              <Form.Item name="is_active" label="Đang sử dụng" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          )}
        </Row>
      </Form>
    </Modal>
  )
}
