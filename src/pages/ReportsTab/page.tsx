import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Grid,
  Popover,
  Row,
  Select,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  DownloadOutlined,
  FilterOutlined,
  LeftOutlined,
  RightOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import MobileStatCards from '@/components/base/MobileStatCards'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
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
import ListPagination from '@/components/base/ListPagination'
import { paginateRows } from '@/utils/listTable'
import { fillPeriodBuckets } from '@/utils/chartPeriods'
import { useAbility } from '@casl/react'
import { useBrandColors, useBrandCurrency } from '@/themeRuntime'
import { toCsv, downloadCsv, type CsvColumn } from '@/utils/csv'
import { getBranchesAdmin } from '@/api/endpoints/branches'
import { getCustomerProfilesAdmin } from '@/api/endpoints/customer-profiles'
import { getUsersAdmin } from '@/api/endpoints/users'
import { getReportsAppointmentsAdmin, getReportsDebtsAdmin, getReportsNewCustomersAdmin, getReportsRanksAdmin, getReportsRevenueAdmin, getReportsSessionsUsedAdmin } from '@/api/endpoints/reports'
import type { GetReportsAppointmentsAdminParams } from '@/api/models/getReportsAppointmentsAdminParams'
import type { GetReportsDebtsAdminParams } from '@/api/models/getReportsDebtsAdminParams'
import type { GetReportsNewCustomersAdminParams } from '@/api/models/getReportsNewCustomersAdminParams'
import type { GetReportsRanksAdminParams } from '@/api/models/getReportsRanksAdminParams'
import type { GetReportsRevenueAdminParams } from '@/api/models/getReportsRevenueAdminParams'
import type { GetReportsSessionsUsedAdminParams } from '@/api/models/getReportsSessionsUsedAdminParams'

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

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIAL: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
}

