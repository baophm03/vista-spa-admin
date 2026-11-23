import { useRef, useState } from 'react'
import { Alert, Button, Col, Form, Input, Modal, Row, Select, Skeleton, Space, Table, Tabs, Tag, Typography, message } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, CrownOutlined, DeleteOutlined, DownOutlined, EditOutlined, PlusOutlined, SyncOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Can, useAbility } from '@casl/react'
import { useBrandCurrency } from '@/themeRuntime'

import PageTitle from '../../components/base/PageTitle'
import RowActionsMenu from '../../components/base/RowActionsMenu'
import ListPagination from '../../components/base/ListPagination'
import MobileCards, { MobileCardRow } from '../../components/base/MobileCards'
import TableEmpty from '../../components/base/TableEmpty'
import CustomerCodeHistoryModal from '../../components/CustomerCodeHistoryModal'
import { errorMessage } from '../../api/helpers'
import { getGetCardRanksAdminQueryKey, useDeleteCardRanksIdAdmin, useGetCardRanksAdmin, usePostCardRanksAdmin, usePutCardRanksIdAdmin } from '@/api/endpoints/card-ranks'
import { getMembershipTransactionsAdmin } from '@/api/endpoints/memberships'
import { usePostMembershipsCustomerProfileIdPointsAdjustAdmin, usePostMembershipsCustomerProfileIdRankOverrideAdmin, usePostMembershipsCustomerProfileIdRecalculateAdmin } from '@/api/endpoints/memberships'
import type { MembershipTransaction } from '../../api/models'
import type { PostCardRanksAdminBody } from '../../api/models/postCardRanksAdminBody'
import type { PutCardRanksIdAdminBody } from '../../api/models/putCardRanksIdAdminBody'
import { useGetCustomerProfilesAdmin } from '@/api/endpoints/customer-profiles'

