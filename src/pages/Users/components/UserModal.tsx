import { Col, Form, Input, Modal, Row, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { Branch } from '@/api/models/branch'
import type { UserRow } from './constants'

interface UserModalProps {
  form: FormInstance
  open: boolean
  editing: UserRow | null
  branches: Branch[]
  roles: { id: string; role_name: string; code: string | null }[]
  canEditAccess: boolean
  onCancel: () => void
  onOk: () => void
}

export default function UserModal({ form, open, editing, branches, roles, canEditAccess, onCancel, onOk }: UserModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa tài khoản' : 'Thêm tài khoản'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" className="mt-3">
        <Form.Item name="zalo_name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
          <Input placeholder="VD: Trần Hoa" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, message: 'Nhập email' }, { type: 'email', message: 'Email không hợp lệ' }]}
            >
              <Input placeholder="nhanvien@vista.vn" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="branch_id"
              label="Cơ sở"
              rules={[{ required: true, message: 'Chọn cơ sở cho nhân viên/KTV' }]}
            >
              <Select
                className="w-full"
                showSearch
                optionFilterProp="label"
                disabled={!canEditAccess}
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                placeholder="Chọn cơ sở"
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="phone"
              label="SĐT (đăng nhập)"
              rules={[{ required: true, message: 'Nhập SĐT' }]}
            >
              <Input placeholder="0901 111 222" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            {editing ? (
              <Form.Item
                name="password"
                label="Mật khẩu mới"
                extra="Để trống nếu không đổi mật khẩu."
              >
                <Input.Password placeholder="••••••••" autoComplete="new-password" />
              </Form.Item>
            ) : (
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            )}
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="role_id" label="Vai trò" rules={[{ required: true, message: 'Chọn vai trò' }]}>
              <Select
                className="w-full"
                allowClear
                disabled={!canEditAccess}
                options={roles.map((r) => ({ value: r.id, label: r.role_name }))}
                placeholder="Chọn vai trò"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}
