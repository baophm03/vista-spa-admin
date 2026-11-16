import { Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import type { FormInstance } from 'antd'
import type { Branch, CommissionRule, Service, User } from '@/api/models'
import { BASE_OPTIONS, PAYEE_META, type PayeeType } from './constants'

/** Kiểu giá trị hoa hồng: % theo doanh thu hoặc số tiền cố định mỗi lần phát sinh. */
export type RateType = 'PERCENT' | 'AMOUNT'

const RATE_TYPE_OPTIONS: { value: RateType; label: string }[] = [
  { value: 'PERCENT', label: 'Phần trăm (%)' },
  { value: 'AMOUNT', label: 'Số tiền cố định' },
]

interface Props {
  open: boolean
  editing: CommissionRule | null
  form: FormInstance
  saving: boolean
  services: Service[]
  servicesLoading: boolean
  users: User[]
  usersLoading: boolean
  branches: Branch[]
  branchesLoading: boolean
  onCancel: () => void
  onSubmit: () => void
}

export default function CommissionRuleModal({
  open,
  editing,
  form,
  saving,
  services,
  servicesLoading,
  users,
  usersLoading,
  branches,
  branchesLoading,
  onCancel,
  onSubmit,
}: Props) {
  const payeeType = Form.useWatch('payee_type', form) as PayeeType | undefined
  const rateType = (Form.useWatch('rate_type', form) as RateType | undefined) ?? 'PERCENT'
  return (
    <Modal
      title={editing ? `Sửa quy tắc: ${editing.name}` : 'Thêm quy tắc hoa hồng'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu" cancelText="Hủy"
      width={680}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 12 }}
        onValuesChange={(changed) => {
          if (changed.payee_type) {
            form.setFieldValue('base', changed.payee_type === 'STAFF' ? 'SESSION_VALUE' : 'PAYMENT')
            if (changed.payee_type !== 'STAFF') form.setFieldValue('staff_id', undefined)
          }
          // Hai kiểu giá trị loại trừ nhau — đổi kiểu thì xóa giá trị của kiểu kia.
          if (changed.rate_type) {
            form.setFieldsValue(changed.rate_type === 'AMOUNT' ? { percent: undefined } : { fixed_amount: undefined })
          }
        }}
      >
        <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Nhập tên quy tắc' }]}>
          <Input maxLength={150} placeholder="VD: Hoa hồng KTV dịch vụ mặt" />
        </Form.Item>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="payee_type" label="Người nhận" rules={[{ required: true }]}>
              <Select options={Object.entries(PAYEE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="base" label="Tính hoa hồng theo" rules={[{ required: true }]}>
              <Select
                options={BASE_OPTIONS.filter((option) => option.value === (payeeType === 'STAFF' ? 'SESSION_VALUE' : 'PAYMENT'))}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="rate_type" label="Kiểu hoa hồng" rules={[{ required: true }]}>
              <Select options={RATE_TYPE_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            {rateType === 'AMOUNT' ? (
              <Form.Item
                name="fixed_amount" label="Số tiền cố định (₫)"
                extra="Trả đúng số tiền này cho mỗi lần phát sinh (mỗi thanh toán / buổi hoàn thành)."
              >
                <InputNumber min={0} precision={0} step={1000} style={{ width: '100%' }} placeholder="VD: 50000" />
              </Form.Item>
            ) : (
              <Form.Item name="percent" label="% hoa hồng" extra="Để trống nếu chưa có tỷ lệ cố định.">
                <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} placeholder="Không tự động tính" />
              </Form.Item>
            )}
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={payeeType === 'STAFF' ? 8 : 12}>
            <Form.Item name="service_id" label="Dịch vụ (không bắt buộc)">
              <Select allowClear showSearch optionFilterProp="label" loading={servicesLoading} placeholder="Tất cả dịch vụ"
                options={services.map((service) => ({ value: service.id, label: service.title }))} />
            </Form.Item>
          </Col>
          {payeeType === 'STAFF' && (
            <Col span={8}>
              <Form.Item name="staff_id" label="KTV (không bắt buộc)">
                <Select allowClear showSearch optionFilterProp="label" loading={usersLoading} placeholder="Tất cả KTV"
                  options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
              </Form.Item>
            </Col>
          )}
          <Col span={payeeType === 'STAFF' ? 8 : 12}>
            <Form.Item name="branch_id" label="Cơ sở (không bắt buộc)">
              <Select allowClear showSearch optionFilterProp="label" loading={branchesLoading} placeholder="Toàn hệ thống"
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="priority" label="Mức ưu tiên" extra="Số càng cao càng ưu tiên khi nhiều rule khớp">
              <InputNumber min={0} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="valid_range" label="Hạn áp dụng">
              <DatePicker.RangePicker allowEmpty={[true, true]} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="is_active" label="Đang dùng" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
