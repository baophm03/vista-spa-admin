import { DatePicker, Form, Input, Modal } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import CustomerProfileCustomFields from './CustomerProfileCustomFields'
import type { CustomFieldDefWithOptions } from './CustomerProfileCustomFields'
import type { CustomerProfileRow } from './CustomerProfileOverviewTab'

interface CustomerProfileFormModalProps {
  form: FormInstance
  open: boolean
  editing: CustomerProfileRow | null
  profileFieldDefs: CustomFieldDefWithOptions[]
  onCancel: () => void
  onOk: () => void
}

export default function CustomerProfileFormModal({ form, open, editing, profileFieldDefs, onCancel, onOk }: CustomerProfileFormModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Lưu"
      cancelText="Hủy"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" className="customer-profile-form mt-3">
        <div className="grid grid-cols-2 gap-x-3">
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Nguyễn Thu Hà" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập SĐT' }]}>
            <Input placeholder="0901234568" inputMode="tel" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="email@gmail.com" inputMode="email" />
          </Form.Item>
          <Form.Item
            name="birthday"
            label="Ngày sinh"
            rules={[{
              validator: async (_, value: Dayjs | undefined) => {
                if (!value || value.isBefore(dayjs().startOf('day'), 'day')) return
                throw new Error('Ngày sinh phải trước ngày hiện tại')
              },
            }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD/MM/YYYY"
              disabledDate={(current) => !!current && !current.isBefore(dayjs().startOf('day'), 'day')}
            />
          </Form.Item>
        </div>
        <CustomerProfileCustomFields definitions={profileFieldDefs} />
        <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
        <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  )
}
