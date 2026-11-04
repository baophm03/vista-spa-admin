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
} from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import TableEmpty from '@/components/base/TableEmpty'
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
      </Form>
      <Table<ProductCategoryRow>
        rowKey="id"
        size="small"
        dataSource={categories}
        pagination={false}
        locale={{ emptyText: <TableEmpty description="Chưa có danh mục nào" /> }}
        columns={[
          { title: 'Tên', dataIndex: 'name', render: (v: string) => <strong>{v}</strong> },
          { title: 'Thứ tự', dataIndex: 'sort_order', width: 70 },
          { title: 'SP đang bán', dataIndex: 'active_product_count', width: 100, render: (v?: number) => v ?? 0 },
          {
            title: '',
            key: 'actions',
            width: 110,
            render: (_, c) => (
              <Space size={4}>
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setEditingCategory(c); catForm.setFieldsValue({ name: c.name, sort_order: c.sort_order ?? 0 }) }} />
                <Popconfirm
                  title="Xóa danh mục này?"
                  description="Chỉ xóa được khi không còn sản phẩm đang hoạt động."
                  okText="Xóa"
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

