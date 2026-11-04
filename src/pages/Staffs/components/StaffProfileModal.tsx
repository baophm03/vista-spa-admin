import {
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Switch,
  Button,
  Image,
  Typography,
} from 'antd'
import type { FormInstance } from 'antd'
import ServiceImageField from '@/components/ServiceImageField'
import type { StaffProfileRow } from '@/api/models/staffProfileRow'
import type { StaffRow } from './constants'

interface StaffProfileModalProps {
  open: boolean
  profileUser: StaffRow | null
  profileForm: FormInstance
  canUpdateStaffProfile: boolean
  profileDetails: StaffProfileRow | undefined
  confirmLoading: boolean
  onCancel: () => void
  onOk: () => void
}

export default function StaffProfileModal({
  open,
  profileUser,
  profileForm,
  canUpdateStaffProfile,
  profileDetails,
  confirmLoading,
  onCancel,
  onOk,
}: StaffProfileModalProps) {
  return (
    <Modal
      title={`Hồ sơ chuyên viên — ${profileUser?.zalo_name || profileUser?.email || ''}`}
      open={open}
      onCancel={onCancel}
      onOk={canUpdateStaffProfile ? onOk : undefined}
      footer={canUpdateStaffProfile ? undefined : <Button onClick={onCancel}>Đóng</Button>}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={confirmLoading}
    >
      <Form form={profileForm} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="display_name"
          label="Tên hiển thị trên app"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên hiển thị' }]}
        >
          <Input disabled={!canUpdateStaffProfile} maxLength={255} placeholder="VD: KTV Minh" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="title" label="Chức danh">
              <Input disabled={!canUpdateStaffProfile} maxLength={255} placeholder="VD: Chuyên viên da liễu" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="expertise" label="Chuyên môn chính">
              <Input disabled={!canUpdateStaffProfile} maxLength={500} placeholder="VD: Trị mụn, trẻ hóa" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="bio" label="Giới thiệu tóm tắt">
          <Input.TextArea disabled={!canUpdateStaffProfile} rows={3} maxLength={2000} placeholder="Tiểu sử ngắn hiển thị trên Mini App" />
        </Form.Item>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            {canUpdateStaffProfile ? (
              <Form.Item name="photo_file_id" label="Ảnh đại diện">
                <ServiceImageField />
              </Form.Item>
            ) : (
              <Form.Item label="Ảnh đại diện">
                {profileDetails?.photo_file_id ? (
                  <Image src={profileDetails.photo_file_id} alt="Ảnh đại diện KTV" width={72} height={72} style={{ objectFit: 'cover', borderRadius: 6 }} />
                ) : <Typography.Text type="secondary">Chưa có ảnh</Typography.Text>}
              </Form.Item>
            )}
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="sort_order" label="Thứ tự sắp xếp" initialValue={0}>
              <InputNumber disabled={!canUpdateStaffProfile} min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="show_in_app" label="Hiển thị trên Mini App" valuePropName="checked" initialValue={true}>
          <Switch disabled={!canUpdateStaffProfile} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
