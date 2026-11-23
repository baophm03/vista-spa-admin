import {
  DatePicker,
  Form,
  type FormInstance,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
} from 'antd'
import { TYPE_META, type RewardRow } from './constants'

export interface RewardVoucherOption {
  value: string
  label: string
  category: string
  disabled?: boolean
}

interface RewardModalProps {
  open: boolean
  editing: RewardRow | null
  onCancel: () => void
  onSubmit: () => void
  confirmLoading: boolean
  form: FormInstance
  vouchers: RewardVoucherOption[]
}

export default function RewardModal({
  open,
  editing,
  onCancel,
  onSubmit,
  confirmLoading,
  form,
  vouchers,
}: RewardModalProps) {
  const selectedType = Form.useWatch('type', form)
  const selectedVoucherKind = Form.useWatch('voucher_kind', form)
  const voucherKinds = [
    { value: 'treatment-package', label: 'Gói liệu trình' },
    { value: 'academy-course', label: 'Khóa học' },
    { value: 'product', label: 'Sản phẩm' },
  ]
  const selectedVouchers = vouchers.filter((voucher) => voucher.category === selectedVoucherKind)

  return (
    <Modal
      title={editing ? 'Sửa quà' : 'Thêm quà'}
      width="min(800px, calc(100vw - 24px))"
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
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-[minmax(0,180px)_minmax(0,200px)_minmax(0,1fr)]">
          <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
            <Select options={Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))} />
          </Form.Item>
          {selectedType === 'VOUCHER' && (
            <>
              <Form.Item name="voucher_kind" label="Nhóm voucher" rules={[{ required: true, message: 'Chọn nhóm voucher' }]}>
                <Select
                  placeholder="Chọn nhóm"
                  options={voucherKinds}
                  onChange={() => form.setFieldValue('voucher_reference', undefined)}
                />
              </Form.Item>
              <Form.Item
                name="voucher_reference"
                label="Loại Voucher"
                rules={[{ required: true, message: 'Chọn voucher sẽ cấp' }]}
                extra="Chỉ chọn được voucher đang trong thời gian hiệu lực."
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={selectedVoucherKind ? 'Chọn voucher' : 'Trước tiên chọn nhóm voucher'}
                  disabled={!selectedVoucherKind}
                  options={selectedVouchers}
                  optionRender={(option) => <div className="whitespace-normal wrap-anywhere">{option.label}</div>}
                />
              </Form.Item>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-3 md:grid-cols-4 md:gap-x-4">
          <Form.Item name="points_cost" label="Điểm quy đổi" rules={[{ required: true }, { type: 'number', min: 1, message: 'Tối thiểu 1 điểm' }]} style={{ flex: 1, minWidth: 0 }}>
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="quantity_total" label="Số lượng" rules={[{ type: 'number', min: 0 }]} style={{ flex: 1, minWidth: 0 }}>
            <InputNumber min={0} precision={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
          </Form.Item>
          <Form.Item name="valid_from" label="Bắt đầu" rules={[{ required: true, message: 'Chọn ngày bắt đầu' }]} style={{ flex: 1, minWidth: 0 }}>
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
          </Form.Item>
          <Form.Item
            name="valid_to"
            label="Kết thúc"
            style={{ flex: 1, minWidth: 0 }}
            rules={[
              { required: true, message: 'Chọn ngày kết thúc' },
              ({ getFieldValue }) => ({
                validator: async (_rule, value) => {
                  const from = getFieldValue('valid_from')
                  if (!value || !from) return
                  if (value.isBefore(from, 'day')) throw new Error('Ngày kết thúc phải sau ngày bắt đầu')
                },
              }),
            ]}
            dependencies={['valid_from']}
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Chọn ngày" />
          </Form.Item>
        </div>
        <Form.Item name="description" label="Mô tả"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
        <Form.Item name="is_active" label="Đang đổi" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  )
}

