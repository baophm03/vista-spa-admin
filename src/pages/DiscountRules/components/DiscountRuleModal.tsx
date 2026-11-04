import { Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Space, Switch } from 'antd'
import type { FormInstance } from 'antd'
import type { DiscountRule } from '@/api/models'
import { APPLIES_TO_OPTIONS, AUDIENCE_META } from './constants'

export default function DiscountRuleModal({ open, editing, form, saving, ranks, services, servicesLoading, onCancel, onSubmit }: {
  open: boolean
  editing: DiscountRule | null
  form: FormInstance
  saving?: boolean
  ranks: { id: string; name: string }[]
  services: { id: string; title: string }[]
  servicesLoading?: boolean
  onCancel: () => void
  onSubmit: () => void
}) {
  return (
    <Modal
      title={editing ? `Sửa quy tắc: ${editing.name}` : 'Thêm quy tắc giảm giá'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu" cancelText="Hủy"
      width={600}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="code" label="Mã" rules={[{ required: true, message: 'Nhập mã' }]}>
          <Input maxLength={50} placeholder="VD: RANK-VIP-10" disabled={!!editing} />
        </Form.Item>
        <Form.Item name="name" label="Tên" rules={[{ required: true, message: 'Nhập tên' }]}>
          <Input maxLength={150} placeholder="VD: Ưu đãi hạng VIP" />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(p, c) => p.audience !== c.audience}>
          {({ getFieldValue }) => {
            const isRank = getFieldValue('audience') === 'RANK'
            const span = isRank ? 8 : 12
            return (
              <Row gutter={12}>
                <Col span={span}>
                  <Form.Item name="audience" label="Đối tượng" rules={[{ required: true }]}>
                    <Select options={Object.entries(AUDIENCE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
                  </Form.Item>
                </Col>
                {isRank && (
                  <Col span={8}>
                    <Form.Item name="requires_rank_id" label="Hạng thẻ" rules={[{ required: true, message: 'Chọn hạng' }]}>
                      <Select
                        showSearch optionFilterProp="label"
                        options={ranks.map((r) => ({ value: r.id, label: r.name }))}
                        placeholder="Chọn hạng thẻ"
                      />
                    </Form.Item>
                  </Col>
                )}
                <Col span={span}>
                  <Form.Item name="applies_to" label="Áp vào" rules={[{ required: true }]}>
                    <Select options={APPLIES_TO_OPTIONS} />
                  </Form.Item>
                </Col>
              </Row>
            )
          }}
        </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="percent_min" label="% tối thiểu" rules={[{ required: true, message: 'Nhập % tối thiểu' }]} style={{ flex: 1 }}>
            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="percent_max" label="% tối đa" rules={[{ required: true, message: 'Nhập % tối đa' }]} style={{ flex: 1 }}>
            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max_total_percent" label="Trần tổng % xếp chồng" style={{ flex: 1 }} extra="Mặc định 50%">
            <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item noStyle shouldUpdate={(p, c) => p.applies_to !== c.applies_to}>
          {({ getFieldValue }) =>
            getFieldValue('applies_to') === 'SERVICE' ? (
              <Form.Item
                name="service_ids" label="Dịch vụ áp dụng"
                rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một dịch vụ' }]}
              >
                <Select
                  mode="multiple" showSearch optionFilterProp="label"
                  loading={servicesLoading}
                  placeholder="Chọn ít nhất một dịch vụ"
                  options={services.map((service) => ({ value: service.id, label: service.title }))}
                />
              </Form.Item>
            ) : null
          }
        </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="stackable" label="Xếp chồng được" valuePropName="checked" style={{ flex: 1 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="once_per_customer" label="1 lần mỗi khách" valuePropName="checked" style={{ flex: 1 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="show_in_app" label="Hiện trên app" valuePropName="checked" style={{ flex: 1 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="is_active" label="Đang dùng" valuePropName="checked" style={{ flex: 1 }}>
            <Switch />
          </Form.Item>
        </Space>
        <Form.Item name="valid_range" label="Hạn áp dụng">
          <DatePicker.RangePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
