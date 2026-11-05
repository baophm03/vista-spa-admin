import { Button, Col, Form, Image, Input, InputNumber, Modal, Row, Switch, Typography } from 'antd'
import type { FormInstance } from 'antd'
import ServiceImageField from '@/components/ServiceImageField'
import { fileSrc } from '@/hooks/useFileUrl'
import type { StaffProfileRow } from '@/api/models/staffProfileRow'
import type { StaffRow } from './constants'

interface StaffProfileModalProps {
  form: FormInstance
  open: boolean
  profileUser: StaffRow | null
  canUpdate: boolean
  profileDetails: StaffProfileRow | undefined
  saving: boolean
  onCancel: () => void
  onOk: () => void
}

export default function StaffProfileModal({ form, open, profileUser, canUpdate, profileDetails, saving, onCancel, onOk }: StaffProfileModalProps) {
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
            {canUpdate ? (
              <Form.Item name="photo_file_id" label="Ảnh đại diện">
                <ServiceImageField />
              </Form.Item>
            ) : (
              <Form.Item label="Ảnh đại diện">
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt="Ảnh đại diện KTV"
                    width={72}
                    height={72}
                    className="rounded-md object-cover"
                  />
                ) : (
                  <Typography.Text type="secondary">Chưa có ảnh</Typography.Text>
                )}
              </Form.Item>
            )}
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
