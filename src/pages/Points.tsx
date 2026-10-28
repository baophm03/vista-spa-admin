import { useState } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useBrandCurrency } from '@/themeRuntime'
import PageTitle from '../components/base/PageTitle'
import {
  useGetCardRanks,
  usePostMembershipsUserIdPointsAdjust,
  usePostMembershipsUserIdRankOverride,
  usePostMembershipsUserIdRecalculate,
} from '../api/endpoints/membership'
import { useGetUsers } from '../api/endpoints/users'
import { useGetCustomerProfilesIdPoints } from '../api/endpoints/customer-profiles'
import type { MembershipTransaction } from '../api/models'
import { useGetCustomerProfiles } from '../api/endpoints/customer-profiles'
import { Can } from '@casl/react'

interface RankRow {
  id: string
  code: string
  name: string
  sort_order: number
  min_spent?: number
  max_spent?: number
  validity?: string
  benefits?: string
  is_active?: boolean
}

interface MemberRow {
  id: string
  zalo_name?: string
  phone_number?: string
  membership?: {
    id?: string
    points?: number
    year_spent?: number
    card_rank_id?: string
    card_rank?: { name?: string }
  }
}

interface ProfileLite {
  id: string
  user_id?: string | null
  full_name?: string
  phone?: string
}

const REF_TYPE_LABELS: Record<string, string> = {
  PAYMENT: 'Thanh toán',
  MANUAL: 'Điều chỉnh tay',
  RANK: 'Hạng',
  REWARD: 'Đổi quà',
  REWARD_CANCEL: 'Hủy đổi quà',
  REDEEM: 'Trừ vào gói',
  WHEEL: 'Vòng quay',
}

