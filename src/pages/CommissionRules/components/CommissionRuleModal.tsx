import { Col, Form, Input, InputNumber, Modal, Row, Select, Switch, Tag, Typography } from 'antd'
import type { FormInstance } from 'antd'
import type { CommissionRule, User } from '@/api/models'
import { PAYEE_META, RULE_TYPE_META, TYPE_ROLE_CODE, type RuleTaskType } from './constants'

/** Kiểu giá trị hoa hồng: % theo doanh thu hoặc số tiền cố định mỗi lần phát sinh. */
export type RateType = 'PERCENT' | 'AMOUNT'

const RATE_TYPE_OPTIONS: { value: RateType; label: string }[] = [
  { value: 'PERCENT', label: 'Phần trăm (%)' },
  { value: 'AMOUNT', label: 'Số tiền cố định' },
]

interface Props {
  open: boolean
  /** null = tạo mới; có giá trị = sửa (name/type/base cố định) */
  editing: CommissionRule | null
  form: FormInstance
  saving: boolean
  users: User[]
  usersLoading: boolean
  customers: User[]
  customersLoading: boolean
  onCancel: () => void
  onSubmit: () => void
}

export default function CommissionRuleModal({
  open,
  editing,
  form,
  saving,
  users,
  usersLoading,
  customers,
  customersLoading,
  onCancel,
  onSubmit,
}: Props) {
  const rateType = (Form.useWatch('rate_type', form) as RateType | undefined) ?? 'PERCENT'
  const createType = Form.useWatch('type', form) as RuleTaskType | undefined
  // Quy tắc cố định: name/payee_role/base không cho sửa khi sửa rule — chỉ chỉnh giá trị + phạm vi + bật/ngắt.
  const isEdit = !!editing
  const taskType = (editing?.type ?? createType) as RuleTaskType | undefined
  const payeeRoleCode = taskType ? TYPE_ROLE_CODE[taskType] : undefined
  const payeeMeta = payeeRoleCode ? PAYEE_META[payeeRoleCode] : undefined

  // Cùng điều kiện kích hoạt vẫn tạo được nhiều rule (người cụ thể khác nhau) — trùng thì BE chặn 409
  const typeOptions = (Object.keys(RULE_TYPE_META) as RuleTaskType[]).map((type) => ({
    value: type,
    label: RULE_TYPE_META[type].label,
  }))

  return (
    <Modal
      title={editing ? `Sửa quy tắc: ${editing.name}` : 'Thêm quy tắc hoa hồng'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu" cancelText="Hủy"
      width={640}
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 12 }}
        onValuesChange={(changed) => {
          // Hai kiểu giá trị loại trừ nhau — đổi kiểu thì xóa giá trị của kiểu kia.
          if (changed.rate_type) {
            form.setFieldsValue(changed.rate_type === 'AMOUNT' ? { percent: undefined } : { fixed_amount: undefined })
          }
        }}
      >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item
              name="name" label="Tên quy tắc"
              rules={[{ required: true, message: 'Nhập tên quy tắc' }]}
            >
              <Input maxLength={150} placeholder="VD: Hoa hồng KTV dịch vụ mặt" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="type" label="Kích hoạt khi"
              rules={isEdit ? [] : [{ required: true, message: 'Chọn kích hoạt khi' }]}
            >
              <Select
                placeholder="Chọn kích hoạt khi"
                options={typeOptions}
                disabled={isEdit}
              />
            </Form.Item>
          </Col>
          {/* Người nhận tự suy từ điều kiện kích hoạt đã chọn — role làm title của ô chọn người cụ thể */}
          <Col span={12}>
            {payeeMeta ? (
              <Form.Item
                name="staff_id"
                label={(
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Tag color={payeeMeta.color} style={{ marginInlineEnd: 0 }}>{payeeMeta.label}</Tag>
                    <span>(không bắt buộc)</span>
                  </span>
                )}
              >
                {payeeRoleCode === 'staff' ? (
                  <Select allowClear showSearch optionFilterProp="label" loading={usersLoading} placeholder="Tất cả KTV"
                    options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
                ) : (
                  <Select allowClear showSearch optionFilterProp="label" loading={customersLoading} placeholder="Tất cả khách hàng cũ"
                    options={customers.map((user) => ({ value: user.id, label: user.zalo_name || user.phone_number || user.email || user.id }))} />
                )}
              </Form.Item>
            ) : (
              <Form.Item label="Người nhận">
                <Typography.Text type="secondary" style={{ marginTop: 8, display: 'block' }}>Chọn kích hoạt khi để xem</Typography.Text>
              </Form.Item>
            )}
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="rate_type" label="Kiểu hoa hồng" rules={[{ required: true }]}>
              <Select options={RATE_TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            {rateType === 'AMOUNT' ? (
              <Form.Item
                name="fixed_amount" label="Số tiền cố định (₫)"
                extra="Trả đúng số tiền này cho mỗi lần phát sinh (mỗi thanh toán / buổi hoàn thành)."
              >
                <InputNumber min={0} precision={0} step={1000} style={{ width: '100%' }} placeholder="VD: 50000" />
              </Form.Item>
            ) : (
              <Form.Item name="percent" label="% hoa hồng" rules={[{ required: true, message: 'Nhập % hoa hồng' }]}>
                <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} placeholder="VD: 10" />
              </Form.Item>
            )}
          </Col>
        </Row>
        <Form.Item name="is_active" label="Đang dùng" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
