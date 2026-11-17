import { Button, Form, Image, Input, Modal, Space, Typography, Upload } from 'antd'
import type { FormInstance } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import type { Branch } from '@/api/models/branch'
import { resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { BranchFormValues } from './constants'

interface Props {
  open: boolean
  editing: Branch | null
  nextCode?: string
  form: FormInstance<BranchFormValues>
  saving: boolean
  uploadingImage: boolean
  uploadImage: (file: File) => Promise<boolean>
  onCancel: () => void
  onSubmit: () => void
}

export default function BranchModal({
  open,
  editing,
  nextCode,
  form,
  saving,
  uploadingImage,
  uploadImage,
  onCancel,
  onSubmit,
}: Props) {
  const urlMap = useFileUrlMap()
  return (
    <Modal
      title={editing ? 'Sửa thông tin cơ sở' : 'Thêm cơ sở'}
      open={open}
      onCancel={onCancel}
      onOk={onSubmit}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        {editing ? (
          <Form.Item label="Mã cơ sở" extra="Mã do hệ thống tự sinh, không thể chỉnh sửa.">
            <Typography.Text code>{editing.code}</Typography.Text>
          </Form.Item>
        ) : (
          <Form.Item
            label="Mã cơ sở"
            extra="Hệ thống tự sinh mã theo quy tắc CS01, CS02, …; mã hiển thị là dự kiến, mã thật được gán khi lưu."
          >
            <Input disabled placeholder="Tự sinh khi lưu" value={nextCode} />
          </Form.Item>
        )}
        <Form.Item
          name="name"
          label="Tên cơ sở"
          rules={[
            { required: true, whitespace: true, message: 'Nhập tên cơ sở' },
            { max: 255, message: 'Tên cơ sở tối đa 255 ký tự' },
          ]}
        >
          <Input maxLength={255} />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ" rules={[{ max: 500, message: 'Địa chỉ tối đa 500 ký tự' }]}>
          <Input.TextArea rows={3} maxLength={500} />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại" rules={[{ max: 20, message: 'Số điện thoại tối đa 20 ký tự' }]}>
          <Input maxLength={20} inputMode="tel" autoComplete="tel" />
        </Form.Item>
        <Form.Item name="image_file_id" hidden><Input /></Form.Item>
        <Form.Item label="Ảnh cơ sở" extra="Ảnh đại diện hiển thị trên app cho khách khi chọn cơ sở.">
          <Form.Item shouldUpdate noStyle>
            {() => {
              const imageFileId: string | undefined | null = form.getFieldValue('image_file_id')
              const imageSrc = resolveFileSrc(urlMap, imageFileId)
              return (
                <Space direction="vertical" className="w-full" size={8}>
                  <Upload accept="image/*" showUploadList={false} beforeUpload={uploadImage}>
                    <Button icon={<UploadOutlined />} loading={uploadingImage}>Tải ảnh lên</Button>
                  </Upload>
                  {imageSrc ? (
                    <Space align="start">
                      <Image src={imageSrc} width={150} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
                      <Button size="small" danger onClick={() => form.setFieldValue('image_file_id', undefined)}>Gỡ ảnh</Button>
                    </Space>
                  ) : <Typography.Text type="secondary">Chưa có ảnh cơ sở</Typography.Text>}
                </Space>
              )
            }}
          </Form.Item>
        </Form.Item>
      </Form>
    </Modal>
  )
}
