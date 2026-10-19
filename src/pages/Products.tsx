import { useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { PRODUCTS, PRODUCT_CATEGORIES } from '../mock/admin'
import type { Product } from '../mock/admin'

export default function Products() {
  const [rows, setRows] = useState<Product[]>(PRODUCTS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form] = Form.useForm()

  const openModal = (p?: Product) => {
    setEditing(p ?? null)
    form.setFieldsValue(
      p ?? {
        name: '',
        category: PRODUCT_CATEGORIES[0],
        price: 0,
        stock: 0,
        image: '',
        is_active: true,
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...values } : r)))
      message.success('Đã cập nhật sản phẩm')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), ...values }])
      message.success('Đã thêm sản phẩm')
    }
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm sản phẩm
          </Button>
        }
      >
        Sản phẩm
      </PageTitle>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Dữ liệu minh họa — backend chưa có module sản phẩm. Các thao tác chỉ lưu tạm trên trình duyệt."
      />
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          {
            title: 'Sản phẩm',
            dataIndex: 'name',
            render: (v, row) => (
              <Space>
                <img
                  src={row.image}
                  alt={v}
                  width={44}
                  height={44}
                  style={{ objectFit: 'cover', borderRadius: 12 }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{v}</div>
                  <div style={{ fontSize: 12, color: '#6F7071' }}>{row.category}</div>
                </div>
              </Space>
            ),
          },
          {
            title: 'Giá',
            dataIndex: 'price',
            width: 130,
            render: (v) => `${v.toLocaleString('vi-VN')}đ`,
          },
          {
            title: 'Tồn kho',
            dataIndex: 'stock',
            width: 100,
            render: (v) =>
              v === 0 ? <Tag color="red">Hết hàng</Tag> : v < 20 ? <Tag color="orange">{v}</Tag> : <Tag color="green">{v}</Tag>,
          },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            width: 110,
            render: (v) => (v ? <Tag color="green">Đang bán</Tag> : <Tag>Tạm ẩn</Tag>),
          },
          {
            title: '',
            width: 140,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa sản phẩm này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa sản phẩm')
                  }}
                >
                  <Button size="small" danger>
                    Xóa
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên sản phẩm" rules={[{ required: true, message: 'Nhập tên sản phẩm' }]}>
            <Input placeholder="VD: Kahanna Kem dưỡng ẩm chuyên sâu" />
          </Form.Item>
          <Form.Item name="category" label="Danh mục" rules={[{ required: true }]}>
            <Select options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="price" label="Giá (đ)" rules={[{ required: true, message: 'Nhập giá' }]} style={{ flex: 1 }}>
              <InputNumber min={0} step={10000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="stock" label="Tồn kho" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="image" label="Ảnh (URL)">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="is_active" label="Đang bán" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
