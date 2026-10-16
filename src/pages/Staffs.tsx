import { useState } from 'react'
import { Avatar, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Switch, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { SERVICE_CATEGORIES, STAFF_LIST } from '../mock/admin'
import type { Staff } from '../mock/admin'

export default function Staffs() {
  const [rows, setRows] = useState<Staff[]>(STAFF_LIST)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [form] = Form.useForm()

  const openModal = (s?: Staff) => {
    setEditing(s ?? null)
    form.setFieldsValue(
      s ?? {
        name: '',
        avatar: '',
        specialty: SERVICE_CATEGORIES[0],
        services: [],
        phone: '',
        is_active: true,
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...values } : r)))
      message.success('Đã cập nhật chuyên viên')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), ...values }])
      message.success('Đã thêm chuyên viên')
    }
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm chuyên viên
          </Button>
        }
      >
        Chuyên viên / KTV
      </PageTitle>
      <Row gutter={[20, 20]}>
        {rows.map((s) => (
          <Col xs={24} sm={12} lg={8} key={s.id}>
            <Card styles={{ body: { padding: 20 } }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Avatar src={s.avatar} size={56} style={{ backgroundColor: '#8E63A9' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div>
                  <Tag color={s.is_active ? 'green' : 'default'} style={{ marginTop: 4 }}>
                    {s.is_active ? 'Đang làm' : 'Nghỉ'}
                  </Tag>
                </div>
              </div>
              <div style={{ marginTop: 14, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#6F7071' }}>Chuyên môn: </span>
                  <span style={{ fontWeight: 500 }}>{s.specialty}</span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ color: '#6F7071' }}>SĐT: </span>
                  <span>{s.phone}</span>
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {s.services.map((sv) => (
                    <Tag key={sv} color="purple" style={{ marginInlineEnd: 0 }}>
                      {sv}
                    </Tag>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <Button size="small" onClick={() => openModal(s)}>
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa chuyên viên này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== s.id))
                    message.success('Đã xóa chuyên viên')
                  }}
                >
                  <Button size="small" danger>
                    Xóa
                  </Button>
                </Popconfirm>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Modal
        title={editing ? 'Sửa chuyên viên' : 'Thêm chuyên viên'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Trần Hoa" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="phone" label="SĐT" style={{ flex: 1 }}>
              <Input placeholder="0901 111 222" />
            </Form.Item>
            <Form.Item name="specialty" label="Chuyên môn" style={{ flex: 1 }}>
              <Select options={SERVICE_CATEGORIES.map((c) => ({ value: c, label: c }))} />
            </Form.Item>
          </Space>
          <Form.Item name="services" label="Dịch vụ phụ trách">
            <Select
              mode="multiple"
              placeholder="Chọn dịch vụ"
              options={SERVICE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Form.Item>
          <Form.Item name="avatar" label="Ảnh (URL)">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="is_active" label="Đang làm việc" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
