import { useRef, useState } from 'react'
import { Button, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { ClockCircleOutlined, CrownOutlined, EditOutlined, EyeOutlined, ReloadOutlined, SearchOutlined, SyncOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useBrandCurrency } from '@/themeRuntime'
import PageTitle from '../../components/base/PageTitle'
import ListFilterPopover from '../../components/base/ListFilterPopover'
import RowActionsMenu from '../../components/base/RowActionsMenu'
import ListPagination from '../../components/base/ListPagination'
import TableEmpty from '../../components/base/TableEmpty'
import { paginateRows } from '../../utils/listTable'
import CustomerCodeHistoryModal from '../../components/CustomerCodeHistoryModal'
import {
  useGetCardRanks,
  usePostMembershipsCustomerProfileIdPointsAdjust,
  usePostMembershipsCustomerProfileIdRankOverride,
  usePostMembershipsCustomerProfileIdRecalculate,
} from '../../api/endpoints/membership'
import { useGetCustomerProfilesIdPoints } from '../../api/endpoints/customer-profiles'
import type { MembershipTransaction } from '../../api/models'
import { useGetCustomerProfiles } from '../../api/endpoints/customer-profiles'
import { useAbility } from '@casl/react'
import AdjustPointsModal from './components/AdjustPointsModal'
import RankOverrideModal from './components/RankOverrideModal'
import {
  DEFAULT_VISIBLE_COLUMNS,
  POINT_COLUMN_OPTIONS,
  RANK_THEMES,
  REF_TYPE_LABELS,
  hexLuminance,
  normalizeHex,
  rankThemeFromColor,
  type MemberRow,
  type PointColumnKey,
  type ProfileLite,
  type RankRow,
} from './components/constants'

/** Badge hạng dùng màu của hạng (giống thẻ ở trên); hạng chưa có màu thì badge màu trung tính. */
function RankBadge({ rank, label }: { rank?: RankRow; label: string }) {
  const hex = rank?.color ? normalizeHex(rank.color) : null
  if (!hex) return <Tag>{label}</Tag>
  const onColor = hexLuminance(hex) > 0.62 ? '#3F3F46' : '#FFFFFF'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: hex,
        color: onColor,
        borderRadius: 999,
        padding: '2px 12px',
        fontSize: 12,
        fontWeight: 600,
        maxWidth: 150,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {label}
    </span>
  )
}

