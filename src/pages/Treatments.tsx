import { useCallback, useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import PageTitle from '../components/base/PageTitle'
import {
  bizErrorMessage,
  createTreatmentPackage,
  deleteTreatmentPackage,
  listBranches,
  listTreatmentPackages,
  updateTreatmentPackage,
} from '../api/newsky'
import type { Branch, TreatmentPackage } from '../api/newsky'

const QUOTA_LABEL: Record<string, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn gói',
}

export default function Treatments() {
  const [rows, setRows] = useState<TreatmentPackage[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TreatmentPackage | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listTreatmentPackages())
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    listBranches().then(setBranches).catch(() => undefined)
  }, [load])

  const openModal = (t?: TreatmentPackage) => {
    setEditing(t ?? null)
    form.setFieldsValue(
      t ?? {
        name: '',
        description: '',
        quota_type: 'SESSIONS',
        total_sessions: 5,
        list_price: 0,
        branch_id: undefined,
        is_active: true,
      },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await updateTreatmentPackage(editing.id, values)
        message.success('Đã cập nhật liệu trình')
      } else {
        await createTreatmentPackage(values)
        message.success('Đã thêm liệu trình')
      }
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const remove = async (row: TreatmentPackage) => {
    try {
      await deleteTreatmentPackage(row.id)
      message.success('Đã xóa liệu trình')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const branchName = (id?: string) => (id ? branches.find((b) => b.id === id)?.name ?? '—' : 'Tất cả cơ sở')

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
        loading={loading}
        dataSource={rows}
        columns={[
          {
            title: 'Liệu trình',
            dataIndex: 'name',
            render: (v, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{v}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.description}</div>
              </div>
            ),
          },
          { title: 'Cơ sở', dataIndex: 'branch_id', render: (v) => branchName(v) },
          {
            title: 'Loại hạn mức',
            dataIndex: 'quota_type',
            width: 160,
            render: (v: string) => <Tag color="purple">{QUOTA_LABEL[v] ?? v}</Tag>,
          },
          {
            title: 'Số buổi',
            dataIndex: 'total_sessions',
            width: 90,
            render: (v, row) => (row.quota_type === 'UNLIMITED' ? '∞' : v ?? '—'),
          },
          {
            title: 'Giá trọn gói',
            dataIndex: 'list_price',
            width: 140,
            render: (v) => `${Number(v ?? 0).toLocaleString('vi-VN')}đ`,
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
                <Popconfirm title="Xóa liệu trình này?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove(row)}>
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
            <Form.Item name="branch_id" label="Cơ sở (bỏ trống = dùng chung)" style={{ flex: 1 }}>
              <Select
                allowClear
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="Tất cả cơ sở"
              />
            </Form.Item>
            <Form.Item name="quota_type" label="Loại hạn mức" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select
                options={(Object.keys(QUOTA_LABEL) as string[]).map((k) => ({ value: k, label: QUOTA_LABEL[k] }))}
              />
            </Form.Item>
          </Space>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.quota_type !== cur.quota_type}>
            {({ getFieldValue }) =>
              getFieldValue('quota_type') === 'SESSIONS' ? (
                <Form.Item name="total_sessions" label="Số buổi" rules={[{ required: true }]}>
                  <InputNumber min={1} max={99} style={{ width: '100%' }} />
                </Form.Item>
              ) : getFieldValue('quota_type') === 'VALUE' ? (
                <Form.Item name="total_value" label="Định mức tiền (đ)" rules={[{ required: true }]}>
                  <InputNumber min={0} step={1000000} style={{ width: '100%' }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="list_price" label="Giá trọn gói (đ)" rules={[{ required: true, message: 'Nhập giá' }]}>
            <InputNumber min={0} step={100000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="is_active" label="Đang bán" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
