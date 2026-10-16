import { useState } from 'react'
import { Avatar, Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd'
import { SendOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { CUSTOMERS, NOTIFICATIONS } from '../mock/admin'
import type { Notification } from '../mock/admin'

const TYPE_META: Record<Notification['type'], { label: string; color: string }> = {
  appointment: { label: 'Lịch hẹn', color: 'purple' },
  promo: { label: 'Ưu đãi', color: 'gold' },
  treatment: { label: 'Liệu trình', color: 'geekblue' },
  birthday: { label: 'Sinh nhật', color: 'magenta' },
}

export default function Notifications() {
  const [rows, setRows] = useState<Notification[]>(NOTIFICATIONS)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()

  const submit = async () => {
    const values = await form.validateFields()
    setRows((rs) => [
      {
        id: String(Date.now()),
        title: values.title,
        body: values.body,
        type: values.type,
        audience: values.audience === 'all' ? 'Tất cả khách hàng' : values.audience,
        sent_at: new Date().toLocaleString('vi-VN'),
        status: 'sent',
      },
      ...rs,
    ])
    message.success('Đã gửi thông báo qua Zalo OA')
    setOpen(false)
  }

  const birthdayCustomers = CUSTOMERS.slice(0, 3)

  return (
    <>
      <PageTitle
        extra={
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => {
              form.setFieldsValue({ title: '', body: '', type: 'promo', audience: 'all' })
              setOpen(true)
            }}
          >
            Gửi thông báo
          </Button>
        }
      >
        Thông báo
      </PageTitle>

      <Table
        rowKey="id"
        dataSource={rows}
        style={{ marginTop: 4 }}
        columns={[
          {
            title: 'Thông báo',
            dataIndex: 'title',
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.body}</div>
              </div>
            ),
          },
          {
            title: 'Loại',
            dataIndex: 'type',
            width: 110,
            render: (v: Notification['type']) => <Tag color={TYPE_META[v].color}>{TYPE_META[v].label}</Tag>,
          },
          { title: 'Đối tượng', dataIndex: 'audience', width: 180 },
          { title: 'Thời gian', dataIndex: 'sent_at', width: 170 },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 110,
            render: (v) => (v === 'sent' ? <Tag color="green">Đã gửi</Tag> : <Tag color="orange">Đã lên lịch</Tag>),
          },
        ]}
      />

      <Typography.Title level={5} style={{ marginTop: 28 }}>
        Khách sinh nhật trong tháng
      </Typography.Title>
      <Space wrap>
        {birthdayCustomers.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              border: '1px solid #E9DDF0',
              borderRadius: 12,
            }}
          >
            <Avatar style={{ backgroundColor: '#8E63A9' }} icon={<UserOutlined />} />
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: '#6F7071' }}>{c.phone}</div>
            </div>
            <Button
              size="small"
              type="primary"
              onClick={() => message.success(`Đã gửi lời chúc sinh nhật tới ${c.name}`)}
            >
              Gửi chúc mừng
            </Button>
          </div>
        ))}
      </Space>

      <Modal title="Gửi thông báo" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Gửi" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="type" label="Loại thông báo" rules={[{ required: true }]}>
            <Select
              options={Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
          </Form.Item>
          <Form.Item name="audience" label="Đối tượng nhận" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'all', label: 'Tất cả khách hàng' },
                ...CUSTOMERS.map((c) => ({ value: c.name, label: c.name })),
              ]}
            />
          </Form.Item>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder="VD: Ưu đãi tháng 11" />
          </Form.Item>
          <Form.Item name="body" label="Nội dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
            <Input.TextArea rows={3} placeholder="Nội dung thông báo gửi qua Zalo OA..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
