import {
  Button,
  Form,
  type FormInstance,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
} from 'antd'
import { DeleteOutlined, EditOutlined, EyeInvisibleOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import TableEmpty from '@/components/base/TableEmpty'
import ServiceImageField from '@/components/ServiceImageField'
import { fileSrc } from '@/hooks/useFileUrl'
import type { ProductCategoryRow } from './constants'

interface ProductCategoryModalProps {
  open: boolean
  isAdmin: boolean
  onCancel: () => void
  catForm: FormInstance
  editingCategory: ProductCategoryRow | null
  setEditingCategory: (c: ProductCategoryRow | null) => void
  catSaving: boolean
  onSubmitCategory: () => void
  onRemoveCategory: (c: ProductCategoryRow) => void
  onToggleCategory: (c: ProductCategoryRow) => void
  categories: ProductCategoryRow[]
}

export default function ProductCategoryModal({
  open,
  isAdmin,
  onCancel,
  catForm,
  editingCategory,
  setEditingCategory,
  catSaving,
  onSubmitCategory,
  onRemoveCategory,
  onToggleCategory,
  categories,
}: ProductCategoryModalProps) {
  return (
    <Modal
      title="Danh mục sản phẩm"
      open={isAdmin && open}
      footer={null}
      onCancel={onCancel}
      width={560}
    >
      <Form form={catForm} layout="inline" style={{ marginTop: 12, marginBottom: 16, gap: 8 }} onFinish={onSubmitCategory}>
        <Form.Item name="name" rules={[{ required: true, message: 'Nhập tên danh mục' }]} style={{ flex: 1, minWidth: 180, marginRight: 0, marginBottom: 8 }}>
          <Input placeholder="Tên danh mục" />
        </Form.Item>
        <Form.Item name="sort_order" style={{ marginRight: 0, width: 90, marginBottom: 8 }}>
          <InputNumber min={0} placeholder="Thứ tự" style={{ width: '100%' }} />
        </Form.Item>
        {editingCategory && (
          <Button style={{ marginBottom: 8 }} onClick={() => { setEditingCategory(null); catForm.resetFields() }}>Hủy</Button>
        )}
        <Button type="primary" htmlType="submit" loading={catSaving} icon={editingCategory ? undefined : <PlusOutlined />} style={{ marginBottom: 8 }}>
          {editingCategory ? 'Lưu' : 'Thêm'}
        </Button>
        <Form.Item name="image_file_id" style={{ width: '100%', marginBottom: 8 }}>
          <ServiceImageField />
        </Form.Item>
      </Form>
      <Table<ProductCategoryRow>
        rowKey="id"
        size="small"
        dataSource={categories}
        pagination={false}
        locale={{ emptyText: <TableEmpty description="Chưa có danh mục nào" /> }}
        columns={[
          { title: 'Tên', dataIndex: 'name', render: (v: string, c) => {
              const src = fileSrc((c as { image_file?: { path?: string } }).image_file)
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {src ? <img src={src} alt="" width={32} height={32} style={{ objectFit: 'cover', borderRadius: '50%' }} /> : null}
                  <strong>{v}</strong>
                </span>
              )
            } },
          { title: 'Thứ tự', dataIndex: 'sort_order', width: 70 },
          { title: 'SP đang bán', dataIndex: 'active_product_count', width: 100, render: (v?: number) => v ?? 0 },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            width: 90,
            render: (v?: boolean) => (v === false ? <Tag>Đã ẩn</Tag> : <Tag color="green">Đang dùng</Tag>),
          },
          {
            title: '',
            key: 'actions',
            width: 130,
            render: (_, c) => (
              <Space size={4}>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setEditingCategory(c); catForm.setFieldsValue({ name: c.name, sort_order: c.sort_order ?? 0, image_file_id: (c as { image_file?: { id?: string } }).image_file?.id ?? c.image_file_id ?? null }) }} />
                <Popconfirm
                  title={c.is_active === false ? 'Hiện lại danh mục này?' : 'Ẩn danh mục này?'}
                  description={c.is_active === false ? 'Danh mục sẽ hiển thị lại trên app.' : 'Danh mục bị ẩn khỏi app nhưng vẫn còn trong danh sách quản trị.'}
                  okText={c.is_active === false ? 'Hiện' : 'Ẩn'}
                  cancelText="Hủy"
                  onConfirm={() => void onToggleCategory(c)}
                >
                  <Button size="small" type="text" icon={c.is_active === false ? <EyeOutlined /> : <EyeInvisibleOutlined />} />
                </Popconfirm>
                <Popconfirm
                  title="Xóa danh mục này?"
                  description="Chỉ xóa được khi không còn sản phẩm tham chiếu."
                  okText="Xóa"
                  okButtonProps={{ danger: true }}
                  cancelText="Hủy"
                  onConfirm={() => void onRemoveCategory(c)}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
    </Modal>
  )
}

