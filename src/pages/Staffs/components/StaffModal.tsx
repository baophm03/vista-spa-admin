import { Col, Form, Input, Modal, Row, Select } from 'antd'
import type { FormInstance } from 'antd'
import type { Branch } from '@/api/models/branch'
import type { StaffRow } from './constants'

interface StaffModalProps {
  form: FormInstance
  open: boolean
  editing: StaffRow | null
  branches: Branch[]
  roles: { id: string; role_name: string; code: string | null }[]
  branchRequired: boolean
  onCancel: () => void
  onOk: () => void
}

export default function StaffModal({ form, open, editing, branches, roles, branchRequired, onCancel, onOk }: StaffModalProps) {
  return (
    <Modal
      title={editing ? 'Sửa chuyên viên' : 'Thêm chuyên viên'}
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="Lưu"
      cancelText="Hủy"
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
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
              rules={branchRequired ? [{ required: true, message: 'Chọn cơ sở cho nhân viên/KTV' }] : []}
              extra={branchRequired ? undefined : 'Để trống nếu tài khoản quản trị cần truy cập toàn hệ thống.'}
            >
              <Select
                style={{ width: '100%' }}
                allowClear={!branchRequired}
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                placeholder={branchRequired ? 'Chọn cơ sở' : 'Chọn cơ sở hoặc để trống'}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="phone_number"
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
                style={{ width: '100%' }}
                allowClear
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
