import { useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { VOUCHERS } from '../mock/admin'
import type { Voucher } from '../mock/admin'

export default function Vouchers() {
  const [rows, setRows] = useState<Voucher[]>(VOUCHERS)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Voucher | null>(null)
  const [form] = Form.useForm()

  const openModal = (voucher?: Voucher) => {
    setEditing(voucher ?? null)
    form.setFieldsValue(
      voucher ?? {
        code: '',
        title: '',
        value: '',
        condition: '',
        start_date: '',
        end_date: '',
        is_active: true,
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const row = {
      ...values,
      start_date: values.start_date?.format?.('DD/MM/YYYY') ?? values.start_date,
      end_date: values.end_date?.format?.('DD/MM/YYYY') ?? values.end_date,
    }
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...row } : r)))
      message.success('Đã cập nhật voucher')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), used_count: 0, ...row }])
      message.success('Đã thêm voucher')
    }
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            Thêm voucher
          </Button>
        }
      >
        Voucher & Quà tặng
      </PageTitle>
      <Table
        rowKey="id"
        dataSource={rows}
        columns={[
          {
            title: 'Mã',
            dataIndex: 'code',
            width: 120,
            render: (v) => <Typography.Text code>{v}</Typography.Text>,
          },
          { title: 'Tên chương trình', dataIndex: 'title' },
          { title: 'Giá trị', dataIndex: 'value', width: 110 },
          { title: 'Điều kiện', dataIndex: 'condition' },
          { title: 'Bắt đầu', dataIndex: 'start_date', width: 110 },
          { title: 'Kết thúc', dataIndex: 'end_date', width: 110 },
          {
            title: 'Đã dùng',
            dataIndex: 'used_count',
            width: 90,
            render: (v) => v.toLocaleString('vi-VN'),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'is_active',
            width: 110,
            render: (v) => (v ? <Tag color="green">Hoạt động</Tag> : <Tag>Tắt</Tag>),
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
                  title="Xóa voucher này?"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa voucher')
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
        title={editing ? 'Sửa voucher' : 'Thêm voucher'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="code" label="Mã voucher" rules={[{ required: true, message: 'Nhập mã' }]}>
            <Input placeholder="VD: VISTA50" style={{ textTransform: 'uppercase' }} />
          </Form.Item>
          <Form.Item name="title" label="Tên chương trình" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="VD: Giảm 50k cho hóa đơn đầu" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="value" label="Giá trị" rules={[{ required: true, message: 'Nhập giá trị' }]} style={{ flex: 1 }}>
              <Input placeholder="VD: 50.000đ / 20%" />
            </Form.Item>
            <Form.Item name="condition" label="Điều kiện" style={{ flex: 1 }}>
              <Input placeholder="VD: Đơn từ 300.000đ" />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="start_date" label="Bắt đầu" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="end_date" label="Kết thúc" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item name="is_active" label="Hoạt động" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
