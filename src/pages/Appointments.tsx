import { useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Table, Tag, Typography, message } from 'antd'
import { CheckOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { APPOINTMENTS, SERVICE_CATEGORIES, STAFFS } from '../mock/admin'
import type { Appointment, AppointmentStatus } from '../mock/admin'

const STATUS_META: Record<AppointmentStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ xác nhận', color: 'orange' },
  confirmed: { label: 'Đã xác nhận', color: 'purple' },
  done: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ xác nhận' },
  { value: 'confirmed', label: 'Đã xác nhận' },
  { value: 'done', label: 'Hoàn tất' },
  { value: 'cancelled', label: 'Đã hủy' },
]

export default function Appointments() {
  const [rows, setRows] = useState<Appointment[]>(APPOINTMENTS)
  const [filter, setFilter] = useState<string>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [form] = Form.useForm()

  const openModal = (appointment?: Appointment) => {
    setEditing(appointment ?? null)
    form.setFieldsValue(
      appointment ?? {
        customer: '',
        phone: '',
        service: SERVICE_CATEGORIES[0],
        staff: STAFFS[0],
        datetime: null,
        status: 'pending',
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const row = {
      ...values,
      datetime: values.datetime?.format?.('DD/MM/YYYY HH:mm') ?? values.datetime,
    }
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...row } : r)))
      message.success('Đã cập nhật lịch hẹn')
    } else {
      const nextCode = `LH-${1045 + rows.length}`
      setRows((rs) => [...rs, { id: String(Date.now()), code: nextCode, ...row }])
      message.success('Đã thêm lịch hẹn')
    }
    setOpen(false)
  }

  const list = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  )

  const setStatus = (id: string, status: AppointmentStatus, msg: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
    message.success(msg)
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Segmented options={FILTERS} value={filter} onChange={(v) => setFilter(v as string)} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm lịch hẹn
            </Button>
          </Space>
        }
      >
        Lịch hẹn
      </PageTitle>
      <Table
        rowKey="id"
        dataSource={list}
        columns={[
          {
            title: 'Mã',
            dataIndex: 'code',
            width: 100,
            render: (v) => <Typography.Text code>{v}</Typography.Text>,
          },
          {
            title: 'Khách hàng',
            dataIndex: 'customer',
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.phone}</div>
              </div>
            ),
          },
          { title: 'Dịch vụ', dataIndex: 'service' },
          { title: 'Chuyên viên', dataIndex: 'staff', width: 130 },
          { title: 'Thời gian', dataIndex: 'datetime', width: 160 },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 130,
            render: (v: AppointmentStatus) => (
              <Tag color={STATUS_META[v].color}>{STATUS_META[v].label}</Tag>
            ),
          },
          {
            title: '',
            width: 240,
            render: (_, row) => (
              <Space>
                {row.status === 'pending' && (
                  <>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => setStatus(row.id, 'confirmed', `Đã xác nhận ${row.code}`)}
                    >
                      Xác nhận
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => setStatus(row.id, 'cancelled', `Đã hủy ${row.code}`)}
                    >
                      Hủy
                    </Button>
                  </>
                )}
                {row.status === 'confirmed' && (
                  <Button
                    size="small"
                    onClick={() => setStatus(row.id, 'done', `Đã hoàn tất ${row.code}`)}
                  >
                    Hoàn tất
                  </Button>
                )}
                <Button size="small" onClick={() => openModal(row)}>
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa lịch hẹn này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa lịch hẹn')
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
        title={editing ? 'Sửa lịch hẹn' : 'Thêm lịch hẹn'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="customer"
              label="Khách hàng"
              rules={[{ required: true, message: 'Nhập tên khách' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="VD: Nguyễn Thu Hà" />
            </Form.Item>
            <Form.Item name="phone" label="SĐT" style={{ flex: 1 }}>
              <Input placeholder="0901 234 568" />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="service"
              label="Dịch vụ"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <Select
                options={SERVICE_CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </Form.Item>
            <Form.Item name="staff" label="Chuyên viên" style={{ flex: 1 }}>
              <Select options={STAFFS.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="datetime"
              label="Thời gian"
              rules={[{ required: true, message: 'Chọn thời gian' }]}
              style={{ flex: 1 }}
            >
              <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" style={{ flex: 1 }}>
              <Select
                options={(
                  ['pending', 'confirmed', 'done', 'cancelled'] as AppointmentStatus[]
                ).map((s) => ({ value: s, label: STATUS_META[s].label }))}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
