import { useState } from 'react'
import { Button, Card, Col, Form, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/base/PageTitle'
import {
  useGetUsers,
} from '../api/endpoints/users'
import {
  useGetVouchers,
  useGetVouchersRedeemed,
  useGetVouchersStatistics,
  usePostVouchersIdRedeem,
  usePostVouchersMarkUsed,
  usePostVouchersRevoke,
} from '../api/endpoints/vouchers'

interface UserVoucherRow {
  id: string
  user_id: string
  voucher_id: string
  status: string
  redeemed_at?: string
  note?: string
  voucher?: { id: string; title: string; required_points?: number }
  user?: { id: string; zalo_name?: string; phone_number?: string }
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  redeemed: { label: 'Chờ nhận', color: 'orange' },
  used: { label: 'Đã nhận quà', color: 'green' },
  revoked: { label: 'Đã thu hồi', color: 'red' },
}

export default function Redemptions() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const redeemedQuery = useGetVouchersRedeemed({ currentPage: String(page), pageSize: String(limit) })
  const statisticsQuery = useGetVouchersStatistics()
  const usersQuery = useGetUsers({ currentPage: '1', pageSize: '200' })
  const vouchersQuery = useGetVouchers({ currentPage: 1, pageSize: 200 })
  const redeemMutation = usePostVouchersIdRedeem()
  const markUsedMutation = usePostVouchersMarkUsed()
  const revokeMutation = usePostVouchersRevoke()
  const redeemedData = (redeemedQuery.data?.responseData ?? {}) as { rows?: UserVoucherRow[]; count?: number }
  const rows = redeemedData.rows ?? []
  const total = redeemedData.count ?? rows.length
  const users = (((usersQuery.data?.responseData ?? {}) as { rows?: UserVoucherRow['user'][] }).rows ?? []).filter(Boolean) as NonNullable<UserVoucherRow['user']>[]
  const vouchers = (((vouchersQuery.data?.responseData ?? {}) as { rows?: UserVoucherRow['voucher'][] }).rows ?? []).filter(Boolean) as NonNullable<UserVoucherRow['voucher']>[]
  const overview = (statisticsQuery.data?.data ?? {}) as { total_redemptions?: number; pending_redemptions?: number; used_redemptions?: number }
  const stats = {
    total: overview.total_redemptions ?? 0,
    pending: overview.pending_redemptions ?? 0,
    used: overview.used_redemptions ?? 0,
  }
  const loading = redeemedQuery.isLoading

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await redeemMutation.mutateAsync({ id: values.voucher_id, data: { user_id: values.user_id, note: values.note } })
      message.success('Đã ghi nhận đổi quà')
      setOpen(false)
      form.resetFields()
      await redeemedQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể ghi nhận đổi quà')
    }
  }

  const markDone = async (row: UserVoucherRow) => {
    try {
      await markUsedMutation.mutateAsync({ data: { user_voucher_id: row.id, note: 'Nhận quà tại spa' } })
      message.success('Đã đánh dấu khách nhận quà')
      await redeemedQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái')
    }
  }

  const revoke = async (row: UserVoucherRow) => {
    try {
      await revokeMutation.mutateAsync({ data: { user_voucher_id: row.id, reason: 'Thu hồi bởi admin' } })
      message.success('Đã thu hồi voucher')
      await redeemedQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể thu hồi voucher')
    }
  }

  const userName = (row: UserVoucherRow) => row.user?.zalo_name || row.user?.phone_number || row.user_id?.slice(0, 8)

  return (
    <>
      <PageTitle
        extra={
          <Space className="max-sm:flex! max-sm:w-full! max-sm:flex-wrap!">
            <Button icon={<ReloadOutlined />} onClick={() => redeemedQuery.refetch()} />
            <Button className="max-sm:flex-1" type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
              Ghi nhận đổi quà
            </Button>
          </Space>
        }
      >
        Khách đổi quà
      </PageTitle>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} md={8}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Tổng lượt đổi" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Chờ nhận quà" value={stats.pending} valueStyle={{ color: '#D97706' }} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Đã nhận quà" value={stats.used} valueStyle={{ color: '#16A34A' }} />
          </Card>
        </Col>
      </Row>

      <Table<UserVoucherRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage }}
        columns={[
          {
            title: 'Khách hàng',
            key: 'customer',
            render: (_, row) => (
              <div>
                <div style={{ fontWeight: 500 }}>{userName(row)}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.user?.phone_number}</div>
              </div>
            ),
          },
          {
            title: 'Quà / Voucher',
            dataIndex: ['voucher', 'title'],
            render: (v, row) => (
              <div>
                <div>{v ?? '—'}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {row.voucher?.required_points ? `${row.voucher.required_points.toLocaleString('vi-VN')} điểm` : ''}
                </Typography.Text>
              </div>
            ),
          },
          {
            title: 'Ngày đổi',
            dataIndex: 'redeemed_at',
            width: 150,
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—'),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 130,
            render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
          { title: 'Ghi chú', dataIndex: 'note', render: (v) => v || '—' },
          {
            title: '',
            width: 200,
            render: (_, row) => (
              <Space>
                {row.status === 'redeemed' && (
                  <>
                    <Button size="small" type="primary" ghost onClick={() => markDone(row)}>
                      Đã nhận quà
                    </Button>
                    <Popconfirm title="Thu hồi voucher này?" okText="Thu hồi" cancelText="Hủy" onConfirm={() => revoke(row)}>
                      <Button size="small" danger>
                        Thu hồi
                      </Button>
                    </Popconfirm>
                  </>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal title="Ghi nhận đổi quà" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Lưu" cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="user_id" label="Khách hàng (tài khoản app)" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn khách hàng"
              options={users.map((u) => ({
                value: u.id,
                label: `${u.zalo_name || 'Khách'} — ${u.phone_number || u.id.slice(0, 8)}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="voucher_id" label="Quà / Voucher" rules={[{ required: true, message: 'Chọn quà' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn voucher"
              options={vouchers.map((v) => ({
                value: v.id,
                label: `${v.title}${v.required_points ? ` (${v.required_points} điểm)` : ''}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Select
              allowClear
              placeholder="Chọn hoặc để trống"
              options={[
                { value: 'Đổi tại quầy', label: 'Đổi tại quầy' },
                { value: 'Đổi qua hotline', label: 'Đổi qua hotline' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
