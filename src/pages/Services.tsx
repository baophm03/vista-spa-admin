import { useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { SERVICES, SERVICE_CATEGORIES } from '../mock/admin'
import type { Service } from '../mock/admin'

export default function Services() {
  const [rows, setRows] = useState<Service[]>(SERVICES)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form] = Form.useForm()

  const openModal = (service?: Service) => {
    setEditing(service ?? null)
    form.setFieldsValue(
      service ?? {
        name: '',
        category: SERVICE_CATEGORIES[0],
        price: 0,
        duration: 60,
        description: '',
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
      message.success('Đã cập nhật dịch vụ')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), ...values }])
      message.success('Đã thêm dịch vụ')
    }
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm dịch vụ
          </Button>
        }
      >
        Dịch vụ
      </PageTitle>
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          {
            title: 'Dịch vụ',
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
          { title: 'Thời lượng', dataIndex: 'duration', width: 100, render: (v) => `${v} phút` },
          { title: 'Mô tả', dataIndex: 'description', ellipsis: true },
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
                  title="Xóa dịch vụ này?"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa dịch vụ')
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
        title={editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true, message: 'Nhập tên dịch vụ' }]}>
            <Input placeholder="VD: Chăm sóc da cơ bản" />
          </Form.Item>
          <Form.Item name="category" label="Phân loại" rules={[{ required: true }]}>
            <Select options={SERVICE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="price"
              label="Giá (đ)"
              rules={[{ required: true, message: 'Nhập giá' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={10000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="duration"
              label="Thời lượng (phút)"
              rules={[{ required: true, message: 'Nhập thời lượng' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={15} step={15} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả dịch vụ..." />
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
