import { Button, DatePicker, Drawer, Form, Image, Input, InputNumber, Select, Space, Switch, Typography, Upload } from 'antd'
import { EyeOutlined, UploadOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import type { ContentCategory } from '@/api/models/contentCategory'
import ContentRichTextEditor from '@/components/ContentRichTextEditor'
import links from '@/configs/links'
import { makePostSlug } from './constants'
import type { ContentPostRow, PostFormValues } from './constants'

interface ContentPostDrawerProps {
  open: boolean
  editing: ContentPostRow | null
  form: FormInstance<PostFormValues>
  categories: ContentCategory[]
  saving: boolean
  uploadingCover: boolean
  slugManuallyEdited: boolean
  setSlugManuallyEdited: (value: boolean) => void
  onClose: () => void
  onPreview: () => void
  onSubmit: () => void
  uploadCover: (file: File) => Promise<boolean>
  uploadContentImage: (file: File) => Promise<string>
}

export default function ContentPostDrawer({
  open,
  editing,
  form,
  categories,
  saving,
  uploadingCover,
  slugManuallyEdited,
  setSlugManuallyEdited,
  onClose,
  onPreview,
  onSubmit,
  uploadCover,
  uploadContentImage,
}: ContentPostDrawerProps) {
  return (
    <Drawer
      title={editing ? 'Sửa bài viết' : 'Tạo bài viết mới (Nháp)'}
      open={open}
      onClose={onClose}
      width={760}
      extra={(
        <Space>
          <Button icon={<EyeOutlined />} onClick={onPreview}>Xem trước</Button>
          <Button type="primary" loading={saving} onClick={onSubmit}>Lưu</Button>
        </Space>
      )}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changed) => {
          if (Object.prototype.hasOwnProperty.call(changed, 'slug')) setSlugManuallyEdited(Boolean(changed.slug))
          if (typeof changed.title === 'string' && !slugManuallyEdited) form.setFieldValue('slug', makePostSlug(changed.title))
        }}
      >
        <Form.Item name="category_id" label="Chuyên mục" rules={[{ required: true, message: 'Chọn chuyên mục' }]}>
          <Select options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Chọn chuyên mục" />
        </Form.Item>
        <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
          <Input placeholder="Tiêu đề bài viết" />
        </Form.Item>
        <Form.Item name="slug" label="Đường dẫn bài viết" extra="Tự tạo từ tiêu đề. Có thể sửa đường dẫn hoặc tạo lại từ tiêu đề.">
          <Input
            placeholder="Tự tạo từ tiêu đề"
            addonAfter={(
              <Button
                type="text"
                size="small"
                onClick={() => {
                  setSlugManuallyEdited(false)
                  form.setFieldValue('slug', makePostSlug(form.getFieldValue('title')))
                }}
              >
                Tạo lại
              </Button>
            )}
          />
        </Form.Item>
        <Form.Item name="summary" label="Tóm tắt ngắn">
          <Input.TextArea rows={2} placeholder="Hiển thị ở danh sách và thông báo broadcast" />
        </Form.Item>
        <Form.Item name="content" label="Nội dung chi tiết" extra="Soạn như văn bản bình thường; dùng thanh công cụ để định dạng. Không cần nhập HTML.">
          <ContentRichTextEditor onUploadImage={uploadContentImage} />
        </Form.Item>
        <Form.Item name="cover_url" hidden><Input /></Form.Item>
        <Form.Item label="Ảnh bìa">
          <Form.Item shouldUpdate noStyle>
            {() => {
              const coverUrl: string | undefined = form.getFieldValue('cover_url')
              return (
                <Space direction="vertical" className="w-full" size={8}>
                  <Input
                    value={coverUrl ?? ''}
                    onChange={(event) => form.setFieldValue('cover_url', event.target.value)}
                    placeholder="Dán đường dẫn ảnh hoặc tải ảnh lên"
                  />
                  <Upload accept="image/*" showUploadList={false} beforeUpload={uploadCover}>
                    <Button icon={<UploadOutlined />} loading={uploadingCover}>Tải ảnh lên</Button>
                  </Upload>
                  {coverUrl ? (
                  <Space align="start">
                    <Image src={(links.imageEndpoint + (coverUrl || ""))} width={150} height={96} style={{ objectFit: 'cover', borderRadius: 8 }} />
                    <Button size="small" danger onClick={() => form.setFieldValue('cover_url', undefined)}>Gỡ ảnh</Button>
                  </Space>
                  ) : <Typography.Text type="secondary">Chưa có ảnh bìa</Typography.Text>}
                </Space>
              )
            }}
          </Form.Item>
        </Form.Item>
        <Form.Item name="video_url" label="Video (YouTube/TikTok/Facebook embed URL)">
          <Input placeholder="https://www.youtube.com/embed/…" />
        </Form.Item>
        <Space wrap>
          <Form.Item name="publish_at" label="Bắt đầu xuất bản">
            <DatePicker showTime style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="expire_at" label="Tự hạ bài lúc">
            <DatePicker showTime style={{ width: 200 }} />
          </Form.Item>
        </Space>
        <Space wrap>
          <Form.Item name="is_pinned" label="Ghim bài" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: 120 }} />
          </Form.Item>
        </Space>
      </Form>
    </Drawer>
  )
}
