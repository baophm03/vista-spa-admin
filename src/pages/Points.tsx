import { useRef, useState } from 'react'
import { Button, Card, Col, Divider, Form, Input, InputNumber, Modal, Popconfirm, Popover, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { EyeOutlined, FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useBrandCurrency } from '@/themeRuntime'
import PageTitle from '../components/base/PageTitle'
import CustomerCodeHistoryModal from '../components/CustomerCodeHistoryModal'
import {
  useGetCardRanks,
  usePostMembershipsUserIdPointsAdjust,
  usePostMembershipsUserIdRankOverride,
  usePostMembershipsUserIdRecalculate,
} from '../api/endpoints/membership'
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
  full_name?: string
  phone?: string
  user_id?: string | null
  user?: { zalo_name?: string | null; phone_number?: string | null } | null
  membership?: {
    id?: string
    lifetime_points?: number
    year_spent?: number
    card_rank_id?: string
    card_rank?: { name?: string }
  } | null
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
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [rankFilter, setRankFilter] = useState<string>()
  const [draftSearchText, setDraftSearchText] = useState('')
  const [draftRankFilter, setDraftRankFilter] = useState<string>()
  const [filters, setFilters] = useState<{ q?: string; rank_id?: string }>({})
  const [adjusting, setAdjusting] = useState<MemberRow | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<{ row: MemberRow; rankId: string } | null>(null)
  const [historyTarget, setHistoryTarget] = useState<MemberRow | null>(null)
  const [historyProfileId, setHistoryProfileId] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [overrideForm] = Form.useForm()
  const adjustSubmitLock = useRef(false)
  const memberProfilesQuery = useGetCustomerProfiles({ page, limit, ...filters } as Parameters<typeof useGetCustomerProfiles>[0])
  const ranksQuery = useGetCardRanks()
  const adjustMutation = usePostMembershipsUserIdPointsAdjust()
  const overrideMutation = usePostMembershipsUserIdRankOverride()
  const recalcMutation = usePostMembershipsUserIdRecalculate()
  const rows = (memberProfilesQuery.data?.responseData ?? (memberProfilesQuery.data as any)?.data ?? []) as MemberRow[]
  const total = memberProfilesQuery.data?.meta?.total ?? rows.length
  const ranksData = (ranksQuery.data?.responseData ?? (ranksQuery.data as any)?.data ?? []) as RankRow[]
  const ranks = Array.isArray(ranksData) ? [...ranksData].sort((a, b) => a.sort_order - b.sort_order) : []
  const loading = memberProfilesQuery.isLoading
  const activeFilterCount = Number(Boolean(filters.q)) + Number(Boolean(filters.rank_id))

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    setDraftSearchText(searchText)
    setDraftRankFilter(rankFilter)
  }

  const applyFilters = () => {
    const nextFilters: typeof filters = {}
    if (draftSearchText.trim()) nextFilters.q = draftSearchText.trim()
    if (draftRankFilter) nextFilters.rank_id = draftRankFilter
    setSearchText(draftSearchText.trim())
    setRankFilter(draftRankFilter)
    setFilters(nextFilters)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    setSearchText('')
    setRankFilter(undefined)
    setDraftSearchText('')
    setDraftRankFilter(undefined)
    setFilters({})
    setPage(1)
  }

  // Lịch sử điểm: map user id → customer profile id để gọi LY-01
  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const profilesData = (profilesQuery.data?.responseData ?? (profilesQuery.data as any)?.data ?? []) as ProfileLite[]
  const pointsQuery = useGetCustomerProfilesIdPoints(historyProfileId ?? '')
  const pointsData = pointsQuery.data?.responseData ?? null
  const historyRows = (pointsData?.history ?? []) as Array<MembershipTransaction & { reason?: string }>

  const rankName = (id?: string) => ranks.find((r) => r.id === id)?.name ?? '—'

  const submitAdjust = async () => {
    if (adjustSubmitLock.current || !adjusting) return
    adjustSubmitLock.current = true
    try {
      let values: { delta: number; reason: string }
      try {
        values = await form.validateFields()
      } catch {
        return
      }
      await adjustMutation.mutateAsync({ userId: adjusting!.id, data: { delta: values.delta, reason: values.reason } })
      message.success('Đã điều chỉnh điểm')
      if (historyProfileId === adjusting!.id) await pointsQuery.refetch()
      setAdjusting(null)
      form.resetFields()
      await memberProfilesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể điều chỉnh điểm')
    } finally {
      adjustSubmitLock.current = false
    }
  }

  const doOverride = async (row: MemberRow, rankId: string) => {
    setOverrideTarget({ row, rankId })
    overrideForm.setFieldsValue({ reason: '' })
  }

  const submitOverride = async () => {
    try {
      const values = await overrideForm.validateFields()
      if (!overrideTarget) return
      await overrideMutation.mutateAsync({ userId: overrideTarget.row.id, data: { rank_id: overrideTarget.rankId, reason: values.reason.trim() } })
      message.success('Đã gán hạng mới')
      setOverrideTarget(null)
      overrideForm.resetFields()
      await memberProfilesQuery.refetch()
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(err instanceof Error ? err.message : 'Không thể gán hạng')
    }
  }

  const doRecalc = async (row: MemberRow) => {
    try {
      await recalcMutation.mutateAsync({ userId: row.id })
      message.success('Đã tính lại hạng')
      await memberProfilesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể tính lại hạng')
    }
  }

  return (
    <>
      <PageTitle
        extra={<Button icon={<ReloadOutlined />} onClick={() => memberProfilesQuery.refetch()} className="max-sm:w-full" />}
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

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 28, marginBottom: 12 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Thành viên & điểm hiện có
        </Typography.Title>
        <Popover
          trigger="click"
          placement="bottomRight"
          open={filterOpen}
          onOpenChange={openFilters}
          content={(
            <div style={{ width: 'min(300px, calc(100vw - 32px))' }}>
              <Input
                allowClear
                prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
                placeholder="Tìm tên, số điện thoại, mã khách..."
                value={draftSearchText}
                onChange={(event) => setDraftSearchText(event.target.value)}
                onPressEnter={applyFilters}
              />
              <Divider style={{ margin: '14px 0' }} />
              <Typography.Text strong>Điều kiện lọc</Typography.Text>
              <div style={{ marginTop: 10 }}>
                <Typography.Text type="secondary">Hạng thành viên</Typography.Text>
                <Select
                  allowClear
                  placeholder="Tất cả hạng"
                  style={{ width: '100%', marginTop: 6 }}
                  value={draftRankFilter}
                  onChange={setDraftRankFilter}
                  options={ranks.map((rank) => ({ value: rank.id, label: rank.name }))}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 12, marginTop: 14, borderTop: '1px solid var(--brand-border-soft)' }}>
                <Button disabled={!activeFilterCount && !draftSearchText && !draftRankFilter} onClick={clearFilters}>Xóa lọc</Button>
                <Button type="primary" onClick={applyFilters}>Xác nhận</Button>
              </div>
            </div>
          )}
        >
          <Button icon={<FilterOutlined />}>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Button>
        </Popover>
      </div>
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
                <div style={{ fontWeight: 500 }}>{row.full_name || row.user?.zalo_name || '—'}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.phone || row.user?.phone_number}</div>
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
                {Number(row.membership?.lifetime_points ?? 0).toLocaleString('vi-VN')}
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
            width: 380,
            render: (_, row) => (
              <Space>
                <Can I="POINTS_ADJUST" a="MEMBERSHIP">
                  <Button
                    size="small"
                    onClick={() => {
                      setAdjusting(row)
                      form.resetFields()
                      form.setFieldsValue({ reason: '' })
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
                <Can I="READ" a="CUSTOMER">
                  <Can I="POINTS_ADJUST" a="MEMBERSHIP">
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setHistoryTarget(row)}>
                      Chi tiết
                    </Button>
                  </Can>
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
        value={historyProfileId ?? undefined}
        onChange={(v) => setHistoryProfileId(v ?? null)}
        options={profilesData.map((profile) => ({ value: profile.id, label: profile.full_name || profile.phone || profile.id }))}
        />
        {historyProfileId && (
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
        loading={!!historyProfileId && pointsQuery.isLoading}
        dataSource={historyRows}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: historyProfileId ? 'Không có giao dịch điểm' : 'Chọn khách hàng để xem lịch sử điểm' }}
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
          {
            title: 'Lý do',
            dataIndex: 'reason',
            render: (reason?: string) => reason || '—',
          },
        ]}
      />

      <Modal
        title={`Điều chỉnh điểm — ${adjusting?.full_name || adjusting?.phone || ''}`}
        open={!!adjusting}
        confirmLoading={adjustMutation.isPending}
        okButtonProps={{ disabled: adjustMutation.isPending }}
        onCancel={() => setAdjusting(null)}
        onOk={submitAdjust}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="delta"
            label="Điểm thay đổi (+ cộng, − trừ)"
            help={Number(adjusting?.membership?.lifetime_points ?? 0) > 0
              ? `Hiện có ${Number(adjusting?.membership?.lifetime_points ?? 0).toLocaleString('vi-VN')} điểm. Nhập -${Number(adjusting?.membership?.lifetime_points ?? 0).toLocaleString('vi-VN')} để đưa số dư về 0.`
              : 'Nhập số dương để cộng hoặc số âm để trừ.'}
            rules={[{ required: true, message: 'Nhập số điểm' }, { validator: async (_, value) => Number.isInteger(Number(value)) ? Promise.resolve() : Promise.reject(new Error('Số điểm phải là số nguyên')) }]}
          >
            <InputNumber style={{ width: '100%' }} step={10} precision={0} />
          </Form.Item>
          <Form.Item name="reason" label="Lý do" rules={[{ validator: async (_, value) => String(value ?? '').trim() ? Promise.resolve() : Promise.reject(new Error('Nhập lý do')) }]}>
            <Input placeholder="VD: Bù điểm chương trình ưu đãi" maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Gán hạng — ${overrideTarget?.row.full_name || overrideTarget?.row.phone || ''}`}
        open={!!overrideTarget}
        confirmLoading={overrideMutation.isPending}
        onCancel={() => setOverrideTarget(null)}
        onOk={() => void submitOverride()}
        okText="Gán hạng"
        cancelText="Hủy"
      >
        <Form form={overrideForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="Hạng mới">
            <Typography.Text>{rankName(overrideTarget?.rankId)}</Typography.Text>
          </Form.Item>
          <Form.Item name="reason" label="Lý do gán hạng" rules={[{ validator: async (_, value) => String(value ?? '').trim() ? Promise.resolve() : Promise.reject(new Error('Nhập lý do')) }]}>
            <Input.TextArea rows={3} maxLength={500} placeholder="Nhập lý do đặc cách gán hạng" />
          </Form.Item>
        </Form>
      </Modal>

      <CustomerCodeHistoryModal
        open={!!historyTarget}
        profileId={historyTarget?.id}
        title="Lịch sử hạng, mã khách và điểm"
        emptyDescription="Chưa có lịch sử gán hoặc đổi hạng"
        includePointsHistory
        onClose={() => setHistoryTarget(null)}
      />
    </>
  )
}

