import { useMemo, useState } from 'react'
import { Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { CUSTOMERS, HEALTH_RECORDS, STAFFS } from '../mock/admin'
import type { HealthRecord } from '../mock/admin'

const SKIN_TYPES = ['Da dầu', 'Da khô', 'Da hỗn hợp', 'Da nhạy cảm', 'Da thường']

export default function HealthRecords() {
  const [rows, setRows] = useState<HealthRecord[]>(HEALTH_RECORDS)
  const [keyword, setKeyword] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<HealthRecord | null>(null)
  const [form] = Form.useForm()

  const list = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.customer.toLowerCase().includes(keyword.toLowerCase()) ||
          r.condition.toLowerCase().includes(keyword.toLowerCase()),
      ),
    [rows, keyword],
  )

  const openModal = (r?: HealthRecord) => {
    setEditing(r ?? null)
    form.setFieldsValue(
      r ?? {
        customer: undefined,
        skin_type: SKIN_TYPES[0],
        condition: '',
        allergies: 'Không',
        checked_by: STAFFS[0],
        date: '',
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const row = {
      ...values,
      date: values.date?.format?.('DD/MM/YYYY') ?? values.date,
    }
    if (editing) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, ...row } : r)))
      message.success('Đã cập nhật sổ sức khỏe')
    } else {
      setRows((rs) => [...rs, { id: String(Date.now()), ...row }])
      message.success('Đã thêm ghi nhận')
    }
    setOpen(false)
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
              placeholder="Tìm theo khách, tình trạng da..."
              style={{ width: 260 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm ghi nhận
            </Button>
          </Space>
        }
      >
        Sổ sức khỏe
      </PageTitle>
      <Table
        rowKey="id"
        dataSource={list}
        columns={[
          {
            title: 'Khách hàng',
            dataIndex: 'customer',
            render: (v) => <span style={{ fontWeight: 500 }}>{v}</span>,
          },
          {
            title: 'Loại da',
            dataIndex: 'skin_type',
            width: 120,
            render: (v) => <Tag color="purple">{v}</Tag>,
          },
          { title: 'Tình trạng da', dataIndex: 'condition' },
          {
            title: 'Dị ứng',
            dataIndex: 'allergies',
            width: 140,
            render: (v) =>
              v === 'Không' ? (
                <Typography.Text type="secondary">Không</Typography.Text>
              ) : (
                <Tag color="red">{v}</Tag>
              ),
          },
          { title: 'Khám bởi', dataIndex: 'checked_by', width: 120 },
          { title: 'Ngày khám', dataIndex: 'date', width: 110 },
          {
            title: '',
            width: 140,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa ghi nhận này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id))
                    message.success('Đã xóa ghi nhận')
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
        title={editing ? 'Sửa ghi nhận' : 'Thêm ghi nhận'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khách hàng"
              options={CUSTOMERS.map((c) => ({ value: c.name, label: `${c.name} — ${c.code}` }))}
            />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="skin_type" label="Loại da" style={{ flex: 1 }}>
              <Select options={SKIN_TYPES.map((t) => ({ value: t, label: t }))} />
            </Form.Item>
            <Form.Item name="checked_by" label="Khám bởi" style={{ flex: 1 }}>
              <Select options={STAFFS.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </Space>
          <Form.Item name="condition" label="Tình trạng da" rules={[{ required: true, message: 'Nhập tình trạng da' }]}>
            <Input.TextArea rows={3} placeholder="VD: Mụn viêm vùng cằm, thâm nhẹ..." />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="allergies" label="Dị ứng" style={{ flex: 1 }}>
              <Input placeholder="VD: Cồn khô / Không" />
            </Form.Item>
            <Form.Item name="date" label="Ngày khám" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}