import AdjustPointsModal from './components/AdjustPointsModal'
import RankOverrideModal from './components/RankOverrideModal'
import CardRankModal from './components/CardRankModal'
import {
  RANK_THEMES,
  REF_TYPE_LABELS,
  hexLuminance,
  normalizeHex,
  rankThemeFromColor,
  type CardRankRow,
  type MemberRow,
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

/** 1 dòng log điểm: transaction + membership khách (LY-03 trả về include membership.customer_profile) */
type HistoryRow = MembershipTransaction & {
  reason?: string
  membership?: { lifetime_points?: number; customer_profile?: { id?: string; customer_code?: string; full_name?: string; phone?: string } | null } | null
}

export default function Points() {
  const { format: formatMoney } = useBrandCurrency()
  const queryClient = useQueryClient()
  const ability = useAbility()
  const canAdjust = ability.can('POINTS_ADJUST', 'MEMBERSHIP')
  const canOverride = ability.can('RANK_OVERRIDE', 'MEMBERSHIP')
  const canRecalc = ability.can('RECALCULATE', 'MEMBERSHIP')
  const canViewHistory = ability.can('READ', 'CUSTOMER_PROFILE') && canAdjust
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<{ q?: string; rank_id?: string }>({})
  const [adjusting, setAdjusting] = useState<MemberRow | null>(null)
  const [overrideTarget, setOverrideTarget] = useState<{ row: MemberRow } | null>(null)
  const [historyTarget, setHistoryTarget] = useState<MemberRow | null>(null)
  const [historyProfileId, setHistoryProfileId] = useState<string | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [form] = Form.useForm()
  const [overrideForm] = Form.useForm()
  // Tabs chính: bảng thành viên / lịch sử điểm (khu card hạng nằm ngoài, hiện chung cho cả 2 tab)
  const [activeTab, setActiveTab] = useState('members')
  const [ranksExpanded, setRanksExpanded] = useState(false)
  const adjustSubmitLock = useRef(false)
  const memberProfilesQuery = useGetCustomerProfilesAdmin({ page, limit, ...filters } as Parameters<typeof useGetCustomerProfilesAdmin>[0])
  const ranksQuery = useGetCardRanksAdmin()
  const adjustMutation = usePostMembershipsCustomerProfileIdPointsAdjustAdmin()
  const overrideMutation = usePostMembershipsCustomerProfileIdRankOverrideAdmin()
  const recalcMutation = usePostMembershipsCustomerProfileIdRecalculateAdmin()
  const rows = (memberProfilesQuery.data?.responseData ?? (memberProfilesQuery.data as any)?.data ?? []) as MemberRow[]
  const total = memberProfilesQuery.data?.meta?.total ?? rows.length
  const ranksData = (ranksQuery.data?.responseData ?? (ranksQuery.data as any)?.data ?? []) as RankRow[]
  const ranks = Array.isArray(ranksData) ? [...ranksData].sort((a, b) => a.sort_order - b.sort_order) : []
  const loading = memberProfilesQuery.isLoading

  // ===== CRUD hạng thẻ ngay trên card (gộp từ page /card-ranks) =====

  const canUpdateRank = ability.can('UPDATE' as never, 'CARD_RANK' as never)
  const canDeleteRank = ability.can('DELETE' as never, 'CARD_RANK' as never)
  const [rankModalOpen, setRankModalOpen] = useState(false)
  const [editingRank, setEditingRank] = useState<CardRankRow | null>(null)
  const [rankReordering, setRankReordering] = useState(false)
  const [rankForm] = Form.useForm()
  const invalidateRanks = async () => {
    await queryClient.invalidateQueries({ queryKey: getGetCardRanksAdminQueryKey() })
  }
  const createRankMutation = usePostCardRanksAdmin({ mutation: { onSuccess: invalidateRanks } })
  const updateRankMutation = usePutCardRanksIdAdmin({ mutation: { onSuccess: invalidateRanks } })
  const deleteRankMutation = useDeleteCardRanksIdAdmin({ mutation: { onSuccess: invalidateRanks } })

  const openRankEditor = (row?: CardRankRow) => {
    setEditingRank(row ?? null)
    rankForm.setFieldsValue(
      row
        ? {
          code: row.code,
          name: row.name,
          color: row.color ?? undefined,
          sort_order: row.sort_order ?? 0,
          min_spent: row.min_spent ?? 0,
          max_spent: row.max_spent ?? undefined,
          discount_percent: row.discount_percent ?? undefined,
          validity: row.validity ?? 'PERMANENT',
          auto_assign: row.auto_assign ?? false,
          benefits: row.benefits ?? '',
        }
        : { code: '', name: '', color: undefined, sort_order: (ranks.length ? Math.max(...ranks.map((r) => r.sort_order ?? 0)) : 0) + 1, min_spent: 0, max_spent: undefined, discount_percent: undefined, validity: 'PERMANENT', auto_assign: false, benefits: '' },
    )
    setRankModalOpen(true)
  }

  const submitRank = async () => {
    try {
      const values = await rankForm.validateFields()
      const dto = {
        name: values.name,
        color: values.color || null,
        sort_order: values.sort_order ?? 0,
        min_spent: values.min_spent ?? 0,
        max_spent: values.max_spent ?? undefined,
        discount_percent: values.discount_percent ?? undefined,
        validity: values.validity,
        auto_assign: !!values.auto_assign,
        benefits: values.benefits || undefined,
      }
      if (editingRank) {
        await updateRankMutation.mutateAsync({ id: editingRank.id, data: dto as PutCardRanksIdAdminBody })
        message.success('Đã cập nhật hạng thẻ')
      } else {
        await createRankMutation.mutateAsync({ data: { ...dto, code: values.code } as PostCardRanksAdminBody })
        message.success('Đã tạo hạng thẻ')
      }
      setRankModalOpen(false)
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err))
    }
  }

  const removeRank = (row: CardRankRow) => {
    Modal.confirm({
      title: 'Xóa hạng thẻ này?',
      content: 'Xóa mềm. Không xóa được nếu còn khách giữ hạng hoặc có ưu đãi đang áp dụng.',
      okText: 'Xóa',
      okButtonProps: { danger: true },
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await deleteRankMutation.mutateAsync({ id: row.id })
          message.success('Đã xóa hạng thẻ')
        } catch (err) {
          message.error(errorMessage(err, 'Không xóa được hạng thẻ'))
        }
      },
    })
  }

  /** Đổi thứ tự hạng: đổi chỗ trong mảng rồi persist lại sort_order tuần tự (như page /card-ranks cũ) */
  const moveRankBy = async (row: CardRankRow, direction: -1 | 1) => {
    if (rankReordering || !canUpdateRank) return
    const reordered = [...ranks]
    const from = reordered.findIndex((rank) => rank.id === row.id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= reordered.length) return
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setRankReordering(true)
    try {
      await Promise.all(
        reordered.map((rank, index) => {
          const sort_order = index + 1
          if (rank.sort_order === sort_order) return Promise.resolve()
          return updateRankMutation.mutateAsync({ id: rank.id, data: { sort_order } as PutCardRanksIdAdminBody })
        }),
      )
      await invalidateRanks()
      message.success('Đã cập nhật thứ tự hạng thẻ')
    } catch (err) {
      message.error(errorMessage(err, 'Không cập nhật được thứ tự hạng thẻ'))
    } finally {
      setRankReordering(false)
    }
  }

  const applySearch = (nextKeyword: string) => {
    setSearchText(nextKeyword)
    setFilters((current) => ({ ...current, q: nextKeyword.trim() || undefined }))
    setPage(1)
  }

  // Lịch sử điểm: log toàn bộ biến động điểm của mọi khách (LY-03) — có thể lọc theo khách / nhận-trừ
  const [historyDirection, setHistoryDirection] = useState<'' | 'plus' | 'minus'>('')
  const profilesQuery = useGetCustomerProfilesAdmin({ page: 1, limit: 200 })
  const profilesData = (profilesQuery.data?.responseData ?? (profilesQuery.data as any)?.data ?? []) as ProfileLite[]
  const historyParams: Record<string, unknown> = { page: historyPage, limit: 10 }
  if (historyProfileId) historyParams.customer_profile_id = historyProfileId
  if (historyDirection) historyParams.direction = historyDirection
  const historyQuery = useQuery({
    queryKey: ['membership-transactions', historyParams],
    queryFn: () => getMembershipTransactionsAdmin(historyParams as never),
  })
  const historyData = (historyQuery.data?.responseData ?? (historyQuery.data as any)?.data ?? null) as { rows?: HistoryRow[]; count?: number } | null
  const historyRows = historyData?.rows ?? []
  const historyTotal = ((historyQuery.data as unknown as { meta?: { total?: number } } | null)?.meta?.total) ?? historyData?.count ?? historyRows.length

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
      await queryClient.invalidateQueries({ queryKey: ['membership-transactions'] })
      setAdjusting(null)
      form.resetFields()
      await memberProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể điều chỉnh điểm'))
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
      message.error(errorMessage(err, 'Không thể gán hạng'))
    }
  }

  const doRecalc = async (row: MemberRow) => {
    try {
      await recalcMutation.mutateAsync({ customerProfileId: row.id })
      message.success('Đã tính lại hạng')
      await memberProfilesQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err, 'Không thể tính lại hạng'))
    }
  }

  const memberRank = (row: MemberRow, fallback = '—') => {
    const label = row.membership?.card_rank?.name ?? rankName(row.membership?.card_rank_id)
    const rank = ranks.find((item) => item.id === row.membership?.card_rank_id)
      ?? ranks.find((item) => item.name === label)
    return <RankBadge rank={rank} label={label === '—' ? fallback : label} />
  }

  const memberActions = [
    ...(canAdjust ? [{ key: 'adjust', icon: <EditOutlined />, label: 'Điều chỉnh điểm' }] : []),
    ...(canOverride ? [{ key: 'override', icon: <CrownOutlined />, label: 'Gán hạng' }] : []),
    ...(canRecalc ? [{ key: 'recalc', icon: <SyncOutlined />, label: 'Tính lại hạng' }] : []),
  ]
  const mobileMemberActions = [
    ...(canViewHistory ? [{ value: 'view', label: 'Xem lịch sử' }] : []),
    ...memberActions.map(({ key, label }) => ({ value: key, label })),
  ]

  const runMemberAction = (row: MemberRow, key: string) => {
    if (key === 'view') {
      setHistoryTarget(row)
    } else if (key === 'adjust') {
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
    }
  }

  return (
    <>
      <PageTitle
        className="max-md:mb-3"
        subtitle="Tích điểm, xét hạng và điều chỉnh điểm cho hội viên"
      >
        Điểm & Hạng thành viên
      </PageTitle>

      <div className="rounded-xl p-3 md:rounded-[20px] md:px-6 md:pt-6 md:pb-7" style={{ background: 'var(--brand-bg-card, #FFFFFF)', border: '1px solid var(--brand-border-soft, #ECEFEA)', marginTop: 8 }}>
        <button
          type="button"
          aria-expanded={ranksExpanded}
          aria-controls="points-rank-settings"
          className="flex w-full items-center justify-between gap-3 rounded-lg border-0 bg-transparent p-1 text-left text-sm font-semibold text-(--brand-primary) md:hidden"
          onClick={() => setRanksExpanded((expanded) => !expanded)}
        >
          <span className="inline-flex items-center gap-2"><CrownOutlined /> Hạng thành viên</span>
          <DownOutlined aria-hidden rotate={ranksExpanded ? 180 : 0} />
        </button>
        <div id="points-rank-settings" className={ranksExpanded ? 'max-md:mt-3' : 'max-md:hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3 md:items-start">
          <div style={{ minWidth: 0 }}>
            <span style={{ display: 'inline-block', background: 'var(--brand-tertiary-tint)', color: 'var(--brand-tertiary-ink)', border: '1px solid var(--brand-tertiary-border)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999 }}>
              New Sky Vista Club
            </span>
            <Typography.Text type="secondary" className="max-md:hidden!" style={{ display: 'block', marginTop: 10 }}>
              Cấu hình tiêu chí nâng hạng và chính sách đặc quyền thưởng lưu danh cho hội viên
            </Typography.Text>
          </div>
          <Can I="CREATE" a="CARD_RANK">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openRankEditor()} style={{ flexShrink: 0 }}>
              Thêm hạng
            </Button>
          </Can>
        </div>

        <Row gutter={[16, 16]} className="mt-3 md:mt-5">
          {ranksQuery.isLoading && [0, 1, 2].map((index) => (
            <Col xs={24} md={12} xl={8} key={index}>
              <div className="mobile-card"><Skeleton active paragraph={{ rows: 2 }} /></div>
            </Col>
          ))}
          {ranks.map((r, index) => {
            const fallback = RANK_THEMES[index % RANK_THEMES.length]
            const theme = r.color ? rankThemeFromColor(r.color, fallback) : fallback
            const RankIcon = theme.icon
            const permanent = r.validity === 'PERMANENT'
            const rankActions = [
              ...(canUpdateRank ? [
                { value: 'edit', label: 'Sửa hạng' },
                { value: 'up', label: 'Đưa lên', disabled: rankReordering || index === 0 },
                { value: 'down', label: 'Đưa xuống', disabled: rankReordering || index === ranks.length - 1 },
              ] : []),
              ...(canDeleteRank ? [{ value: 'delete', label: 'Xóa hạng' }] : []),
            ]
            return (
              <Col xs={24} md={12} xl={8} key={r.id} className="flex min-w-0">
                <article className="mobile-card min-w-0 flex-1">
                  <div className="mobile-card-head flex-wrap">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="hidden size-7 shrink-0 items-center justify-center rounded-lg md:inline-flex"
                        style={{ background: theme.pillBg, color: theme.pillColor }}
                        aria-hidden
                      >
                        <RankIcon />
                      </span>
                      <span className="mobile-card-title min-w-0">{r.name}</span>
                    </div>
                    <Tag className="me-0! md:hidden!" color={permanent ? 'green' : 'default'}>
                      {permanent ? 'Vĩnh viễn' : '1 năm'}
                    </Tag>
                    {(canUpdateRank || canDeleteRank) && (
                      <Space size={0} className="max-md:hidden!">
                        {canUpdateRank && (
                          <>
                            <Button type="text" size="small" aria-label="Đưa lên" title="Đưa lên"
                              disabled={rankReordering || index === 0} icon={<ArrowUpOutlined />}
                              onClick={() => void moveRankBy(r, -1)} />
                            <Button type="text" size="small" aria-label="Đưa xuống" title="Đưa xuống"
                              disabled={rankReordering || index === ranks.length - 1} icon={<ArrowDownOutlined />}
                              onClick={() => void moveRankBy(r, 1)} />
                            <Button type="text" size="small" aria-label="Sửa hạng" title="Sửa hạng"
                              icon={<EditOutlined />} onClick={() => openRankEditor(r)} />
                          </>
                        )}
                        {canDeleteRank && (
                          <Button type="text" size="small" aria-label="Xóa hạng" title="Xóa hạng" danger
                            icon={<DeleteOutlined />} onClick={() => removeRank(r)} />
                        )}
                      </Space>
                    )}
                  </div>
                  {r.benefits && <p className="mobile-card-sub mt-0 mb-2 md:hidden">{r.benefits}</p>}
                  <div className="mobile-card-rows">
                    <div className="md:hidden"><MobileCardRow label="Mã hạng" value={r.code || '—'} /></div>
                    <MobileCardRow label="Chi tiêu tối thiểu" value={r.min_spent ? formatMoney(r.min_spent) : 'Không ngưỡng'} />
                    {r.discount_percent != null && <div className="md:hidden"><MobileCardRow label="Mức giảm" value={`${r.discount_percent}%`} /></div>}
                    <div className="hidden md:contents">
                      <MobileCardRow label="Hiệu lực" value={permanent ? <Tag color="green">Vĩnh viễn</Tag> : '1 năm'} />
                      <MobileCardRow label="Quyền lợi" value={r.benefits || 'Chưa mô tả quyền lợi'} />
                    </div>
                  </div>
                  {rankActions.length > 0 && (
                    <div className="mobile-card-actions md:hidden!">
                      <Select<string | null>
                        aria-label={`Thao tác cho hạng ${r.name}`}
                        placeholder="Thao tác"
                        className="w-32"
                        value={null}
                        popupMatchSelectWidth={false}
                        options={rankActions}
                        onSelect={(key) => {
                          if (key === 'edit') openRankEditor(r)
                          if (key === 'up') void moveRankBy(r, -1)
                          if (key === 'down') void moveRankBy(r, 1)
                          if (key === 'delete') removeRank(r)
                        }}
                      />
                    </div>
                  )}
                </article>
              </Col>
            )
          })}
        </Row>
        {ranksQuery.isError && ranks.length === 0 && <Alert type="error" showIcon title="Không tải được hạng thẻ" />}
        {!ranksQuery.isLoading && !ranksQuery.isError && ranks.length === 0 && (
          <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '16px 0 0' }}>
            Chưa có hạng thẻ nào
          </Typography.Text>
        )}
        </div>
      </div>

      <Tabs
        className="max-md:[&_.ant-tabs-nav-list]:w-full max-md:[&_.ant-tabs-tab]:flex-1 max-md:[&_.ant-tabs-tab]:justify-center max-md:[&_.ant-tabs-tab]:px-1 max-md:[&_.ant-tabs-tab]:text-xs max-md:[&_.ant-tabs-tab+.ant-tabs-tab]:ms-0!"
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarGutter={12}
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'members',
            label: <><span className="md:hidden">Thành viên</span><span className="max-md:hidden">Thành viên &amp; điểm hiện có</span></>,
            children: (
              <>
                {/* Tìm kiếm + bộ lọc chỉ áp dụng cho bảng thành viên — đặt trong tab, không để trên card hạng */}
                <div className="mb-3 grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-2 md:flex md:flex-wrap md:justify-end">
                    <Input.Search
                      allowClear
                      placeholder="Tìm tên, SĐT, mã khách..."
                      aria-label="Tìm thành viên"
                      className="w-full! min-w-0 md:w-[260px]!"
                      value={searchText}
                      onChange={(e) => { setSearchText(e.target.value); if (!e.target.value) applySearch('') }}
                      onSearch={(v) => applySearch(v)}
                    />
                    <Select
                      allowClear
                      placeholder="Tất cả hạng"
                      aria-label="Lọc theo hạng"
                      className="w-full min-w-0 md:w-[170px]"
                      value={filters.rank_id}
                      onChange={(value) => { setFilters((current) => ({ ...current, rank_id: value ?? undefined })); setPage(1) }}
                      options={ranks.map((rank) => ({ value: rank.id, label: rank.name }))}
                    />
                </div>
                <Table
                  className="desktop-only"
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
            width: 200,
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
            render: (_value: unknown, row: MemberRow) => memberRank(row),
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
            title: 'Thao tác', align: 'center' as const,
            width: 90,
            fixed: 'right' as const,
            render: (_value: unknown, row: MemberRow) => (
              <RowActionsMenu items={memberActions} onSelect={(key) => runMemberAction(row, key)} />
            ),
          },
        ].filter((column) =>
          (column.key !== 'actions' || canAdjust || canOverride || canRecalc || canViewHistory),
        )}
      />
      {memberProfilesQuery.isError && !rows.length ? (
        <Alert type="error" title="Không tải được danh sách thành viên" action={<Button size="small" onClick={() => void memberProfilesQuery.refetch()}>Thử lại</Button>} />
      ) : (
        <MobileCards
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText={filters.q || filters.rank_id ? 'Không có kết quả' : 'Chưa có thành viên'}
          renderCard={(row) => (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="mobile-card-title">{row.full_name || row.user?.zalo_name || '—'}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {(row.phone || row.user?.phone_number) && <div className="mobile-card-sub">{row.phone || row.user?.phone_number}</div>}
                    {memberRank(row, 'Chưa xếp hạng')}
                  </div>
                </div>
                {mobileMemberActions.length > 0 && (
                  <Select<string | null>
                    aria-label={`Thao tác cho ${row.full_name || row.user?.zalo_name || 'thành viên'}`}
                    placeholder="Thao tác"
                    size="middle"
                    className="w-32 shrink-0"
                    styles={{ placeholder: { color: 'var(--brand-primary)' } }}
                    popupMatchSelectWidth={false}
                    showSearch={false}
                    value={null}
                    options={mobileMemberActions}
                    onSelect={(key) => { if (key) runMemberAction(row, key) }}
                  />
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 rounded-lg bg-(--brand-bg) py-2.5">
                <div className="min-w-0 px-3">
                  <Typography.Text type="secondary" className="block text-xs!">Điểm hiện có</Typography.Text>
                  <div className="mt-1 wrap-anywhere text-lg leading-tight font-semibold text-(--brand-primary) tabular-nums">
                    {Number(row.membership?.lifetime_points ?? 0).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="min-w-0 border-0 border-s border-solid border-(--brand-border-soft) px-3">
                  <Typography.Text type="secondary" className="block text-xs!">Chi tiêu năm</Typography.Text>
                  <div className="mt-1 wrap-anywhere text-lg leading-tight font-semibold tabular-nums">
                    {formatMoney(row.membership?.year_spent)}
                  </div>
                </div>
              </div>
            </>
          )}
        />
      )}
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="thành viên" />
              </>
            ),
          },
          {
            key: 'history',
            label: 'Lịch sử điểm',
            children: (
              <>
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-end">
          <Select
            placeholder="Tất cả biến động"
            aria-label="Lọc theo loại biến động"
            className="w-full md:w-[170px]"
            allowClear
            value={historyDirection || undefined}
            onChange={(v) => { setHistoryDirection((v as 'plus' | 'minus' | undefined) ?? ''); setHistoryPage(1) }}
            options={[
              { value: 'plus', label: 'Nhận điểm' },
              { value: 'minus', label: 'Bị trừ điểm' },
            ]}
          />
          <Select
            placeholder="Tất cả khách hàng"
            aria-label="Lọc theo khách hàng"
            className="w-full md:w-[260px]"
            allowClear
            showSearch
            optionFilterProp="label"
            value={historyProfileId ?? undefined}
            onChange={(v) => { setHistoryProfileId(v ?? null); setHistoryPage(1) }}
            options={profilesData.map((profile) => ({ value: profile.id, label: profile.full_name || profile.phone || profile.id }))}
          />
      </div>
      <Table<HistoryRow>
        className="desktop-only"
        rowKey="id"
        loading={historyQuery.isLoading}
        dataSource={historyRows}
        pagination={false}
        locale={{ emptyText: <TableEmpty description="Chưa có giao dịch điểm nào" /> }}
        columns={[
          {
            title: 'Khách hàng',
            key: 'customer',
            render: (_, row: HistoryRow) => {
              const customer = row.membership?.customer_profile
              if (!customer) return '—'
              return (
                <div>
                  <div style={{ fontWeight: 500 }}>{customer.full_name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6F7071' }}>{customer.customer_code || customer.phone || ''}</div>
                </div>
              )
            },
          },
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
      {historyQuery.isError && !historyRows.length ? (
        <Alert type="error" title="Không tải được lịch sử điểm" action={<Button size="small" onClick={() => void historyQuery.refetch()}>Thử lại</Button>} />
      ) : (
        <MobileCards
          rows={historyRows}
          rowKey={(row) => row.id}
          loading={historyQuery.isLoading}
          emptyText={historyProfileId || historyDirection ? 'Không có kết quả' : 'Chưa có giao dịch điểm nào'}
          renderCard={(row) => {
            const customer = row.membership?.customer_profile
            const delta = Number(row.points_earned ?? 0)
            return (
              <>
                <div className="mobile-card-head flex-wrap">
                  <div className="min-w-0">
                    <div className="mobile-card-title">{customer?.full_name || '—'}</div>
                    <div className="mobile-card-sub">{customer?.customer_code || customer?.phone}</div>
                  </div>
                  <Tag className="me-0! max-w-full whitespace-normal! wrap-anywhere" color={delta >= 0 ? 'green' : 'red'}>
                    {REF_TYPE_LABELS[row.ref_type ?? ''] ?? row.ref_type ?? '—'}
                  </Tag>
                </div>
                <div className="mobile-card-rows">
                  <MobileCardRow label="Điểm" value={<strong style={{ color: delta >= 0 ? '#389e0d' : '#cf1322' }}>{delta >= 0 ? '+' : ''}{delta}</strong>} />
                  <MobileCardRow label="Thời gian" value={row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : '—'} />
                  <MobileCardRow label="Số tiền" value={row.amount ? formatMoney(row.amount) : '—'} />
                  <MobileCardRow label="Mã giao dịch" value={row.trans_code || '—'} />
                  <MobileCardRow label="Lý do" value={row.reason || '—'} />
                </div>
              </>
            )
          }}
        />
      )}
      <ListPagination page={historyPage} limit={10} total={historyTotal} onChange={setHistoryPage} noun="giao dịch điểm" />
              </>
            ),
          },
        ]}
      />

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

      <CardRankModal
        open={rankModalOpen}
        editing={editingRank}
        form={rankForm}
        saving={createRankMutation.isPending || updateRankMutation.isPending}
        onCancel={() => setRankModalOpen(false)}
        onSubmit={() => void submitRank()}
      />
    </>
  )
}
