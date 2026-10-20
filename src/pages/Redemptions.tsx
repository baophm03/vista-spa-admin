import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Form, Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import PageTitle from '../components/PageTitle'
import {
  bizErrorMessage,
  listRedeemedVouchers,
  listUsers,
  listVouchers,
  markVoucherUsed,
  redeemVoucher,
  revokeUserVoucher,
  voucherStatistics,
} from '../api/newsky'
import type { UserVoucherRow } from '../api/newsky'

const STATUS_META: Record<string, { label: string; color: string }> = {
  redeemed: { label: 'Chờ nhận', color: 'orange' },
  used: { label: 'Đã nhận quà', color: 'green' },
  revoked: { label: 'Đã thu hồi', color: 'red' },
}

export default function Redemptions() {
  const [rows, setRows] = useState<UserVoucherRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [users, setUsers] = useState<{ id: string; zalo_name?: string; phone_number?: string }[]>([])
  const [vouchers, setVouchers] = useState<{ id: string; title: string; required_points?: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<{ total: number; pending: number; used: number }>({ total: 0, pending: 0, used: 0 })
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listRedeemedVouchers({ page, limit })
      setRows(data?.rows ?? [])
      setTotal(data?.count ?? data?.rows?.length ?? 0)
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, limit])

  useEffect(() => {
    load()
    voucherStatistics()
      .then((s: any) =>
        setStats({
          total: s?.overview?.total_redemptions ?? 0,
          pending: s?.overview?.pending_redemptions ?? 0,
          used: s?.overview?.used_redemptions ?? 0,
        }),
      )
      .catch(() => undefined)
  }, [load])

  useEffect(() => {
    listUsers({ page: 1, limit: 200 })
      .then((d: any) => setUsers(d?.rows ?? []))
      .catch(() => undefined)
    listVouchers({ page: 1, limit: 200 })
      .then((d: any) => setVouchers(d?.rows ?? []))
      .catch(() => undefined)
  }, [])

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await redeemVoucher(values.voucher_id, { user_id: values.user_id, note: values.note })
      message.success('Đã ghi nhận đổi quà')
      setOpen(false)
      form.resetFields()
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const markDone = async (row: UserVoucherRow) => {
    try {
      await markVoucherUsed({ user_voucher_id: row.id, note: 'Nhận quà tại spa' })
      message.success('Đã đánh dấu khách nhận quà')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const revoke = async (row: UserVoucherRow) => {
    try {
      await revokeUserVoucher({ user_voucher_id: row.id, reason: 'Thu hồi bởi admin' })
      message.success('Đã thu hồi voucher')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const userName = (row: UserVoucherRow) => row.user?.zalo_name || row.user?.phone_number || row.user_id?.slice(0, 8)

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
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

      <Table
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