const SOURCE_LABEL: Record<string, string> = {
  organic: 'Khách tự đến',
  referral_customer: 'Giới thiệu bởi user cũ',
}

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
  const { format: fmtMoney, formatCompact: fmtCompactMoney } = useBrandCurrency()
  const rankColors = [brand.primary, brand.tertiary, '#3B5BDB', '#16A34A', '#E06666']
  const ability = useAbility()
  /** report.read là key tổng; các key mịn report.<loại>.read cho role REC.
   *  Dashboard bọc component trong <Can passThrough> nên ability ở đây luôn fresh khi rules đổi. */
  const canReport = useCallback((key: string) => {
    const [module, ...actionParts] = key.split('.')
    if (module !== 'report' || actionParts.length === 0) return false
    const action = actionParts.join('.').toUpperCase()
    return ability.can('READ' as never, 'REPORT') || ability.can(action as never, 'REPORT')
  }, [ability])

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
  const [periodOpen, setPeriodOpen] = useState(false)
  // Mobile (<768px): stat compact, table chuyển thành card
  const isMobile = !Grid.useBreakpoint().md

  const [loading, setLoading] = useState(true)

  const [branchOptions, setBranchOptions] = useState<Option[]>([])
  const [customerOptions, setCustomerOptions] = useState<Option[]>([])
  const [staffOptions, setStaffOptions] = useState<Option[]>([])

  const [revenue, setRevenue] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [ranks, setRanks] = useState<{ ranks?: any[]; upgrades?: any[] }>({})
  const [appointments, setAppointments] = useState<{ by_status?: any[]; by_staff?: any[] }>({})
  const [newCustomers, setNewCustomers] = useState<{ by_period?: any[]; by_source?: any[] }>({})
  const [sessions, setSessions] = useState<{ by_period?: any[]; remaining?: any[] }>({})
  const [debtsPage, setDebtsPage] = useState(1)
  const [remainingPage, setRemainingPage] = useState(1)

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
    void getBranchesAdmin()
      .then((body) => setBranchOptions(((pickData<any[]>(body) ?? []) as any[]).map((b) => ({ value: b.id, label: b.name }))))
      .catch(() => undefined)
    void getCustomerProfilesAdmin({ page: 1, limit: 200 })
      .then((body) =>
        setCustomerOptions(
          ((pickData<any[]>(body) ?? []) as any[]).map((c) => ({ value: c.id, label: `${c.full_name || c.zalo_name}${c.phone ? ' — ' + c.phone : ''}` })),
        ),
      )
      .catch(() => undefined)
    void getUsersAdmin({ currentPage: 1, pageSize: 200, has_role: true })
      .then((body) =>
        setStaffOptions(((((pickData<any>(body) ?? {}) as any)?.rows ?? []) as any[]).map((u) => ({ value: u.id, label: u.zalo_name || u.email }))),
      )
      .catch(() => undefined)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const settled = (p: Promise<unknown>) => p.catch(() => undefined)
    await Promise.all([
      canReport('report.revenue.read') ? settled(getReportsRevenueAdmin(params as GetReportsRevenueAdminParams).then((body) => setRevenue((pickData<any[]>(body) ?? []) as any[]))) : Promise.resolve(),
      canReport('report.debt.read') ? settled(getReportsDebtsAdmin({ branch_id: branchId, customer_profile_id: customerProfileId } as GetReportsDebtsAdminParams).then((body) => setDebts((pickData<any[]>(body) ?? []) as any[]))) : Promise.resolve(),
      canReport('report.rank.read') ? settled(getReportsRanksAdmin(params as GetReportsRanksAdminParams).then((body) => setRanks((pickData<any>(body) ?? {}) as { ranks?: any[]; upgrades?: any[] }))) : Promise.resolve(),
      canReport('report.appointment.read') ? settled(getReportsAppointmentsAdmin(params as GetReportsAppointmentsAdminParams).then((body) => setAppointments((pickData<any>(body) ?? {}) as { by_status?: any[]; by_staff?: any[] }))) : Promise.resolve(),
      canReport('report.customer.read') ? settled(getReportsNewCustomersAdmin(params as GetReportsNewCustomersAdminParams).then((body) => setNewCustomers((pickData<any>(body) ?? {}) as { by_period?: any[]; by_source?: any[] }))) : Promise.resolve(),
      canReport('report.session.read') ? settled(getReportsSessionsUsedAdmin(params as GetReportsSessionsUsedAdminParams).then((body) => setSessions((pickData<any>(body) ?? {}) as { by_period?: any[]; remaining?: any[] }))) : Promise.resolve(),
    ])
    setLoading(false)
  }, [params, branchId, customerProfileId, canReport])

  useEffect(() => {
    void load()
  }, [load])

  const applyFilters = () => {
    setRange(draftRange ?? range)
    setGroupBy(draftGroupBy ?? groupBy)
    setBranchId(draftBranchId ?? undefined)
    setCustomerProfileId(draftCustomerId ?? undefined)
    setStaffId(draftStaffId ?? undefined)
    setDebtsPage(1)
    setRemainingPage(1)
  }
  const resetFilters = () => {
    setRange([dayjs().subtract(29, 'day'), dayjs()])
    setGroupBy('day')
    setBranchId(undefined)
    setCustomerProfileId(undefined)
    setStaffId(undefined)
    setDebtsPage(1)
    setRemainingPage(1)
    setDraftRange(null); setDraftGroupBy(null); setDraftBranchId(null); setDraftCustomerId(null); setDraftStaffId(null)
  }

  // ----- Derived chart data -----
  const revenueMerged = useMemo(() => {
    // Fill đủ các kỳ trong khoảng lọc (kỳ không phát sinh = 0) để chart
    // hiển thị cả khi kỳ chọn chỉ có 1 kỳ có doanh thu.
    return fillPeriodBuckets(range[0], range[1], groupBy, revenue).map((r) => ({ ...r, revenue: r.revenue / 1_000_000 }))
  }, [revenue, range, groupBy])
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

  const statItems: StatItem[] = [
    { key: 'revenue', label: 'Doanh thu đã thu', value: fmtCompactMoney(revenueTotal * 1_000_000), icon: <DollarOutlined />, tone: 'tertiary', perm: 'report.revenue.read' },
    { key: 'debt', label: 'Công nợ còn lại', value: fmtCompactMoney(debtsTotal), icon: <WalletOutlined />, tone: 'neutral', perm: 'report.debt.read' },
    { key: 'newCustomers', label: 'Khách mới', value: newCustTotal.toLocaleString('vi-VN'), icon: <UserAddOutlined />, tone: 'primary', perm: 'report.customer.read' },
    { key: 'sessions', label: 'Buổi hoàn tất', value: sessionsPeriod.reduce((s, r) => s + r.sessions_used, 0).toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary', perm: 'report.session.read' },
  ].filter((k) => canReport(k.perm)) as StatItem[]

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
      ? [{ key: 'staff', label: staffOptions.find((o) => o.value === staffId)?.label ?? 'KTV', onClose: () => setStaffId(undefined) }]
      : []),
  ]

  const filterForm = (
    // Mobile: bỏ field "Kỳ" (đã có pill ngày ngoài thanh) + gộp 2 cột cho thấp popup
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12, width: isMobile ? '100%' : 300 }}>
      {!isMobile && (
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Kỳ</Typography.Text>
          <RangePicker
            style={{ width: '100%' }}
            value={draftRange ?? range}
            onChange={(v) => setDraftRange(v as [Dayjs, Dayjs] | null)}
            allowClear={false}
          />
        </div>
      )}
      <div style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } : undefined}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nhóm theo</Typography.Text>
          <Select
            style={{ width: '100%' }}
            options={GROUP_OPTIONS}
            value={draftGroupBy ?? groupBy}
            onChange={(v) => setDraftGroupBy(v)}
          />
        </div>
        <div style={isMobile ? undefined : { marginTop: 12 }}>
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
        <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>KTV</Typography.Text>
        <Select
          style={{ width: '100%' }}
          placeholder="Tất cả KTV"
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
    <Card style={{ marginBottom: 16 }}>
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
      </div>
    </Card>
  )

  /** Mobile: thanh chọn kỳ [<] [📅 dd/mm → dd/mm] [>] + nút Bộ lọc dạng pill,
   *  theo pattern "Chọn khoảng tuần" / select lọc trong Figma — 3 nút rời,
   *  pill trắng viền mảnh cao 44, bỏ Card bọc và chip kỳ dài dòng. */
  const shiftPeriod = (dir: -1 | 1) => {
    const days = range[1].diff(range[0], 'day') + 1
    setRange([range[0].add(days * dir, 'day'), range[1].add(days * dir, 'day')])
  }
  // Nút/pill mobile theo Figma: nền trắng phẳng, viền hairline --brand-border-soft,
  // radius 10-12, shadow rất mỏng — nhẹ hơn antd Button mặc định (viền đậm + shadow đáy).
  const navBtnStyle = {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: 10,
    border: '1px solid var(--brand-border-soft)',
    background: '#fff',
    color: 'var(--brand-primary)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    padding: 0,
  } as const
  const pillBtnStyle = {
    height: 40,
    borderRadius: 10,
    border: '1px solid var(--brand-border-soft)',
    background: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    padding: 0,
  } as const
  const mobileFilterBar = (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" aria-label="Kỳ trước" style={navBtnStyle} onClick={() => shiftPeriod(-1)}>
          <LeftOutlined />
        </button>
        <Popover
          open={periodOpen}
          onOpenChange={setPeriodOpen}
          trigger="click"
          placement="bottom"
          content={
            <RangePicker
              allowClear={false}
              value={range}
              onChange={(v) => {
                if (!v) return
                setRange(v as [Dayjs, Dayjs])
                setPeriodOpen(false)
              }}
            />
          }
        >
          <button type="button" style={{ ...pillBtnStyle, flex: 1, minWidth: 0, color: 'var(--brand-primary)' }}>
            <CalendarOutlined />
            {range[0].format('DD/MM')} → {range[1].format('DD/MM')}
          </button>
        </Popover>
        <button type="button" aria-label="Kỳ sau" style={navBtnStyle} onClick={() => shiftPeriod(1)}>
          <RightOutlined />
        </button>
        <Popover open={filterOpen} onOpenChange={setFilterOpen} trigger="click" placement="bottomRight" rootClassName="pinned-popover" content={filterForm}>
          <button
            type="button"
            aria-label="Bộ lọc"
            style={{
              ...navBtnStyle,
              position: 'relative',
              ...(activeFilterCount > 0
                ? { background: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: '#fff' }
                : {}),
            }}
          >
            <FilterOutlined />
            {activeFilterCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -5,
                  right: -5,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid var(--brand-primary)',
                  color: 'var(--brand-primary)',
                  fontSize: 10,
                  fontWeight: 600,
                  lineHeight: '14px',
                  textAlign: 'center' as const,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        </Popover>
      </div>
      {chips.some((c) => c.key !== 'period') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {chips.filter((c) => c.key !== 'period').map((c) => (
            <Tag
              key={c.key}
              closable={!!c.onClose}
              onClose={c.onClose}
              style={{ marginInlineEnd: 0, fontSize: 13, padding: '2px 8px' }}
            >
              {c.label}
            </Tag>
          ))}
        </div>
      )}
    </div>
  )

  const kpiRow = (
    <>
      <div className="desktop-only">
        <StatCards items={statItems} />
      </div>
      <MobileStatCards items={statItems} loading={loading} />
    </>
  )

  const moneySection = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {canReport('report.revenue.read') && (
          <Col xs={24} lg={14}>
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }}
              title="Doanh thu đã thu"
              extra={<CsvButton filename="bao-cao-doanh-thu" rows={revenue} columns={[
                { header: 'Kỳ', value: (r: any) => r.period },
                { header: 'Cơ sở', value: (r: any) => r.branch_name },
                { header: 'Doanh thu', value: (r: any) => r.revenue },
                { header: 'Số lần thanh toán', value: (r: any) => r.payment_count },
              ]} />}
            >
              {revenueMerged.length === 0 ? (
                <div style={{ flex: 1, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TableEmpty title="Chưa có dữ liệu doanh thu trong kỳ" />
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
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} interval={isMobile ? 'preserveStartEnd' : undefined} />
                    <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} tickFormatter={(v) => fmtCompactMoney(Number(v) * 1_000_000)} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtCompactMoney(Number(v) * 1_000_000)} />
                    <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke={brand.primary} strokeWidth={2.5} fill="url(#rptRevGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        )}
        {canReport('report.debt.read') && (
          <Col xs={24} lg={10}>
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }}
              title={`Công nợ — tổng ${fmtMoney(debtsTotal)}`}
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
              <div className="desktop-only">
                <Table
                  rowKey={(r: any) => r.customer_treatment_id}
                  dataSource={paginateRows(debts, debtsPage, 5)}
                  pagination={false}
                  columns={[
                    { title: 'Khách hàng', dataIndex: 'full_name', ellipsis: true },
                    { title: 'Còn nợ', dataIndex: 'debt_amount', width: 110, align: 'right', render: (v: any) => fmtMoney(v) },
                    { title: 'Trạng thái', dataIndex: 'payment_status', width: 140, render: (v: string) => PAYMENT_STATUS_LABEL[v] ?? v },
                  ]}
                />
              </div>
              <MobileCards
                rows={paginateRows(debts, debtsPage, 5)}
                rowKey={(r: any) => String(r.customer_treatment_id)}
                loading={loading}
                emptyText="Không có công nợ trong kỳ"
                renderCard={(r: any) => (
                  <>
                    <div className="mobile-card-head">
                      <div>
                        <div className="mobile-card-title">{r.full_name ?? '—'}</div>
                        <div className="mobile-card-sub">{[r.customer_code, r.package_name].filter(Boolean).join(' · ')}</div>
                      </div>
                      <Tag>{PAYMENT_STATUS_LABEL[r.payment_status] ?? r.payment_status}</Tag>
                    </div>
                    <div className="mobile-card-rows">
                      <MobileCardRow label="Còn nợ" value={fmtMoney(r.debt_amount)} />
                    </div>
                  </>
                )}
              />
              <ListPagination page={debtsPage} limit={5} total={debts.length} onChange={setDebtsPage} noun="khách hàng còn nợ" />
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
          <Col xs={24} lg={12}>
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }}
              title="Khách mới theo kỳ"
              extra={<CsvButton filename="bao-cao-khach-moi" rows={newCustPeriod} columns={[
                { header: 'Kỳ', value: (r: any) => r.period },
                { header: 'Khách mới', value: (r: any) => r.new_count },
                { header: 'Trong đó được giới thiệu', value: (r: any) => r.referred },
              ]} />}
            >
              {newCustPeriod.length === 0 ? (
                <div style={{ flex: 1, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TableEmpty title="Không có khách mới trong kỳ" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={newCustPeriod}>
                    <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} interval={isMobile ? 'preserveStartEnd' : undefined} />
                    <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="new_count" name="Khách mới" fill={brand.primary} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="referred" name="Được giới thiệu" fill={brand.tertiary} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="desktop-only">
                <Table
                  style={{ marginTop: 12 }}
                  rowKey={(r: any) => r.source}
                  dataSource={newCustomers.by_source ?? []}
                  pagination={false}
                  columns={[
                    { title: 'Nguồn', dataIndex: 'source', render: (v: string) => SOURCE_LABEL[v] ?? v },
                    { title: 'Số khách', dataIndex: 'count', width: 100, align: 'right' },
                  ]}
                />
              </div>
              <MobileCards
                rows={newCustomers.by_source ?? []}
                rowKey={(r: any) => String(r.source)}
                loading={loading}
                emptyText="Chưa có dữ liệu nguồn khách"
                renderCard={(r: any) => (
                  <div className="mobile-card-rows">
                    <MobileCardRow label={SOURCE_LABEL[r.source] ?? r.source} value={r.count} />
                  </div>
                )}
              />
            </Card>
          </Col>
        )}
        {canReport('report.rank.read') && (
          <Col xs={24} lg={12}>
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }}
              title="Phân bố hạng thẻ"
              extra={<CsvButton filename="bao-cao-hang-the" rows={ranks.ranks ?? []} columns={[
                { header: 'Hạng', value: (r: any) => r.rank_name },
                { header: 'Số thành viên', value: (r: any) => r.member_count },
              ]} />}
            >
              {rankData.length === 0 ? (
                <div style={{ flex: 1, minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TableEmpty title="Chưa có thành viên xếp hạng" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
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
              <div className="desktop-only">
                <Table
                  style={{ marginTop: 12 }}
                  rowKey={(_, i) => String(i)}
                  dataSource={ranks.upgrades ?? []}
                  pagination={false}
                  columns={[
                    { title: 'Kỳ', dataIndex: 'period' },
                    { title: 'Hạng đạt', dataIndex: 'rank_name' },
                    { title: 'Số khách nâng hạng', dataIndex: 'upgraded_count', width: 170, align: 'right' },
                  ]}
                />
              </div>
              <MobileCards
                rows={ranks.upgrades ?? []}
                rowKey={(_r, i) => String(i)}
                loading={loading}
                emptyText="Chưa có khách nâng hạng trong kỳ"
                renderCard={(r: any) => (
                  <>
                    <div className="mobile-card-head">
                      <div className="mobile-card-title">{r.rank_name ?? '—'}</div>
                    </div>
                    <div className="mobile-card-rows">
                      <MobileCardRow label="Kỳ" value={r.period} />
                      <MobileCardRow label="Số khách nâng hạng" value={r.upgraded_count} />
                    </div>
                  </>
                )}
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
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }} title="Lịch hẹn theo trạng thái">
              {(appointments.by_status ?? []).length === 0 ? (
                <TableEmpty title="Không có lịch hẹn trong kỳ" />
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
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }}
              title="Hiệu suất KTV"
              extra={<CsvButton filename="bao-cao-hieu-suat-ktv" rows={appointments.by_staff ?? []} columns={[
                { header: 'KTV', value: (r: any) => r.staff_name },
                { header: 'Tổng lịch', value: (r: any) => r.total },
                { header: 'Hoàn tất', value: (r: any) => r.completed },
                { header: 'Đã hủy', value: (r: any) => r.cancelled },
                { header: 'Không đến', value: (r: any) => r.no_show },
              ]} />}
            >
              <div className="desktop-only">
                <Table
                  rowKey={(r: any) => r.staff_id ?? 'none'}
                  dataSource={appointments.by_staff ?? []}
                  pagination={false}
                  columns={[
                    { title: 'KTV', dataIndex: 'staff_name', render: (v: any) => v || '(không tên)' },
                    { title: 'Tổng lịch', dataIndex: 'total', width: 95, align: 'right' },
                    { title: 'Hoàn tất', dataIndex: 'completed', width: 90, align: 'right' },
                    { title: 'Đã hủy', dataIndex: 'cancelled', width: 90, align: 'right' },
                    { title: 'Không đến', dataIndex: 'no_show', width: 100, align: 'right' },
                  ]}
                />
              </div>
              <MobileCards
                rows={appointments.by_staff ?? []}
                rowKey={(r: any) => String(r.staff_id ?? 'none')}
                loading={loading}
                emptyText="Không có dữ liệu hiệu suất KTV"
                renderCard={(r: any) => (
                  <>
                    <div className="mobile-card-head">
                      <div className="mobile-card-title">{r.staff_name || '(không tên)'}</div>
                    </div>
                    <div className="mobile-card-rows">
                      <MobileCardRow label="Tổng lịch" value={r.total} />
                      <MobileCardRow label="Hoàn tất" value={r.completed} />
                      <MobileCardRow label="Đã hủy" value={r.cancelled} />
                      <MobileCardRow label="Không đến" value={r.no_show} />
                    </div>
                  </>
                )}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* RP-06 Buổi đã dùng / còn lại */}
      {canReport('report.session.read') && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={10}>
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }} title="Buổi đã dùng theo kỳ">
              {sessionsPeriod.length === 0 ? (
                <TableEmpty title="Không có buổi hoàn tất trong kỳ" />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={sessionsPeriod}>
                    <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} interval={isMobile ? 'preserveStartEnd' : undefined} />
                    <YAxis tick={{ fontSize: 11, fill: '#6F7071' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="sessions_used" name="Buổi hoàn tất" fill="#16A34A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={14}>
            <Card style={{ height: '100%' }} styles={{ body: { display: 'flex', flexDirection: 'column' } }}
              title="Buổi còn lại theo khách"
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
              <div className="desktop-only">
                <Table
                  rowKey={(_, i) => String(i)}
                  dataSource={paginateRows(sessions.remaining ?? [], remainingPage, 8)}
                  pagination={false}
                  columns={[
                    { title: 'Khách hàng', dataIndex: 'full_name' },
                    { title: 'Gói', dataIndex: 'package_name' },
                    { title: 'Còn lại', dataIndex: 'sessions_remaining', width: 90, align: 'right' },
                  ]}
                />
              </div>
              <MobileCards
                rows={paginateRows(sessions.remaining ?? [], remainingPage, 8)}
                rowKey={(_r, i) => String(i)}
                loading={loading}
                emptyText="Không có gói còn buổi"
                renderCard={(r: any) => (
                  <>
                    <div className="mobile-card-head">
                      <div>
                        <div className="mobile-card-title">{r.full_name ?? '—'}</div>
                        <div className="mobile-card-sub">{r.package_name}</div>
                      </div>
                    </div>
                    <div className="mobile-card-rows">
                      <MobileCardRow label="Còn lại" value={r.sessions_remaining} />
                    </div>
                  </>
                )}
              />
              <ListPagination page={remainingPage} limit={8} total={(sessions.remaining ?? []).length} onChange={setRemainingPage} noun="gói còn lại" />
            </Card>
          </Col>
        </Row>
      )}
    </>
  )

  return (
    <div className="rpt-section">
      <style>{`
        .rpt-section .ant-row .ant-col { display: flex; flex-direction: column; }
        .rpt-section .ant-row .ant-col > .ant-card { flex: 1; width: 100%; }
      `}</style>
      {isMobile ? mobileFilterBar : filterBar}
      {kpiRow}
      {section === 'money' && moneySection}
      {section === 'customers' && customerSection}
      {section === 'ops' && opsSection}
    </div>
  )
}
