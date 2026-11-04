import {
  DatePicker,
  Form,
  type FormInstance,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
} from 'antd'
import type { Voucher } from '@/api/models/voucher'
import type { Service } from '@/api/models/service'
import { TYPE_META, type RewardRow } from './constants'

interface RewardModalProps {
  open: boolean
  editing: RewardRow | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
  vouchers: Voucher[]
  services: Service[]
  servicesQueryLoading: boolean
}

export default function RewardModal({
  open,
  editing,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
  vouchers,
  services,
  servicesQueryLoading,
}: RewardModalProps) {
  const selectedType = Form.useWatch('type', form)

  return (
    <Modal
      title={editing ? 'Sửa quà' : 'Thêm quà'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={confirmLoading}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item name="name" label="Tên quà" rules={[{ required: true, message: 'Nhập tên quà' }]}>
          <Input maxLength={255} placeholder="VD: Nước tẩy trang Kahanna" />
        </Form.Item>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="type" label="Loại" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Select options={Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
          </Form.Item>
          {selectedType === 'VOUCHER' && (
            <Form.Item name="voucher_id" label="Voucher cấp" rules={[{ required: true, message: 'Chọn voucher sẽ cấp' }]} style={{ flex: 1 }}>
              <Select
                showSearch
                optionFilterProp="label"
                options={vouchers.filter((v) => v.is_active !== false).map((v) => ({ value: v.id, label: v.title }))}
              />
            </Form.Item>
          )}
        </Space>
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="points_cost" label="Điểm đổi" rules={[{ required: true }, { type: 'number', min: 1, message: 'Tối thiểu 1 điểm' }]} style={{ flex: 1 }}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quantity_total" label="Số lượng (trống = không giới hạn)" rules={[{ type: 'number', min: 0 }]} style={{ flex: 1 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
          </Form.Item>
        </Space>
        {selectedType === 'BENEFIT' && (
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item
              name="benefit_amount"
              label="Mức giảm cố định"
              extra="Để trống nếu quyền lợi không giảm tiền."
              rules={[{ type: 'number', min: 1, message: 'Mức giảm phải lớn hơn 0' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} precision={0} style={{ width: '100%' }} suffix="đ" />
            </Form.Item>
            <Form.Item
              name="service_id"
              label="Dịch vụ áp dụng"
              dependencies={['benefit_amount']}
              rules={[({ getFieldValue }) => ({
                validator: async (_rule, value) => getFieldValue('benefit_amount') != null && !value
                  ? Promise.reject(new Error('Chọn dịch vụ áp dụng cho mức giảm'))
                  : Promise.resolve(),
              })]}
              style={{ flex: 1 }}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={servicesQueryLoading}
                placeholder="Chọn dịch vụ"
                options={services.filter((service) => service.is_active !== false).map((service) => ({ value: service.id, label: service.title }))}
              />
            </Form.Item>
          </Space>
        )}
        <Space style={{ display: 'flex' }} align="start">
          <Form.Item name="valid_from" label="Bắt đầu" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="valid_to" label="Kết thúc" style={{ flex: 1 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
          </Form.Item>
        </Space>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
        <Form.Item name="is_active" label="Đang đổi" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  )
}

