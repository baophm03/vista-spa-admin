import { useEffect, useState } from 'react'
import { Form, Input, InputNumber, Modal, Select, Space } from 'antd'
import { pickData } from '@/api/helpers'
import { useGetUsers } from '@/api/endpoints/users'
import { useGetCustomerProfiles } from '@/api/endpoints/customer-profiles'
import type { CustomerProfile, User } from '@/api/models'

/**
 * Form CTV — loại STAFF phải gắn nhân viên, loại CUSTOMER phải gắn khách hàng
 * (đặc tả 5.26: "CTV cũng là khách/nhân viên"); Bên ngoài thì khai tay.
 */
export default function CollaboratorModal({ editing, open, onClose, onSubmit, loading, form, collaboratorTypes, typeMeta }: any) {
  const typeValue = Form.useWatch('type', form) as string | undefined
  const [customerSearch, setCustomerSearch] = useState('')

  const usersQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true }, { query: { enabled: open } })
  const users = (pickData<{ rows?: User[] } | undefined>(usersQuery.data)?.rows ?? pickData<User[]>(usersQuery.data) ?? []) as User[]

  // Khách hàng nhiều (hàng nghìn) → tìm theo từ khóa thay vì tải cả danh sách
  const customersQuery = useGetCustomerProfiles(
    { page: 1, limit: 20, q: customerSearch || undefined },
    { query: { enabled: open } },
  )
  const customers = (pickData<CustomerProfile[] | undefined>(customersQuery.data) ?? []) as CustomerProfile[]

  // Sửa CTV loại Khách: tìm sẵn đúng khách đang liên kết để select hiển thị tên thay vì UUID
  useEffect(() => {
    if (open && editing?.customer_profile_id) setCustomerSearch(editing.name ?? '')
    if (!open) setCustomerSearch('')
  }, [open, editing])

  return (
    <Modal title={editing ? `Sửa CTV: ${editing.name}` : 'Thêm cộng tác viên'} open={open} onCancel={onClose}
      onOk={onSubmit} confirmLoading={loading} okText="Lưu" cancelText="Hủy">
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changed) => {
          if (Object.prototype.hasOwnProperty.call(changed, 'type')) {
            // Đổi loại thì gỡ liên kết cũ — mỗi loại gắn một đối tượng riêng
            form.setFieldsValue({ user_id: undefined, customer_profile_id: undefined })
          }
          if (Object.prototype.hasOwnProperty.call(changed, 'user_id') && changed.user_id) {
            const user = users.find((item) => item.id === changed.user_id)
            if (user) form.setFieldsValue({ name: user.zalo_name || user.email || form.getFieldValue('name') })
          }
          if (Object.prototype.hasOwnProperty.call(changed, 'customer_profile_id') && changed.customer_profile_id) {
            const customer = customers.find((item) => item.id === changed.customer_profile_id)
            if (customer) {
              form.setFieldsValue({
                name: customer.full_name || form.getFieldValue('name'),
                phone: customer.phone ?? '',
              })
            }
          }
        }}
      >
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
        {typeValue === 'STAFF' && (
          <Form.Item
            name="user_id" label="Nhân viên liên kết"
            rules={[{ required: true, message: 'CTV loại Nhân viên phải chọn nhân viên' }]}
            extra="Gắn CTV với tài khoản nhân viên — tên CTV tự đi theo khi chọn."
          >
            <Select
              showSearch optionFilterProp="label" loading={usersQuery.isLoading}
              placeholder="Chọn nhân viên"
              options={users.map((user) => ({ value: user.id, label: user.zalo_name || user.email || user.id }))}
            />
          </Form.Item>
        )}
        {typeValue === 'CUSTOMER' && (
          <Form.Item
            name="customer_profile_id" label="Khách hàng liên kết"
            rules={[{ required: true, message: 'CTV loại Khách hàng phải chọn khách hàng' }]}
            extra="Gõ để tìm theo tên/SĐT — tên và SĐT CTV tự đi theo khi chọn."
          >
            <Select
              showSearch optionFilterProp="label" filterOption={false}
              loading={customersQuery.isLoading}
              onSearch={setCustomerSearch}
              placeholder="Tìm khách hàng"
              notFoundContent={customersQuery.isLoading ? 'Đang tìm…' : 'Không thấy khách hàng'}
              options={customers.map((customer) => ({
                value: customer.id,
                label: [customer.full_name, customer.phone].filter(Boolean).join(' · ') || customer.id,
              }))}
            />
          </Form.Item>
        )}
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
