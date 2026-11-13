import { DatePicker, Form, Input, InputNumber, Modal, Select, Space, Switch } from 'antd'
import type { FormInstance } from 'antd'
import type { Branch, CommissionRule, Service, User } from '@/api/models'
import { BASE_OPTIONS, PAYEE_META, type PayeeType } from './constants'

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
        }}
      >
        <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Nhập tên quy tắc' }]}>
          <Input maxLength={150} placeholder="VD: Hoa hồng KTV dịch vụ mặt" />
        </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="payee_type" label="Người nhận" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={Object.entries(PAYEE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
          </Form.Item>
          <Form.Item name="base" label="Tính hoa hồng theo" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select
              options={BASE_OPTIONS.filter((option) => option.value === (payeeType === 'STAFF' ? 'SESSION_VALUE' : 'PAYMENT'))}
            />
          </Form.Item>
          <Form.Item name="percent" label="% hoa hồng" extra="Để trống nếu chưa có tỷ lệ cố định." style={{ flex: 1 }}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} placeholder="Không tự động tính" />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="service_id" label="Dịch vụ (không bắt buộc)" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" loading={servicesLoading} placeholder="Tất cả dịch vụ"
              options={services.map((service) => ({ value: service.id, label: service.title }))} />
          </Form.Item>
          {payeeType === 'STAFF' && (
            <Form.Item name="staff_id" label="KTV (không bắt buộc)" style={{ flex: 1 }}>
              <Select allowClear showSearch optionFilterProp="label" loading={usersLoading} placeholder="Tất cả KTV"
                options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))} />
            </Form.Item>
          )}
          <Form.Item name="branch_id" label="Cơ sở (không bắt buộc)" style={{ flex: 1 }}>
            <Select allowClear showSearch optionFilterProp="label" loading={branchesLoading} placeholder="Toàn hệ thống"
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
          </Form.Item>
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="priority" label="Mức ưu tiên" style={{ flex: 1 }} extra="Số càng cao càng ưu tiên khi nhiều rule khớp">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="valid_range" label="Hạn áp dụng" style={{ flex: 2 }}>
            <DatePicker.RangePicker allowEmpty={[true, true]} style={{ width: '100%' }} />
          </Form.Item>
        </Space>
        <Form.Item name="is_active" label="Đang dùng" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  )
}
