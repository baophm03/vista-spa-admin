import { useState } from 'react'
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import PageTitle from '../components/base/PageTitle'
import {
  useGetCardRanks,
  usePostMembershipsUserIdPointsAdjust,
  usePostMembershipsUserIdRankOverride,
  usePostMembershipsUserIdRecalculate,
} from '../api/endpoints/membership'
import { useGetUsers } from '../api/endpoints/users'

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

export default function Points() {
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [adjusting, setAdjusting] = useState<MemberRow | null>(null)
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
                  {r.min_spent ? `Từ ${Number(r.min_spent).toLocaleString('vi-VN')}đ` : 'Không ngưỡng'}
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
            render: (_, row) => `${Number(row.membership?.year_spent ?? 0).toLocaleString('vi-VN')}đ`,
          },
          {
            title: '',
            width: 300,
            render: (_, row) => (
              <Space>
                <Button
                  size="small"
                  onClick={() => {
                    setAdjusting(row)
                    form.setFieldsValue({ delta: 0, reason: '' })
                  }}
                >
                  Điều chỉnh điểm
                </Button>
                <Select
                  size="small"
                  placeholder="Gán hạng"
                  style={{ width: 120 }}
                  options={ranks.map((r) => ({ value: r.id, label: r.name }))}
                  onChange={(v) => doOverride(row, v)}
                />
                <Popconfirm title="Tính lại hạng theo chi tiêu?" onConfirm={() => doRecalc(row)}>
                  <Button size="small">Tính lại</Button>
                </Popconfirm>
              </Space>
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
