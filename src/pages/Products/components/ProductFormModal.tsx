import {
  Button,
  Col,
  Form,
  type FormInstance,
  Image,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd'
import { DeleteOutlined, PictureOutlined } from '@ant-design/icons'
import { resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import type { ProductCategoryRow, ProductRow } from './constants'

interface ProductFormModalProps {
  open: boolean
  isAdmin: boolean
  editing: ProductRow | null
  onCancel: () => void
  onSubmit: () => void
  saving: boolean
  form: FormInstance
  categories: ProductCategoryRow[]
  currencySymbol: string
  uploadingCover: boolean
  setUploadingCover: (v: boolean) => void
  uploadingGallery: boolean
  setUploadingGallery: (v: boolean) => void
  uploadImage: (file: File) => Promise<string | null>
}

export default function ProductFormModal({
  open,
  isAdmin,
  editing,
  onCancel,
  onSubmit,
  saving,
  form,
  categories,
  currencySymbol,
  uploadingCover,
  setUploadingCover,
  uploadingGallery,
  setUploadingGallery,
  uploadImage,
}: ProductFormModalProps) {
  const urlMap = useFileUrlMap()
  return (
    <Modal
      title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
      open={isAdmin && open}
      onCancel={onCancel}
      onOk={onSubmit}
      confirmLoading={saving}
      okText="Lưu"
      cancelText="Hủy"
      width={680}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, message: 'Nhập tên sản phẩm' }]}>
              <Input placeholder="VD: Kem dưỡng ẩm" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="sku" label="Mã SKU">
              <Input placeholder="VD: SP-001" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item name="category_id" label="Danh mục">
              <Select allowClear placeholder="Chọn danh mục" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="price" label="Giá hiển thị">
              <InputNumber<number>
                style={{ width: '100%' }}
                min={0}
                step={1000}
                suffix={currencySymbol}
                formatter={(v) => `${v ?? 0}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={(v) => Number((v ?? '').replace(/\./g, ''))}
                placeholder="VD: 350000"
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="buy_url" label="Liên kết mua hàng" extra="App chỉ hiển thị và dẫn liên kết; mua trực tiếp trong app chưa bật.">
          <Input placeholder="https://..." />
        </Form.Item>
        <Form.Item name="description" label="Mô tả">
          <Input.TextArea rows={3} maxLength={2000} placeholder="Mô tả ngắn về sản phẩm" />
        </Form.Item>
        <Form.Item label="Ảnh bìa">
          <Space align="center" wrap>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={async (file) => {
                setUploadingCover(true)
                const fileId = await uploadImage(file)
                if (fileId) form.setFieldsValue({ cover_file_id: fileId })
                setUploadingCover(false)
                return false
              }}
            >
              <Button icon={<PictureOutlined />} loading={uploadingCover}>Tải ảnh bìa</Button>
            </Upload>
            <Form.Item shouldUpdate noStyle>
              {() => {
                const cover: string | undefined = form.getFieldValue('cover_file_id')
                const coverSrc = resolveFileSrc(urlMap, cover)
                return coverSrc ? (
                  <Space size={4}>
                    <Image src={coverSrc} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} />
                    <Button size="small" type="text" danger onClick={() => form.setFieldsValue({ cover_file_id: undefined })}>Gỡ</Button>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">Chưa có ảnh bìa</Typography.Text>
                )
              }}
            </Form.Item>
          </Space>
        </Form.Item>
        <Form.Item label="Bộ ảnh" extra="Tối đa 12 ảnh.">
          <Form.Item name="gallery_file_ids" hidden><Input /></Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() => {
              const gallery: string[] = form.getFieldValue('gallery_file_ids') ?? []
              return (
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: gallery.length ? 8 : 0 }}>
                    {gallery.map((fileId) => (
                      <div key={fileId} style={{ position: 'relative' }}>
                        <Image src={resolveFileSrc(urlMap, fileId) ?? undefined} width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} fallback="" />
                        <Button
                          size="small"
                          type="primary"
                          danger
                          shape="circle"
                          icon={<DeleteOutlined />}
                          style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, minWidth: 22 }}
                          onClick={() => form.setFieldsValue({ gallery_file_ids: gallery.filter((item) => item !== fileId) })}
                        />
                      </div>
                    ))}
                  </div>
                  <Upload
                    accept="image/*"
                    multiple
                    showUploadList={false}
                    beforeUpload={async (file) => {
                      setUploadingGallery(true)
                      const current: string[] = form.getFieldValue('gallery_file_ids') ?? []
                      if (current.length >= 12) {
                        message.error('Tối đa 12 ảnh trong bộ ảnh')
                        setUploadingGallery(false)
                        return false
                      }
                      const fileId = await uploadImage(file)
                      if (fileId) form.setFieldsValue({ gallery_file_ids: [...current, fileId].slice(0, 12) })
                      setUploadingGallery(false)
                      return false
                    }}
                  >
                    <Button icon={<PictureOutlined />} loading={uploadingGallery}>Thêm ảnh</Button>
                  </Upload>
                </div>
              )
            }}
          </Form.Item>
        </Form.Item>
      </Form>
    </Modal>
  )
}

