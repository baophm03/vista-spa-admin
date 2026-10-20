import { useCallback, useEffect, useState } from 'react'
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/PageTitle'
import { bizErrorMessage, createVoucher, deleteVoucher, listVouchers, updateVoucher } from '../api/newsky'
import type { VoucherRow } from '../api/newsky'

/** type theo contract BE: hạng thẻ được áp dụng (0=Tất cả, 1=Silver, 2=Gold, 3=Diamond, 4=VIP) */
const TYPE_LABEL: Record<number, string> = {
  0: 'Tất cả hạng',
  1: 'Silver',
  2: 'Gold',
  3: 'Diamond',
  4: 'VIP',
}

export default function Vouchers() {
  const [rows, setRows] = useState<VoucherRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VoucherRow | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listVouchers({ page: 1, limit: 100 })
      setRows(data?.rows ?? (Array.isArray(data) ? data : []))
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openModal = (voucher?: VoucherRow) => {
    setEditing(voucher ?? null)
    form.setFieldsValue(
      voucher
        ? {
            ...voucher,
            start_date: voucher.start_date ? dayjs(voucher.start_date) : undefined,
            end_date: voucher.end_date ? dayjs(voucher.end_date) : undefined,
          }
        : { title: '', required_points: 0, type: 0, is_active: true },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const payload = {
      ...values,
      start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : undefined,
      end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : undefined,
    }
    try {
      if (editing) {
        await updateVoucher(editing.id, payload)
        message.success('Đã cập nhật voucher')
      } else {
        await createVoucher(payload)
        message.success('Đã thêm voucher')
      }
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const remove = async (row: VoucherRow) => {
    try {
      await deleteVoucher(row.id)
      message.success('Đã xóa voucher')
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
            Thêm voucher
          </Button>
        }
      >
        Voucher & Quà tặng
      </PageTitle>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={[
          {
            title: 'Tên chương trình',
            dataIndex: 'title',
            render: (v) => <Typography.Text strong>{v}</Typography.Text>,
          },
          { title: 'Áp dụng hạng', dataIndex: 'type', width: 140, render: (v: number) => <Tag color="gold">{TYPE_LABEL[v] ?? v}</Tag> },
          {
            title: 'Điểm đổi',
            dataIndex: 'required_points',
            width: 110,
            render: (v) => Number(v ?? 0).toLocaleString('vi-VN'),
          },
          {
            title: 'Bắt đầu',
            dataIndex: 'start_date',
            width: 110,
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
          },
          {
            title: 'Kết thúc',
            dataIndex: 'end_date',
            width: 110,
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
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
                <Popconfirm title="Xóa voucher này?" onConfirm={() => remove(row)}>
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
          <Form.Item name="title" label="Tên chương trình" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="VD: Giảm 50k cho hóa đơn đầu" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="type" label="Áp dụng hạng" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value: Number(value), label }))} />
            </Form.Item>
            <Form.Item name="required_points" label="Điểm đổi" rules={[{ required: true, message: 'Nhập điểm' }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
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
