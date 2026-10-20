import { useCallback, useEffect, useState } from 'react'
import { Avatar, Button, DatePicker, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import QRCode from 'qrcode'
import PageTitle from '../components/PageTitle'
import {
  bizErrorMessage,
  createCustomerProfile,
  deleteCustomerProfile,
  getCustomerProfileSummary,
  listBranches,
  listCustomerProfiles,
  updateCustomerProfile,
} from '../api/newsky'
import type { Branch, CustomerProfile } from '../api/newsky'

interface Summary {
  rank?: { name?: string }
  points?: number
  year_spent?: number
}

export default function Users() {
  const [rows, setRows] = useState<CustomerProfile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<CustomerProfile | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [qrUrl, setQrUrl] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerProfile | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit }
      if (keyword) params.q = keyword
      const { data, meta } = await listCustomerProfiles(params)
      setRows(data)
      setTotal(meta?.total ?? data.length)
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, limit, keyword])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    listBranches().then(setBranches).catch(() => undefined)
  }, [])

  const openDetail = async (row: CustomerProfile) => {
    setSelected(row)
    setSummary(null)
    setQrUrl('')
    QRCode.toDataURL(row.customer_code, { width: 360, margin: 1 })
      .then(setQrUrl)
      .catch(() => undefined)
    try {
      setSummary((await getCustomerProfileSummary(row.id)) as Summary)
    } catch {
      setSummary(null)
    }
  }

  const openModal = (customer?: CustomerProfile) => {
    setEditing(customer ?? null)
    form.setFieldsValue(
      customer
        ? { ...customer, birthday: customer.birthday ? dayjs(customer.birthday) : undefined }
        : { full_name: '', phone: '', email: '' },
    )
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const payload = {
      ...values,
      birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : undefined,
    }
    try {
      if (editing) {
        await updateCustomerProfile(editing.id, payload)
        message.success('Đã cập nhật khách hàng')
      } else {
        await createCustomerProfile(payload)
        message.success('Đã thêm khách hàng')
      }
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const remove = async (row: CustomerProfile) => {
    try {
      await deleteCustomerProfile(row.id)
      message.success('Đã xóa khách hàng')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name ?? '—'
  const rowRankName = (row: CustomerProfile) => row.user?.membership?.card_rank?.name

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Input.Search
              allowClear
              prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
              placeholder="Tìm theo tên, SĐT, mã KH..."
              style={{ width: 260 }}
              onSearch={(v) => {
                setKeyword(v)
                setPage(1)
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm khách hàng
            </Button>
          </Space>
        }
      >
        Khách hàng
      </PageTitle>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage }}
        onRow={(row) => ({ onClick: () => openDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Mã KH',
            dataIndex: 'customer_code',
            width: 130,
            render: (v) => <Typography.Text code>{v}</Typography.Text>,
          },
          {
            title: 'Khách hàng',
            dataIndex: 'full_name',
            render: (v) => (
              <Space>
                <Avatar style={{ backgroundColor: 'var(--brand-primary)' }} icon={<UserOutlined />} size="small" />
                <span style={{ fontWeight: 500 }}>{v}</span>
              </Space>
            ),
          },
          { title: 'Số điện thoại', dataIndex: 'phone' },
          { title: 'Email', dataIndex: 'email', render: (v) => v || '-' },
          { title: 'Cơ sở', dataIndex: 'branch_id', render: (v) => branchName(v) },
          {
            title: 'Hạng',
            key: 'rank',
            width: 110,
            render: (_, row) =>
              row.user_id ? <Tag color="purple">{rowRankName(row) ?? '—'}</Tag> : <Tag>Chưa liên kết</Tag>,
          },
          {
            title: '',
            width: 140,
            render: (_, row) => (
              <Space>
                <Button
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation()
                    openModal(row)
                  }}
                >
                  Sửa
                </Button>
                <Popconfirm
                  title="Xóa (ẩn) khách hàng này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  onConfirm={(e) => {
                    e?.stopPropagation()
                    remove(row)
                  }}
                  onCancel={(e) => e?.stopPropagation()}
                >
                  <Button size="small" danger onClick={(e) => e.stopPropagation()}>
                    Xóa
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title={selected ? `${selected.full_name} — ${selected.customer_code}` : ''}
        width={420}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div style={{ textAlign: 'center' }}>
            {qrUrl ? (
              <img
                src={qrUrl}
                alt={selected.customer_code}
                width={180}
                height={180}
                style={{ borderRadius: 12, border: '1px solid var(--brand-border)' }}
              />
            ) : (
              <div style={{ width: 180, height: 180, borderRadius: 12, border: '1px solid var(--brand-border)' }} />
            )}
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              Mã QR khách hàng — quét để tra cứu
            </Typography.Text>
            <div style={{ textAlign: 'left', marginTop: 24, display: 'grid', gap: 12 }}>
              {[
                ['Hạng thành viên', rowRankName(selected) ? <Tag key="r" color="purple">{rowRankName(selected)}</Tag> : '—'],
                ['Điểm hiện có', (summary?.points ?? 0).toLocaleString('vi-VN')],
                ['Chi tiêu năm nay', (summary?.year_spent ?? 0).toLocaleString('vi-VN')],
                ['Số điện thoại', selected.phone],
                ['Email', selected.email || '-'],
                ['Ngày sinh', selected.birthday ? dayjs(selected.birthday).format('DD/MM/YYYY') : '-'],
                ['Cơ sở', branchName(selected.branch_id)],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography.Text type="secondary">{label}</Typography.Text>
                  <Typography.Text strong>{value as React.ReactNode}</Typography.Text>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Nguyễn Thu Hà" />
          </Form.Item>
          <Space style={{ display: 'flex' }}>
            <Form.Item
              name="phone"
              label="Số điện thoại"
              rules={[{ required: true, message: 'Nhập SĐT' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="0901234568" />
            </Form.Item>
            <Form.Item name="email" label="Email" style={{ flex: 1 }}>
              <Input placeholder="email@gmail.com" />
            </Form.Item>
          </Space>
          <Space style={{ display: 'flex' }}>
            <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]} style={{ flex: 1 }}>
              <Select
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="Chọn cơ sở"
              />
            </Form.Item>
            <Form.Item name="birthday" label="Ngày sinh" style={{ flex: 1 }}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Space>
          <Form.Item name="address" label="Địa chỉ">
            <Input />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