export default function Points() {
  const { format: formatMoney } = useBrandCurrency()
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [adjusting, setAdjusting] = useState<MemberRow | null>(null)
  const [historyUserId, setHistoryUserId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const usersQuery = useGetUsers({ currentPage: page, pageSize: limit })
  const ranksQuery = useGetCardRanks()
  const adjustMutation = usePostMembershipsUserIdPointsAdjust()
  const overrideMutation = usePostMembershipsUserIdRankOverride()
  const recalcMutation = usePostMembershipsUserIdRecalculate()
  const usersData = (usersQuery.data?.responseData ?? (usersQuery.data as any)?.data ?? {}) as { rows?: MemberRow[]; count?: number }
  const rows = (usersData.rows ?? []).filter((user) => user.membership)
  const total = usersData.count ?? rows.length
  const ranksData = (ranksQuery.data?.responseData ?? (ranksQuery.data as any)?.data ?? []) as RankRow[]
  const ranks = Array.isArray(ranksData) ? [...ranksData].sort((a, b) => a.sort_order - b.sort_order) : []
  const loading = usersQuery.isLoading

  // Lịch sử điểm: map user id → customer profile id để gọi LY-01
  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const profilesData = (profilesQuery.data?.responseData ?? (profilesQuery.data as any)?.data ?? []) as ProfileLite[]
  const profileIdByUserId = new Map(
    profilesData.filter((p) => p.user_id).map((p) => [p.user_id as string, p.id]),
  )
  const historyProfileId = historyUserId ? profileIdByUserId.get(historyUserId) ?? null : null
  const pointsQuery = useGetCustomerProfilesIdPoints(historyProfileId ?? '')
  const pointsData = pointsQuery.data?.responseData ?? null
  const historyRows = pointsData?.history ?? []

  const rankName = (id?: string) => ranks.find((r) => r.id === id)?.name ?? '—'

  const submitAdjust = async () => {
    const values = await form.validateFields()
    try {
      await adjustMutation.mutateAsync({ userId: adjusting!.id, data: { delta: values.delta, reason: values.reason } })
      message.success('Đã điều chỉnh điểm')
      setAdjusting(null)
      form.resetFields()
      await usersQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể điều chỉnh điểm')
    }
  }

  const doOverride = async (row: MemberRow, rankId: string) => {
    try {
      await overrideMutation.mutateAsync({ userId: row.id, data: { rank_id: rankId, reason: 'Gán hạng bởi admin' } })
      message.success('Đã gán hạng mới')
      await usersQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể gán hạng')
    }
  }

  const doRecalc = async (row: MemberRow) => {
    try {
      await recalcMutation.mutateAsync({ userId: row.id })
      message.success('Đã tính lại hạng')
      await usersQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể tính lại hạng')
    }
  }

  return (
    <>
      <PageTitle
        extra={<Button icon={<ReloadOutlined />} onClick={() => usersQuery.refetch()} className="max-sm:w-full" />}
      >
        Điểm & Hạng thành viên
      </PageTitle>

      <Row gutter={[20, 20]}>
        {ranks.map((r) => (
          <Col xs={24} md={8} key={r.id} style={{ display: 'flex' }}>
            <Card styles={{ body: { padding: 20 } }} style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color={r.is_active ? 'purple' : 'default'} style={{ fontSize: 13, padding: '2px 12px' }}>
                  {r.name}
                </Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.min_spent ? `Từ ${formatMoney(r.min_spent)}` : 'Không ngưỡng'}
                </Typography.Text>
              </div>
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#6F7071' }}>Hiệu lực: </span>
                  <span style={{ fontWeight: 600, color: 'var(--brand-dark)' }}>{r.validity === 'PERMANENT' ? 'Vĩnh viễn' : '1 năm'}</span>
                </div>
                <div style={{ marginTop: 6, color: '#6F7071' }}>{r.benefits || 'Chưa mô tả quyền lợi'}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Typography.Title level={5} style={{ marginTop: 28 }}>
        Thành viên & điểm hiện có
      </Typography.Title>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage }}
        columns={[
          {
            title: 'Khách hàng',
            render: (_, row: MemberRow) => (
              <div>
                <div style={{ fontWeight: 500 }}>{row.zalo_name || '—'}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.phone_number}</div>
              </div>
            ),
          },
          {
            title: 'Hạng',
            width: 130,
            render: (_, row) => <Tag color="purple">{row.membership?.card_rank?.name ?? rankName(row.membership?.card_rank_id)}</Tag>,
          },
          {
            title: 'Điểm',
            width: 110,
            render: (_, row) => (
              <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                {Number(row.membership?.points ?? 0).toLocaleString('vi-VN')}
              </span>
            ),
          },
          {
            title: 'Chi tiêu năm',
            width: 140,
            render: (_, row) => formatMoney(row.membership?.year_spent),
          },
          {
            title: '',
            width: 300,
            render: (_, row) => (
              <Space>
                <Can I="POINTS_ADJUST" a="MEMBERSHIP">
                  <Button
                    size="small"
                    onClick={() => {
                      setAdjusting(row)
                      form.setFieldsValue({ delta: 0, reason: '' })
                    }}
                  >
                    Điều chỉnh điểm
                  </Button>
                </Can>
                <Can I="RANK_OVERRIDE" a="MEMBERSHIP">
                  <Select
                    size="small"
                    placeholder="Gán hạng"
                    style={{ width: 120 }}
                    options={ranks.map((r) => ({ value: r.id, label: r.name }))}
                    onChange={(v) => doOverride(row, v)}
                  />
                </Can>
                <Can I="RECALCULATE" a="MEMBERSHIP">
                  <Popconfirm title="Tính lại hạng theo chi tiêu?" onConfirm={() => doRecalc(row)}>
                    <Button size="small">Tính lại</Button>
                  </Popconfirm>
                </Can>
              </Space>
            ),
          },
        ]}
      />

      <Typography.Title level={5} style={{ marginTop: 28 }}>
        Lịch sử điểm
      </Typography.Title>
      <Space style={{ marginBottom: 12 }} wrap>
        <Select
          placeholder="Chọn khách hàng"
          style={{ width: 280 }}
          allowClear
          showSearch
          optionFilterProp="label"
          value={historyUserId ?? undefined}
          onChange={(v) => setHistoryUserId(v ?? null)}
          options={rows.map((r) => ({ value: r.id, label: r.zalo_name || r.phone_number || r.id }))}
        />
        {historyUserId && (
          <span style={{ fontSize: 13 }}>
            Số điểm hiện tại:{' '}
            <b style={{ color: 'var(--brand-primary)' }}>
              {Number(pointsData?.points ?? 0).toLocaleString('vi-VN')}
            </b>
          </span>
        )}
      </Space>
      <Table
        rowKey="id"
        size="small"
        loading={!!historyUserId && pointsQuery.isLoading}
        dataSource={historyRows}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: historyUserId ? 'Không có giao dịch điểm' : 'Chọn khách hàng để xem lịch sử điểm' }}
        columns={[
          {
            title: 'Thời gian',
            width: 170,
            render: (_, row: MembershipTransaction) =>
              row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : '—',
          },
          {
            title: 'Loại',
            width: 140,
            render: (_, row: MembershipTransaction) => (
              <Tag color={Number(row.points_earned ?? 0) >= 0 ? 'green' : 'red'}>
                {REF_TYPE_LABELS[row.ref_type ?? ''] ?? row.ref_type ?? '—'}
              </Tag>
            ),
          },
          {
            title: 'Điểm',
            width: 110,
            align: 'right',
            render: (_, row: MembershipTransaction) => {
              const delta = Number(row.points_earned ?? 0)
              return (
                <span style={{ fontWeight: 600, color: delta >= 0 ? '#389e0d' : '#cf1322' }}>
                  {delta >= 0 ? `+${delta}` : delta}
                </span>
              )
            },
          },
          {
            title: 'Số tiền',
            width: 140,
            align: 'right',
            render: (_, row: MembershipTransaction) =>
              row.amount ? `${Number(row.amount).toLocaleString('vi-VN')}đ` : '—',
          },
          {
            title: 'Mã giao dịch',
            render: (_, row: MembershipTransaction) => (
              <Typography.Text code style={{ fontSize: 12 }}>
                {row.trans_code}
              </Typography.Text>
            ),
          },
        ]}
      />

      <Modal
        title={`Điều chỉnh điểm — ${adjusting?.zalo_name || adjusting?.phone_number || ''}`}
        open={!!adjusting}
        onCancel={() => setAdjusting(null)}
        onOk={submitAdjust}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="delta"
            label="Số điểm (âm = trừ)"
            rules={[{ required: true, message: 'Nhập số điểm' }]}
          >
            <InputNumber style={{ width: '100%' }} step={10} />
          </Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ required: true, message: 'Nhập lý do' }]}>
            <Input placeholder="VD: Bù điểm chương trình ưu đãi" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

