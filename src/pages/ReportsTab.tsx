import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Popover,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Tooltip as AntTooltip,
  Typography,
} from 'antd'
import {
  CheckCircleOutlined,
  DollarOutlined,
  DownloadOutlined,
  FilterOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import dayjs, { Dayjs } from 'dayjs'
import { pickData } from '@/api/helpers'
import { usePermissions } from '@/utils/permissions'
import { useBrandColors } from '@/themeRuntime'
import { toCsv, downloadCsv, type CsvColumn } from '@/utils/csv'
import {
  getBranches,
} from '@/api/endpoints/branches'
import { getCustomerProfiles } from '@/api/endpoints/customer-profiles'
import { getUsers } from '@/api/endpoints/users'
import {
  getReportsAppointments,
  getReportsCommissions,
  getReportsDebts,
  getReportsNewCustomers,
  getReportsRanks,
  getReportsRevenue,
  getReportsSessionsUsed,
} from '@/api/endpoints/reports'
import type { GetReportsAppointmentsParams } from '@/api/models/getReportsAppointmentsParams'
import type { GetReportsCommissionsParams } from '@/api/models/getReportsCommissionsParams'
import type { GetReportsDebtsParams } from '@/api/models/getReportsDebtsParams'
import type { GetReportsNewCustomersParams } from '@/api/models/getReportsNewCustomersParams'
import type { GetReportsRanksParams } from '@/api/models/getReportsRanksParams'
import type { GetReportsRevenueParams } from '@/api/models/getReportsRevenueParams'
import type { GetReportsSessionsUsedParams } from '@/api/models/getReportsSessionsUsedParams'

const { RangePicker } = DatePicker

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--brand-border)',
  fontSize: 13,
}

const GROUP_OPTIONS = [
  { value: 'day', label: 'Theo ngày' },
  { value: 'week', label: 'Theo tuần' },
  { value: 'month', label: 'Theo tháng' },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  in_progress: 'Đang làm',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  rejected: 'Từ chối',
  no_show: 'Không đến',
}

const ACTOR_LABEL: Record<string, string> = {
  STAFF: 'KTV / Nhân viên',
  COLLABORATOR: 'Cộng tác viên',
  REFERRER_CUSTOMER: 'Khách giới thiệu',
}

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
}

const SOURCE_LABEL: Record<string, string> = {
  organic: 'Khách tự đến',
  collaborator: 'Giới thiệu bởi CTV',
  referral_customer: 'Giới thiệu bởi khách cũ',
}

const fmtMoney = (v: unknown) => Number(v ?? 0).toLocaleString('vi-VN') + ' ₫'
const fmtMillion = (v: number) => (v / 1_000_000).toFixed(1) + ' tr'

const KPI_ICON = (bg: string, color: string): CSSProperties => ({
  width: 40, height: 40, borderRadius: 12, background: bg, color,
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
})

function CsvButton<T>({ filename, columns, rows }: { filename: string; columns: CsvColumn<T>[]; rows: T[] }) {
  return (
    <Button
      size="small"
      icon={<DownloadOutlined />}
      disabled={rows.length === 0}
      onClick={() => downloadCsv(`${filename}-${dayjs().format('YYYYMMDD-HHmm')}.csv`, toCsv(columns, rows))}
    >
      CSV
    </Button>
  )
}

interface Option { value: string; label: string }

export type ReportSection = 'money' | 'customers' | 'ops'

