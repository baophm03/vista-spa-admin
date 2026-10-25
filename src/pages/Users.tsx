import { useState } from 'react'
import { Avatar, Button, DatePicker, Drawer, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import QRCode from 'qrcode'
import PageTitle from '../components/base/PageTitle'
import { useGetBranches } from '../api/endpoints/branches'
import {
  useDeleteCustomerProfilesId,
  useGetCustomerProfiles,
  useGetCustomerProfilesIdSummary,
  usePostCustomerProfiles,
  usePutCustomerProfilesId,
} from '../api/endpoints/customer-profiles'

interface Branch { id: string; name: string }
interface CustomerProfile {
  id: string
  branch_id: string
  customer_code: string
  full_name: string
  phone: string
  birthday?: string
  address?: string
  email?: string
  note?: string
  user_id?: string
  user?: { membership?: { card_rank?: { name?: string } | null } | null } | null
}

interface Summary {
  rank?: { name?: string }
  points?: number
  year_spent?: number
}

export default function Users() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [selected, setSelected] = useState<CustomerProfile | null>(null)
  const [qrUrl, setQrUrl] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerProfile | null>(null)
  const [form] = Form.useForm()

  const profilesQuery = useGetCustomerProfiles()
  const branchesQuery = useGetBranches()
  const summaryQuery = useGetCustomerProfilesIdSummary(selected?.id ?? '')
  const createMutation = usePostCustomerProfiles()
  const updateMutation = usePutCustomerProfilesId()
  const deleteMutation = useDeleteCustomerProfilesId()
  const profileResponse = (profilesQuery.data?.responseData ?? (profilesQuery.data as any)?.data ?? {}) as { rows?: CustomerProfile[]; count?: number }
  const allRows = profileResponse.rows ?? []
  const rows = allRows.filter((row) => !keyword || `${row.full_name} ${row.phone} ${row.customer_code}`.toLowerCase().includes(keyword.toLowerCase()))
    .slice((page - 1) * limit, page * limit)
  const total = keyword ? rows.length : profileResponse.count ?? allRows.length
  const branches = (((branchesQuery.data?.responseData ?? (branchesQuery.data as any)?.data ?? []) as Branch[]))
  const loading = profilesQuery.isLoading
  const summary = (summaryQuery.data?.responseData ?? (summaryQuery.data as any)?.data ?? null) as Summary | null

  const openDetail = async (row: CustomerProfile) => {
    setSelected(row)
    setQrUrl('')
    QRCode.toDataURL(row.customer_code, { width: 360, margin: 1 })
      .then(setQrUrl)
      .catch(() => undefined)
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
        await updateMutation.mutateAsync({ id: editing.id, data: payload })
        message.success('Đã cập nhật khách hàng')
      } else {
        await createMutation.mutateAsync({ data: payload })
        message.success('Đã thêm khách hàng')
      }
      setOpen(false)
      await profilesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể lưu khách hàng')
    }
  }

  const remove = async (row: CustomerProfile) => {
    try {
      await deleteMutation.mutateAsync({ id: row.id })
      message.success('Đã xóa khách hàng')
      await profilesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể xóa khách hàng')
    }
  }

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name ?? '—'
  const rowRankName = (row: CustomerProfile) => row.user?.membership?.card_rank?.name

  return (
    <>
      <PageTitle
        extra={
          <Space className="max-sm:flex! max-sm:w-full! max-sm:flex-wrap!" >
            <Input.Search
              allowClear
              prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
              placeholder="Tìm theo tên, SĐT, mã KH..."
              className="max-sm:flex-1"
              style={{ width: 260, maxWidth: '100%' }}
              onSearch={(v) => {
                setKeyword(v)
                setPage(1)
              }}
            />
            <Button className="max-sm:w-full" type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
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
