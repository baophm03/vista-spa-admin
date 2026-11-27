import { Button, Col, Form, Input, InputNumber, Modal, Row, Switch } from 'antd'
import type { FormInstance } from 'antd'
import { AvatarEditor } from '@/components/base/UserAvatar'
import { fileSrc, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { StaffProfile } from '@/api/models/staffProfile'
import type { UserRow } from './constants'

interface UserProfileModalProps {
  form: FormInstance
  open: boolean
  profileUser: UserRow | null
  canUpdate: boolean
  profileDetails: StaffProfile | undefined
  saving: boolean
  onCancel: () => void
  onOk: () => void
}

/** Ô ảnh đại diện trong form: ảnh hệ thống (đổi / gỡ) + ảnh Zalo bên cạnh. Lưu cùng nút "Lưu" của form. */
function StaffAvatarField({ value, onChange, initialId, initialSrc, zaloSrc, name, editable }: {
  value?: string | null
  onChange?: (value: string | null) => void
  initialId?: string | null
  initialSrc?: string | null
  zaloSrc?: string | null
  name?: string | null
  editable: boolean
}) {
  const urlMap = useFileUrlMap()
  const systemSrc = !value ? null : value === initialId ? initialSrc ?? resolveFileSrc(urlMap, value) : resolveFileSrc(urlMap, value)
  return (
    <AvatarEditor
      systemSrc={systemSrc}
      zaloSrc={zaloSrc}
      name={name}
      size={64}
      editable={editable}
      onChange={(fileId) => onChange?.(fileId)}
    />
  )
}

export default function UserProfileModal({ form, open, profileUser, canUpdate, profileDetails, saving, onCancel, onOk }: UserProfileModalProps) {
  const avatarSrc = fileSrc((profileDetails as any)?.photo_file)
  return (
    <Modal
      title={`Hồ sơ chuyên viên — ${profileUser?.zalo_name || profileUser?.email || ''}`}
      open={open}
      onCancel={onCancel}
      onOk={canUpdate ? onOk : undefined}
      footer={canUpdate ? undefined : <Button onClick={onCancel}>Đóng</Button>}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
    >
      <Form form={form} layout="vertical" className="mt-3">
        <Form.Item
          name="display_name"
          label="Tên hiển thị trên app"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên hiển thị' }]}
        >
          <Input disabled={!canUpdate} maxLength={255} placeholder="VD: KTV Minh" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="title" label="Chức danh">
              <Input disabled={!canUpdate} maxLength={255} placeholder="VD: Chuyên viên da liễu" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="expertise" label="Chuyên môn chính">
              <Input disabled={!canUpdate} maxLength={500} placeholder="VD: Trị mụn, trẻ hóa" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="bio" label="Giới thiệu tóm tắt">
          <Input.TextArea disabled={!canUpdate} rows={3} maxLength={2000} placeholder="Tiểu sử ngắn hiển thị trên Mini App" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="photo_file_id" label="Ảnh đại diện">
              <StaffAvatarField
                initialId={(profileDetails as any)?.photo_file?.id ?? (profileDetails as any)?.photo_file_id}
                initialSrc={avatarSrc}
                zaloSrc={profileUser?.zalo_avatar}
                name={profileUser?.zalo_name || profileUser?.email}
                editable={canUpdate}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="sort_order" label="Thứ tự sắp xếp" initialValue={0}>
              <InputNumber disabled={!canUpdate} min={0} className="w-full!" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="show_in_app" label="Hiển thị trên Mini App" valuePropName="checked" initialValue={true}>
          <Switch disabled={!canUpdate} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
