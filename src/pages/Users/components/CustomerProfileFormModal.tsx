import { Col, DatePicker, Form, Input, Modal, Row, Select } from 'antd'
import type { FormInstance } from 'antd'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import CustomerProfileCustomFields from './CustomerProfileCustomFields'
import type { CustomFieldDefWithOptions } from './CustomerProfileCustomFields'
import type { Branch } from '@/api/models/branch'
import type { CustomerProfileRow } from './CustomerProfileOverviewTab'

interface CustomerProfileFormModalProps {
  form: FormInstance
  open: boolean
  editing: CustomerProfileRow | null
  branches: Branch[]
  profileFieldDefs: CustomFieldDefWithOptions[]
  onCancel: () => void
  onOk: () => void
}

export default function CustomerProfileFormModal({ form, open, editing, branches, profileFieldDefs, onCancel, onOk }: CustomerProfileFormModalProps) {
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
      <Form form={form} layout="vertical" style={{ marginTop: 12, maxHeight: '68vh', overflowY: 'auto', paddingInlineEnd: 8 }}>
        <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input placeholder="VD: Nguyễn Thu Hà" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập SĐT' }]}>
              <Input placeholder="0901234568" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="email" label="Email">
              <Input placeholder="email@gmail.com" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
              <Select
                disabled={!!editing}
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                placeholder="Chọn cơ sở"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
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
          </Col>
        </Row>
        <CustomerProfileCustomFields definitions={profileFieldDefs} />
        <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
        <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
      </Form>
    </Modal>
  )
}