export default function Points() {
  const { format: formatMoney } = useBrandCurrency()
  const navigate = useNavigate()
  const ability = useAbility()
  const canAdjust = ability.can('POINTS_ADJUST', 'MEMBERSHIP')
  const canOverride = ability.can('RANK_OVERRIDE', 'MEMBERSHIP')
  const canRecalc = ability.can('RECALCULATE', 'MEMBERSHIP')
  const canViewHistory = ability.can('READ', 'CUSTOMER') && canAdjust
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<{ q?: string; rank_id?: string }>({})
  const [visibleColumns, setVisibleColumns] = useState<PointColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<PointColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [adjusting, setAdjusting] = useState<MemberRow | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<{ row: MemberRow } | null>(null)
  const [historyTarget, setHistoryTarget] = useState<MemberRow | null>(null)
  const [historyProfileId, setHistoryProfileId] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [form] = Form.useForm()
  const [overrideForm] = Form.useForm()
  const [filterForm] = Form.useForm()
  const adjustSubmitLock = useRef(false)
  const memberProfilesQuery = useGetCustomerProfiles({ page, limit, ...filters } as Parameters<typeof useGetCustomerProfiles>[0])
  const ranksQuery = useGetCardRanks()
  const adjustMutation = usePostMembershipsCustomerProfileIdPointsAdjust()
  const overrideMutation = usePostMembershipsCustomerProfileIdRankOverride()
  const recalcMutation = usePostMembershipsCustomerProfileIdRecalculate()
  const rows = (memberProfilesQuery.data?.responseData ?? (memberProfilesQuery.data as any)?.data ?? []) as MemberRow[]
  const total = memberProfilesQuery.data?.meta?.total ?? rows.length
  const ranksData = (ranksQuery.data?.responseData ?? (ranksQuery.data as any)?.data ?? []) as RankRow[]
  const ranks = Array.isArray(ranksData) ? [...ranksData].sort((a, b) => a.sort_order - b.sort_order) : []
  const loading = memberProfilesQuery.isLoading
  const activeFilterCount = Number(Boolean(filters.q)) + Number(Boolean(filters.rank_id))

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setFilters((current) => ({ ...current, q: nextKeyword.trim() || undefined }))
    setPage(1)
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ rank_id: filters.rank_id })
    setDraftVisibleColumns(visibleColumns)
  }

  const applyFilters = (values: Record<string, unknown>) => {
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    const nextFilters: typeof filters = {}
    if (searchText.trim()) nextFilters.q = searchText.trim()
    if (typeof values.rank_id === 'string' && values.rank_id) nextFilters.rank_id = values.rank_id
    setFilters(nextFilters)
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setSearchText('')
    setFilters({})
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
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
      await adjustMutation.mutateAsync({ customerProfileId: adjusting!.id, data: { delta: values.delta, reason: values.reason } })
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

  const doOverride = (row: MemberRow) => {
    setOverrideTarget({ row })
    overrideForm.resetFields()
  }

  const submitOverride = async () => {
    try {
      const values = await overrideForm.validateFields()
      if (!overrideTarget || !values.rank_id) return
      await overrideMutation.mutateAsync({ customerProfileId: overrideTarget.row.id, data: { rank_id: values.rank_id, reason: values.reason.trim() } })
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
      await recalcMutation.mutateAsync({ customerProfileId: row.id })
      message.success('Đã tính lại hạng')
      await memberProfilesQuery.refetch()
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Không thể tính lại hạng')
    }
  }

  return (
    <>
      <PageTitle
        subtitle="Tích điểm, xét hạng và điều chỉnh điểm cho hội viên"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
              placeholder="Tìm tên, SĐT, mã khách..."
              style={{ width: 260 }}
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                if (!event.target.value) applySearch('')
              }}
              onPressEnter={() => applySearch(searchText)}
            />
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={POINT_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as PointColumnKey[])}
              filterItems={(
                <Form.Item name="rank_id" label="Hạng thành viên" style={{ marginBottom: 0 }}>
                  <Select allowClear placeholder="Tất cả hạng" options={ranks.map((rank) => ({ value: rank.id, label: rank.name }))} />
                </Form.Item>
              )}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void memberProfilesQuery.refetch()}>Tải lại</Button>
          </Space>
        }
      >
        Điểm & Hạng thành viên
      </PageTitle>

      <div style={{ background: 'var(--brand-bg-card, #FFFFFF)', border: '1px solid var(--brand-border-soft, #ECEFEA)', borderRadius: 20, padding: '24px 24px 28px', marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ display: 'inline-block', background: 'var(--brand-tertiary-tint)', color: 'var(--brand-tertiary-ink)', border: '1px solid var(--brand-tertiary-border)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999 }}>
              New Sky Vista Club
            </span>
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 10 }}>
              Cấu hình tiêu chí nâng hạng và chính sách đặc quyền thưởng lưu danh cho hội viên
            </Typography.Text>
          </div>
          <Button shape="circle" icon={<ReloadOutlined />} aria-label="Tải lại hạng thẻ" onClick={() => void ranksQuery.refetch()} />
        </div>

        <Row gutter={[20, 20]} style={{ marginTop: 22 }}>
          {ranks.map((r, index) => {
            const fallback = RANK_THEMES[index % RANK_THEMES.length]
            const theme = r.color ? rankThemeFromColor(r.color, fallback) : fallback
            const RankIcon = theme.icon
            return (
              <Col xs={24} md={8} key={r.id} style={{ display: 'flex' }}>
                <div
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    borderRadius: 16,
                    border: `1px solid ${theme.cardBorder}`,
                    background: theme.cardBg,
                    padding: 20,
                    boxShadow: '0 1px 2px rgba(38, 53, 45, 0.04)',
                  }}
                >
                  <div aria-hidden style={{ position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%', background: theme.circle }} />
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: theme.pillBg,
                        border: `1px solid ${theme.pillBorder}`,
                        color: theme.pillColor,
                        borderRadius: 999,
                        padding: '3px 12px',
                        fontSize: 13,
                        fontWeight: 600,
                        maxWidth: '70%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <RankIcon style={{ fontSize: 13, flexShrink: 0 }} />
                      {r.name}
                    </span>
                    <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
                      Điều kiện
                    </Typography.Text>
                  </div>
                  <div style={{ position: 'relative', textAlign: 'right', marginTop: 4, fontSize: 22, fontWeight: 700, color: 'var(--brand-dark, #26352D)' }}>
                    {r.min_spent ? `Từ ${formatMoney(r.min_spent)}` : 'Không ngưỡng'}
                  </div>
                  <div style={{ position: 'relative', marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <ClockCircleOutlined style={{ color: '#8A8D93' }} />
                    <span style={{ color: '#6F7071' }}>Hiệu lực:</span>
                    {r.validity === 'PERMANENT' ? (
                      <Tag color="green" style={{ borderRadius: 999, marginInlineEnd: 0 }}>Vĩnh viễn</Tag>
                    ) : (
                      <span style={{ fontWeight: 600, color: 'var(--brand-dark, #26352D)' }}>1 năm</span>
                    )}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      marginTop: 14,
                      border: '1px dashed',
                      borderColor: theme.pillBorder,
                      borderRadius: 12,
                      padding: '11px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      background: 'rgba(255, 255, 255, 0.6)',
                    }}
                  >
                    <Typography.Text type="secondary" style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.benefits || 'Chưa mô tả quyền lợi'}
                    </Typography.Text>
                    <Button
                      type="link"
                      size="small"
                      style={{ color: theme.ink, fontWeight: 700, padding: 0, flexShrink: 0 }}
                      onClick={() => navigate('/card-ranks')}
                    >
                      + Thêm
                    </Button>
                  </div>
                </div>
              </Col>
            )
          })}
        </Row>
        {ranks.length === 0 && (
          <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '16px 0 0' }}>
            Chưa có hạng thẻ nào
          </Typography.Text>
        )}
      </div>

      <Typography.Title level={5} style={{ marginTop: 28, marginBottom: 12, color: 'var(--brand-secondary-ink)' }}>
        Thành viên & điểm hiện có
      </Typography.Title>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        onRow={(row) => ({
          onClick: canViewHistory ? () => setHistoryTarget(row) : undefined,
          style: canViewHistory ? { cursor: 'pointer' } : undefined,
        })}
        columns={[
          {
            key: 'customer',
            title: 'Khách hàng',
            render: (_value: unknown, row: MemberRow) => (
              <div>
                <div style={{ fontWeight: 500 }}>{row.full_name || row.user?.zalo_name || '—'}</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>{row.phone || row.user?.phone_number}</div>
              </div>
            ),
          },
          {
            key: 'rank',
            title: 'Hạng',
            width: 150,
            render: (_value: unknown, row: MemberRow) => {
              const label = row.membership?.card_rank?.name ?? rankName(row.membership?.card_rank_id)
              const rank = ranks.find((item) => item.id === row.membership?.card_rank_id)
                ?? ranks.find((item) => item.name === label)
              return <RankBadge rank={rank} label={label} />
            },
          },
          {
            key: 'points',
            title: 'Điểm',
            width: 110,
            render: (_value: unknown, row: MemberRow) => (
              <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>
                {Number(row.membership?.lifetime_points ?? 0).toLocaleString('vi-VN')}
              </span>
            ),
          },
          {
            key: 'year_spent',
            title: 'Chi tiêu năm',
            width: 140,
            render: (_value: unknown, row: MemberRow) => formatMoney(row.membership?.year_spent),
          },
          {
            key: 'actions',
            title: 'Hành động', align: 'center' as const,
            width: 90,
            fixed: 'right' as const,
            render: (_value: unknown, row: MemberRow) => (
              <RowActionsMenu
                items={[
                  ...(canAdjust ? [{ key: 'adjust', icon: <EditOutlined />, label: 'Điều chỉnh điểm' }] : []),
                  ...(canOverride ? [{ key: 'override', icon: <CrownOutlined />, label: 'Gán hạng' }] : []),
                  ...(canRecalc ? [{ key: 'recalc', icon: <SyncOutlined />, label: 'Tính lại hạng' }] : []),
                  ...(canViewHistory ? [{ key: 'history', icon: <EyeOutlined />, label: 'Chi tiết' }] : []),
                ]}
                onSelect={(key) => {
                  if (key === 'adjust') {
                    setAdjusting(row)
                    form.resetFields()
                    form.setFieldsValue({ reason: '' })
                  } else if (key === 'override') {
                    doOverride(row)
                  } else if (key === 'recalc') {
                    Modal.confirm({
                      title: 'Tính lại hạng theo chi tiêu?',
                      okText: 'Tính lại',
                      cancelText: 'Hủy',
                      onOk: () => doRecalc(row),
                    })
                  } else if (key === 'history') {
                    setHistoryTarget(row)
                  }
                }}
              />
            ),
          },
        ].filter((column) =>
          (column.key !== 'actions' || canAdjust || canOverride || canRecalc || canViewHistory) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as PointColumnKey)),
        )}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="thành viên" />

      <div style={{ marginTop: 28, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <Typography.Title level={5} style={{ margin: 0, color: 'var(--brand-secondary-ink)' }}>
          Lịch sử điểm
        </Typography.Title>
        <Space wrap>
          {historyProfileId && (
            <span style={{ fontSize: 13 }}>
              Số điểm hiện tại:{' '}
              <b style={{ color: 'var(--brand-primary)' }}>
                {Number(pointsData?.points ?? 0).toLocaleString('vi-VN')}
              </b>
            </span>
          )}
          <Select
            placeholder="Chọn khách hàng"
            style={{ width: 280 }}
            allowClear
            showSearch
            optionFilterProp="label"
            value={historyProfileId ?? undefined}
            onChange={(v) => { setHistoryProfileId(v ?? null); setHistoryPage(1) }}
            options={profilesData.map((profile) => ({ value: profile.id, label: profile.full_name || profile.phone || profile.id }))}
          />
        </Space>
      </div>
      <Table
        rowKey="id"
        loading={!!historyProfileId && pointsQuery.isLoading}
        dataSource={paginateRows(historyRows, historyPage, 10)}
        pagination={false}
        locale={{ emptyText: <TableEmpty description={historyProfileId ? 'Không có giao dịch điểm' : 'Chọn khách hàng để xem lịch sử điểm'} /> }}
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
      <ListPagination page={historyPage} limit={10} total={historyRows.length} onChange={setHistoryPage} noun="giao dịch điểm" />

      <AdjustPointsModal
        adjusting={adjusting}
        confirmLoading={adjustMutation.isPending}
        onCancel={() => setAdjusting(null)}
        onSubmit={submitAdjust}
        form={form}
      />

      <RankOverrideModal
        overrideTarget={overrideTarget}
        confirmLoading={overrideMutation.isPending}
        onCancel={() => setOverrideTarget(null)}
        onSubmit={() => void submitOverride()}
        ranks={ranks}
        form={overrideForm}
      />

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