export default function ReportsTab({ section }: { section: ReportSection }) {
  const brand = useBrandColors()
  const rankColors = [brand.primary, '#D9A441', '#3B5BDB', '#16A34A', '#E06666']
  const { can } = usePermissions()
  /** report.read là key tổng; các key mịn report.<loại>.read cho role REC. */
  const canReport = useCallback((key: string) => can('report.read') || can(key), [can])
  const canSeeCommission = canReport('report.commission.read')

  // Filters (applied)
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(29, 'day'), dayjs()])
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [branchId, setBranchId] = useState<string | undefined>()
  const [customerProfileId, setCustomerProfileId] = useState<string | undefined>()
  const [staffId, setStaffId] = useState<string | undefined>()
  // Draft filter values (committed by "Áp dụng")
  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [draftGroupBy, setDraftGroupBy] = useState<'day' | 'week' | 'month' | null>(null)
  const [draftBranchId, setDraftBranchId] = useState<string | null>(null)
  const [draftCustomerId, setDraftCustomerId] = useState<string | null>(null)
  const [draftStaffId, setDraftStaffId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const [loading, setLoading] = useState(false)

  const [branchOptions, setBranchOptions] = useState<Option[]>([])
  const [customerOptions, setCustomerOptions] = useState<Option[]>([])
  const [staffOptions, setStaffOptions] = useState<Option[]>([])

  const [revenue, setRevenue] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [ranks, setRanks] = useState<{ ranks?: any[]; upgrades?: any[] }>({})
  const [appointments, setAppointments] = useState<{ by_status?: any[]; by_staff?: any[] }>({})
  const [newCustomers, setNewCustomers] = useState<{ by_period?: any[]; by_source?: any[] }>({})
  const [sessions, setSessions] = useState<{ by_period?: any[]; remaining?: any[] }>({})
  const [commissions, setCommissions] = useState<{ by_period?: any[]; by_actor?: any[] }>({})

  const params = useMemo(
    () => ({
      from_date: range[0].format('YYYY-MM-DD'),
      to_date: range[1].format('YYYY-MM-DD'),
      group_by: groupBy,
      branch_id: branchId,
      customer_profile_id: customerProfileId,
      staff_id: staffId,
    }),
    [range, groupBy, branchId, customerProfileId, staffId],
  )

  useEffect(() => {
    void getBranches()
      .then((body) => setBranchOptions(((pickData<any[]>(body) ?? []) as any[]).map((b) => ({ value: b.id, label: b.name }))))
      .catch(() => undefined)
    void getCustomerProfiles({ page: 1, limit: 200 })
      .then((body) =>
        setCustomerOptions(
          ((pickData<any[]>(body) ?? []) as any[]).map((c) => ({ value: c.id, label: `${c.full_name}${c.phone ? ' — ' + c.phone : ''}` })),
        ),
      )
      .catch(() => undefined)
    void getUsers({ currentPage: 1, pageSize: 200, has_role: true })
      .then((body) =>
        setStaffOptions(((((pickData<any>(body) ?? {}) as any)?.rows ?? []) as any[]).map((u) => ({ value: u.id, label: u.zalo_name || u.email }))),
      )
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const settled = (p: Promise<unknown>) => p.catch(() => undefined)
    await Promise.all([
      canReport('report.revenue.read') ? settled(getReportsRevenue(params as GetReportsRevenueParams).then((body) => setRevenue((pickData<any[]>(body) ?? []) as any[]))) : Promise.resolve(),
      canReport('report.debt.read') ? settled(getReportsDebts({ branch_id: branchId, customer_profile_id: customerProfileId } as GetReportsDebtsParams).then((body) => setDebts((pickData<any[]>(body) ?? []) as any[]))) : Promise.resolve(),
      canReport('report.rank.read') ? settled(getReportsRanks(params as GetReportsRanksParams).then((body) => setRanks((pickData<any>(body) ?? {}) as { ranks?: any[]; upgrades?: any[] }))) : Promise.resolve(),
      canReport('report.appointment.read') ? settled(getReportsAppointments(params as GetReportsAppointmentsParams).then((body) => setAppointments((pickData<any>(body) ?? {}) as { by_status?: any[]; by_staff?: any[] }))) : Promise.resolve(),
      canReport('report.customer.read') ? settled(getReportsNewCustomers(params as GetReportsNewCustomersParams).then((body) => setNewCustomers((pickData<any>(body) ?? {}) as { by_period?: any[]; by_source?: any[] }))) : Promise.resolve(),
      canReport('report.session.read') ? settled(getReportsSessionsUsed(params as GetReportsSessionsUsedParams).then((body) => setSessions((pickData<any>(body) ?? {}) as { by_period?: any[]; remaining?: any[] }))) : Promise.resolve(),
      canSeeCommission ? settled(getReportsCommissions(params as GetReportsCommissionsParams).then((body) => setCommissions((pickData<any>(body) ?? {}) as { by_period?: any[]; by_actor?: any[] }))) : Promise.resolve(),
    ])
    setLoading(false)
  }, [params, branchId, customerProfileId, canReport, canSeeCommission])

  useEffect(() => {
    void load()
  }, [load])

  const applyFilters = () => {
    setRange(draftRange ?? range)
    setGroupBy(draftGroupBy ?? groupBy)
    setBranchId(draftBranchId ?? undefined)
    setCustomerProfileId(draftCustomerId ?? undefined)
    setStaffId(draftStaffId ?? undefined)
  }
  const resetFilters = () => {
    setRange([dayjs().subtract(29, 'day'), dayjs()])
    setGroupBy('day')
    setBranchId(undefined)
    setCustomerProfileId(undefined)
    setStaffId(undefined)
    setDraftRange(null); setDraftGroupBy(null); setDraftBranchId(null); setDraftCustomerId(null); setDraftStaffId(null)
  }

  // ----- Derived chart data -----
  const revenueMerged = useMemo(() => {
    const merged = new Map<string, number>()
    for (const r of revenue) merged.set(r.period, (merged.get(r.period) ?? 0) + Number(r.revenue))
    return [...merged.entries()].map(([period, v]) => ({ period, revenue: v / 1_000_000 }))
  }, [revenue])
  const revenueTotal = revenueMerged.reduce((s, r) => s + r.revenue, 0)
  const debtsTotal = debts.reduce((s, d) => s + Number(d.debt_amount ?? 0), 0)
  const rankData = (ranks.ranks ?? []).filter((r) => Number(r.member_count) > 0).map((r) => ({ name: r.rank_name, value: Number(r.member_count) }))
  const newCustPeriod = (newCustomers.by_period ?? []).map((r) => ({
    period: r.period,
    new_count: Number(r.new_count),
    referred: Number(r.referred_count),
  }))
  const newCustTotal = newCustPeriod.reduce((s, r) => s + r.new_count, 0)
  const sessionsPeriod = (sessions.by_period ?? []).map((r) => ({ period: r.period, sessions_used: Number(r.sessions_used) }))
  const commissionPeriod = (commissions.by_period ?? []).map((r) => ({ period: r.period, total: Number(r.total_amount) / 1_000_000 }))
  const commissionTotal = commissionPeriod.reduce((s, r) => s + r.total, 0)

  const kpis: Array<{ title: string; value: string; icon: ReactElement; bg: string; color: string; perm: string }> = [
    { title: 'Doanh thu đã thu', value: fmtMillion(revenueTotal * 1_000_000), icon: <DollarOutlined />, bg: '#E4F5EC', color: '#16A34A', perm: 'report.revenue.read' },
    { title: 'Công nợ còn lại', value: fmtMillion(debtsTotal), icon: <WalletOutlined />, bg: '#FDECEC', color: '#E06666', perm: 'report.debt.read' },
    { title: 'Khách mới', value: String(newCustTotal), icon: <UserAddOutlined />, bg: brand.tint, color: brand.primary, perm: 'report.customer.read' },
    { title: 'Buổi hoàn tất', value: String(sessionsPeriod.reduce((s, r) => s + r.sessions_used, 0)), icon: <CheckCircleOutlined />, bg: '#E8EDFB', color: '#3B5BDB', perm: 'report.session.read' },
    { title: 'Hoa hồng', value: fmtMillion(commissionTotal * 1_000_000), icon: <TeamOutlined />, bg: '#FBF3DF', color: '#D9A441', perm: 'report.commission.read' },
  ].filter((k) => canReport(k.perm))

  const activeFilterCount =
    (branchId ? 1 : 0) + (customerProfileId ? 1 : 0) + (staffId ? 1 : 0)

  const chips: Array<{ key: string; label: string; onClose?: () => void }> = [
    {
      key: 'period',
      label: `${range[0].format('DD/MM/YYYY')} → ${range[1].format('DD/MM/YYYY')} · ${groupBy === 'day' ? 'ngày' : groupBy === 'week' ? 'tuần' : 'tháng'}`,
    },
    ...(branchId
      ? [{ key: 'branch', label: branchOptions.find((o) => o.value === branchId)?.label ?? 'Cơ sở', onClose: () => setBranchId(undefined) }]
      : []),
    ...(customerProfileId
      ? [{ key: 'customer', label: customerOptions.find((o) => o.value === customerProfileId)?.label ?? 'Khách', onClose: () => setCustomerProfileId(undefined) }]
      : []),
    ...(staffId
      ? [{ key: 'staff', label: staffOptions.find((o) => o.value === staffId)?.label ?? 'KTV/CTV', onClose: () => setStaffId(undefined) }]
      : []),
  ]

  const filterForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 300 }}>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Kỳ</Typography.Text>
        <RangePicker
          style={{ width: '100%' }}
          value={draftRange ?? range}
          onChange={(v) => setDraftRange(v as [Dayjs, Dayjs] | null)}
          allowClear={false}
        />
      </div>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nhóm theo</Typography.Text>
        <Select
          style={{ width: '100%' }}
          options={GROUP_OPTIONS}
          value={draftGroupBy ?? groupBy}
          onChange={(v) => setDraftGroupBy(v)}
        />
      </div>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Cơ sở</Typography.Text>
        <Select
          style={{ width: '100%' }}
          placeholder="Tất cả cơ sở"
          allowClear
          showSearch
          optionFilterProp="label"
          options={branchOptions}
          value={draftBranchId ?? branchId ?? null}
          onChange={(v) => setDraftBranchId(v ?? null)}
        />
      </div>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Khách hàng</Typography.Text>
        <Select
          style={{ width: '100%' }}
          placeholder="Tất cả khách hàng"
          allowClear
          showSearch
          optionFilterProp="label"
          options={customerOptions}
          value={draftCustomerId ?? customerProfileId ?? null}
          onChange={(v) => setDraftCustomerId(v ?? null)}
        />
      </div>
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>KTV / CTV</Typography.Text>
        <Select
          style={{ width: '100%' }}
          placeholder="Tất cả KTV / CTV"
          allowClear
          showSearch
          optionFilterProp="label"
          options={staffOptions}
          value={draftStaffId ?? staffId ?? null}
          onChange={(v) => setDraftStaffId(v ?? null)}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <Button size="small" onClick={resetFilters}>Đặt lại</Button>
        <Button
          size="small"
          type="primary"
          icon={<FilterOutlined />}
          loading={loading}
          onClick={() => {
            applyFilters()
            setFilterOpen(false)
          }}
        >
          Áp dụng
        </Button>
      </div>
    </div>
  )

  const filterBar = (
    <Card size="small" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Popover open={filterOpen} onOpenChange={setFilterOpen} trigger="click" placement="bottomLeft" content={filterForm}>
          <Button icon={<FilterOutlined />}>
            Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        </Popover>
        {chips.map((c) => (
          <Tag
            key={c.key}
            closable={!!c.onClose}
            onClose={c.onClose}
            style={{ marginInlineEnd: 0, fontSize: 13, padding: '2px 8px' }}
          >
            {c.label}
          </Tag>
        ))}
        <AntTooltip title="Tải lại dữ liệu" placement="left">
          <Button style={{ marginLeft: 'auto' }} icon={<ReloadOutlined />} onClick={() => void load()} />
        </AntTooltip>
      </div>
    </Card>
  )

  const kpiRow = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
      {kpis.map((k) => (
        <div key={k.title} style={{ flex: `1 1 ${canSeeCommission ? 200 : 240}px`, minWidth: 180, display: 'flex' }}>
          <Card style={{ flex: 1, width: '100%' }} styles={{ body: { padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Statistic title={k.title} value={k.value} />
              <div style={KPI_ICON(k.bg, k.color)}>{k.icon}</div>
            </div>
          </Card>
        </div>
      ))}
    </div>
  )

  const moneySection = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {canReport('report.revenue.read') && (
          <Col xs={24} lg={14}>
            <Card
              title="Doanh thu đã thu"
              size="small"
              extra={<CsvButton filename="bao-cao-doanh-thu" rows={revenue} columns={[
                { header: 'Kỳ', value: (r: any) => r.period },
                { header: 'Cơ sở', value: (r: any) => r.branch_name },
                { header: 'Doanh thu', value: (r: any) => r.revenue },
                { header: 'Số lần thanh toán', value: (r: any) => r.payment_count },
              ]} />}
            >
              {revenueMerged.length < 2 ? (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa đủ dữ liệu doanh thu trong kỳ" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={revenueMerged} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rptRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={brand.primary} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={brand.primary} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toFixed(1)} tr`} />
                    <Area type="monotone" dataKey="revenue" name="Doanh thu (tr)" stroke={brand.primary} strokeWidth={2.5} fill="url(#rptRevGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        )}
        {canReport('report.debt.read') && (
          <Col xs={24} lg={10}>
            <Card
              title={`Công nợ — tổng ${fmtMoney(debtsTotal)}`}
              size="small"
              extra={<CsvButton filename="bao-cao-cong-no" rows={debts} columns={[
                { header: 'Khách hàng', value: (r: any) => r.full_name },
                { header: 'Mã khách', value: (r: any) => r.customer_code },
                { header: 'Cơ sở', value: (r: any) => r.branch_name },
                { header: 'Gói', value: (r: any) => r.package_name },
                { header: 'Tổng tiền', value: (r: any) => r.total_amount },
                { header: 'Đã trả', value: (r: any) => r.paid_amount },
                { header: 'Còn nợ', value: (r: any) => r.debt_amount },
                { header: 'Trạng thái', value: (r: any) => PAYMENT_STATUS_LABEL[r.payment_status] ?? r.payment_status },
              ]} />}
            >
              <Table
                rowKey={(r: any) => r.customer_treatment_id}
                dataSource={debts}
                size="small"
                pagination={{ pageSize: 5, showSizeChanger: false }}
                columns={[
                  { title: 'Khách hàng', dataIndex: 'full_name', ellipsis: true },
                  { title: 'Còn nợ', dataIndex: 'debt_amount', width: 110, align: 'right', render: (v: any) => fmtMoney(v) },
                  { title: 'Trạng thái', dataIndex: 'payment_status', width: 140, render: (v: string) => PAYMENT_STATUS_LABEL[v] ?? v },
                ]}
              />
            </Card>
          </Col>
        )}
      </Row>
    </>
  )

  const customerSection = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {canReport('report.customer.read') && (
          <Col xs={24} lg={14}>
            <Card
              title="Khách mới theo kỳ"
              size="small"
              extra={<CsvButton filename="bao-cao-khach-moi" rows={newCustPeriod} columns={[
                { header: 'Kỳ', value: (r: any) => r.period },
                { header: 'Khách mới', value: (r: any) => r.new_count },
                { header: 'Trong đó được giới thiệu', value: (r: any) => r.referred },
              ]} />}
            >
              {newCustPeriod.length === 0 ? (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có khách mới trong kỳ" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={newCustPeriod}>
                    <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="new_count" name="Khách mới" fill={brand.primary} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="referred" name="Được giới thiệu" fill="#D9A441" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <Table
                style={{ marginTop: 12 }}
                rowKey={(r: any) => r.source}
                dataSource={newCustomers.by_source ?? []}
                size="small"
                pagination={false}
                columns={[
                  { title: 'Nguồn', dataIndex: 'source', render: (v: string) => SOURCE_LABEL[v] ?? v },
                  { title: 'Số khách', dataIndex: 'count', width: 100, align: 'right' },
                ]}
              />
            </Card>
          </Col>
        )}
        {canReport('report.rank.read') && (
          <Col xs={24} lg={10}>
            <Card
              title="Phân bố hạng thẻ"
              size="small"
              extra={<CsvButton filename="bao-cao-hang-the" rows={ranks.ranks ?? []} columns={[
                { header: 'Hạng', value: (r: any) => r.rank_name },
                { header: 'Số thành viên', value: (r: any) => r.member_count },
              ]} />}
            >
              {rankData.length === 0 ? (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thành viên xếp hạng" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={rankData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={88} paddingAngle={3} strokeWidth={0}>
                      {rankData.map((entry, i) => (
                        <Cell key={entry.name} fill={rankColors[i % rankColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              <Table
                style={{ marginTop: 8 }}
                rowKey={(_, i) => String(i)}
                dataSource={ranks.upgrades ?? []}
                size="small"
                pagination={false}
                columns={[
                  { title: 'Kỳ', dataIndex: 'period' },
                  { title: 'Hạng đạt', dataIndex: 'rank_name' },
                  { title: 'Số khách nâng hạng', dataIndex: 'upgraded_count', width: 140, align: 'right' },
                ]}
              />
            </Card>
          </Col>
        )}
      </Row>
    </>
  )

  const opsSection = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {canReport('report.appointment.read') && (
          <Col xs={24} lg={10}>
            <Card title="Lịch hẹn theo trạng thái" size="small">
              {(appointments.by_status ?? []).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có lịch hẹn trong kỳ" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={(appointments.by_status ?? []).map((s: any) => ({ status: STATUS_LABEL[s.status] ?? s.status, count: Number(s.count) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                    <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Số lịch" fill={brand.primary} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        )}
        {canReport('report.appointment.read') && (
          <Col xs={24} lg={14}>
            <Card
              title="Hiệu suất KTV"
              size="small"
              extra={<CsvButton filename="bao-cao-hieu-suat-ktv" rows={appointments.by_staff ?? []} columns={[
                { header: 'KTV', value: (r: any) => r.staff_name },
                { header: 'Tổng lịch', value: (r: any) => r.total },
                { header: 'Hoàn tất', value: (r: any) => r.completed },
                { header: 'Đã hủy', value: (r: any) => r.cancelled },
                { header: 'Không đến', value: (r: any) => r.no_show },
              ]} />}
            >
              <Table
                rowKey={(r: any) => r.staff_id ?? 'none'}
                dataSource={appointments.by_staff ?? []}
                size="small"
                pagination={false}
                columns={[
                  { title: 'KTV', dataIndex: 'staff_name', render: (v: any) => v || '(không tên)' },
                  { title: 'Tổng lịch', dataIndex: 'total', width: 90, align: 'right' },
                  { title: 'Hoàn tất', dataIndex: 'completed', width: 90, align: 'right' },
                  { title: 'Đã hủy', dataIndex: 'cancelled', width: 90, align: 'right' },
                  { title: 'Không đến', dataIndex: 'no_show', width: 100, align: 'right' },
                ]}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* RP-06 Buổi đã dùng / còn lại */}
      {canReport('report.session.read') && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={10}>
            <Card title="Buổi đã dùng theo kỳ" size="small">
              {sessionsPeriod.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có buổi hoàn tất trong kỳ" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sessionsPeriod}>
                    <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="sessions_used" name="Buổi hoàn tất" fill="#16A34A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card
              title="Buổi còn lại theo khách"
              size="small"
              extra={<CsvButton filename="bao-cao-buoi-con-lai" rows={sessions.remaining ?? []} columns={[
                { header: 'Khách hàng', value: (r: any) => r.full_name },
                { header: 'Mã khách', value: (r: any) => r.customer_code },
                { header: 'Cơ sở', value: (r: any) => r.branch_name },
                { header: 'Gói', value: (r: any) => r.package_name },
                { header: 'Tổng buổi', value: (r: any) => r.sessions_total },
                { header: 'Đã dùng', value: (r: any) => r.sessions_used },
                { header: 'Còn lại', value: (r: any) => r.sessions_remaining },
              ]} />}
            >
              <Table
                rowKey={(_, i) => String(i)}
                dataSource={sessions.remaining ?? []}
                size="small"
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: 'Khách hàng', dataIndex: 'full_name' },
                  { title: 'Gói', dataIndex: 'package_name' },
                  { title: 'Còn lại', dataIndex: 'sessions_remaining', width: 90, align: 'right' },
                ]}
              />
            </Card>
          </Col>
        </Row>
      )}
    </>
  )

  const commissionSection = canSeeCommission && (
    <Card
      style={{ marginTop: 16 }}
      title={`Hoa hồng — tổng ${commissionTotal.toFixed(1)} tr`}
      extra={<CsvButton filename="bao-cao-hoa-hong" rows={commissions.by_actor ?? []} columns={[
        { header: 'Đối tượng', value: (r: any) => ACTOR_LABEL[r.actor_type] ?? r.actor_type },
        { header: 'Tên', value: (r: any) => r.actor_name },
        { header: 'Tổng hoa hồng', value: (r: any) => r.total_amount },
        { header: 'Số bút toán', value: (r: any) => r.entry_count },
      ]} />}
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          {commissionPeriod.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hoa hồng trong kỳ" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={commissionPeriod}>
                <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toFixed(1)} tr`} />
                <Bar dataKey="total" name="Hoa hồng (tr)" fill="#E06666" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Col>
        <Col xs={24} lg={12}>
          <Table
            rowKey={(_, i) => String(i)}
            dataSource={commissions.by_actor ?? []}
            size="small"
            pagination={false}
            columns={[
              { title: 'Đối tượng', dataIndex: 'actor_type', render: (v: string) => ACTOR_LABEL[v] ?? v },
              { title: 'Tên', dataIndex: 'actor_name', render: (v: any) => v || '(không tên)' },
              { title: 'Tổng', dataIndex: 'total_amount', width: 130, align: 'right', render: (v: any) => fmtMoney(v) },
            ]}
          />
        </Col>
      </Row>
    </Card>
  )

  return (
    <div className="rpt-section">
      <style>{`
        .rpt-section .ant-row .ant-col { display: flex; flex-direction: column; }
        .rpt-section .ant-row .ant-col > .ant-card { flex: 1; width: 100%; }
      `}</style>
      {filterBar}
      {kpiRow}
      {section === 'money' && <>{moneySection}{commissionSection}</>}
      {section === 'customers' && customerSection}
      {section === 'ops' && opsSection}
    </div>
  )
}
