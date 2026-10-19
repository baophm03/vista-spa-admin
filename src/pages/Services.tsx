import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import { bizErrorMessage, createService, deleteService, listServices, updateService } from '../api/newsky'
import type { ServiceRow } from '../api/newsky'

const TYPE_LABEL: Record<number, string> = {
  0: 'Dịch vụ spa',
  1: 'Cơ bản',
  2: 'Chuyên sâu',
  3: 'Gói quà tặng',
}

export default function Services() {
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceRow | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listServices())
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openModal = (service?: ServiceRow) => {
    setEditing(service ?? null)
    form.setFieldsValue(
      service ?? { title: '', description: '', type: 0, required_points: 0, duration_minutes: 60 },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await updateService(editing.id, values)
        message.success('Đã cập nhật dịch vụ')
      } else {
        await createService(values)
        message.success('Đã thêm dịch vụ')
      }
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const remove = async (row: ServiceRow) => {
    try {
      await deleteService(row.id)
      message.success('Đã xóa dịch vụ')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
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
        loading={loading}
        dataSource={rows}
        columns={[
          {
            title: 'Dịch vụ',
            dataIndex: 'title',
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.description}</div>
              </div>
            ),
          },
          {
            title: 'Phân loại',
            dataIndex: 'type',
            width: 130,
            render: (v: number) => <Tag color="purple">{TYPE_LABEL[v] ?? v}</Tag>,
          },
          {
            title: 'Thời lượng',
            dataIndex: 'duration_minutes',
            width: 100,
            render: (v) => (v ? `${v} phút` : '—'),
          },
          {
            title: 'Điểm đổi',
            dataIndex: 'required_points',
            width: 100,
            render: (v) => Number(v ?? 0).toLocaleString('vi-VN'),
          },
          {
            title: '',
            width: 140,
            render: (_, row) => (
              <Space>
                <Button size="small" onClick={() => openModal(row)}>
                  Sửa
                </Button>
                <Popconfirm title="Xóa dịch vụ này?" onConfirm={() => remove(row)}>
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
          <Form.Item name="title" label="Tên dịch vụ" rules={[{ required: true, message: 'Nhập tên dịch vụ' }]}>
            <Input placeholder="VD: Chăm sóc da cơ bản" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="type" label="Phân loại" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value: Number(value), label }))} />
            </Form.Item>
            <Form.Item
              name="duration_minutes"
              label="Thời lượng (phút)"
              rules={[{ required: true, message: 'Nhập thời lượng' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={15} step={15} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="required_points" label="Điểm đổi dịch vụ">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả dịch vụ..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
