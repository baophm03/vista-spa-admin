import { useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Space, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { TREATMENT_CATALOG } from '../mock/admin'
import type { TreatmentCatalogItem } from '../mock/admin'

export default function Treatments() {
  const [rows, setRows] = useState<TreatmentCatalogItem[]>(TREATMENT_CATALOG)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TreatmentCatalogItem | null>(null)
  const [form] = Form.useForm()

  const openModal = (t?: TreatmentCatalogItem) => {
    setEditing(t ?? null)
    form.setFieldsValue(
      t ?? {
        name: '',
        description: '',
        sessions: 4,
        price: 0,
        duration: 60,
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
      message.success('Đã cập nhật liệu trình')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), ...values }])
      message.success('Đã thêm liệu trình')
    }
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm liệu trình
          </Button>
        }
      >
        Liệu trình
      </PageTitle>
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          {
            title: 'Liệu trình',
            dataIndex: 'name',
            render: (v, row) => (
              <Space>
                <img
                  src={row.image}
                  alt={v}
                  width={44}
                  height={44}
                  style={{ objectFit: 'cover', borderRadius: 8 }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{v}</div>
                  <div style={{ fontSize: 12, color: '#6F7071' }}>{row.description}</div>
                </div>
              </Space>
            ),
          },
          {
            title: 'Giá trọn gói',
            dataIndex: 'price',
            width: 140,
            render: (v) => `${v.toLocaleString('vi-VN')}đ`,
          },
          { title: 'Số buổi', dataIndex: 'sessions', width: 90, render: (v) => `${v} buổi` },
          { title: 'Thời lượng/buổi', dataIndex: 'duration', width: 130, render: (v) => `${v} phút` },
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
                  title="Xóa liệu trình này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa liệu trình')
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
        title={editing ? 'Sửa liệu trình' : 'Thêm liệu trình'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên liệu trình" rules={[{ required: true, message: 'Nhập tên liệu trình' }]}>
            <Input placeholder="VD: Peel Acne chuyên sâu" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả các bước / công dụng..." />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="sessions" label="Số buổi" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={1} max={20} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="duration" label="Thời lượng/buổi (phút)" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={15} step={15} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="price" label="Giá trọn gói (đ)" rules={[{ required: true, message: 'Nhập giá' }]}>
            <InputNumber min={0} step={100000} style={{ width: '100%' }} />
          </Form.Item>
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
