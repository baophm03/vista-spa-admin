import { useEffect, useState } from 'react'
import { Card, Col, Grid, Row, Table, Tabs, Tag } from 'antd'
import { displayName } from '@/utils/displayName'
import {
  CalendarOutlined,
  DollarOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import {
  Area,
  AreaChart,
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
import dayjs from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import MobileStatCards from '@/components/base/MobileStatCards'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import TableEmpty from '@/components/base/TableEmpty'
import { pickData, pickMeta } from '@/api/helpers'
import { fillPeriodBuckets } from '@/utils/chartPeriods'
import { Can } from '@casl/react'
import { useBrandColors, useBrandCurrency } from '@/themeRuntime'
import { getReportsAppointmentsAdmin, getReportsDebtsAdmin, getReportsRanksAdmin, getReportsRevenueAdmin } from '@/api/endpoints/reports'
import { getUsersCustomersAdmin } from '@/api/endpoints/customers'
import { getAppointmentsAdmin } from '@/api/endpoints/appointments'
import type { Appointment } from '@/api/models/appointment'
import ReportsTab from '../ReportsTab/page'

/** BE list include kèm `user` / `service`. */
type AppointmentRow = Appointment & {
  user?: { full_name?: string }
  service?: { title?: string }
}

const tooltipStyle = {
  borderRadius: 8,
  border: '1px solid var(--brand-border)',
  fontSize: 13,
}


const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'purple' },
  in_progress: { label: 'Đang làm', color: 'blue' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
  no_show: { label: 'Không đến', color: 'volcano' },
}

function Overview({
  canReport,
  canReadAppointments,
}: {
  canReport: (key: string) => boolean
  canReadAppointments: boolean
}) {
  const brand = useBrandColors()
  const { formatCompact: formatCompactMoney } = useBrandCurrency()
  const rankColors = [brand.primary, brand.tertiary, '#3B5BDB', '#16A34A', '#E06666']
  const [totalCustomers, setTotalCustomers] = useState<number | null>(null)
  const [revenueData, setRevenueData] = useState<{ period: string; revenue: number }[]>([])
  const [rankData, setRankData] = useState<{ name: string; value: number }[]>([])
  const [apptStatus, setApptStatus] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<AppointmentRow[]>([])
  const [debtTotal, setDebtTotal] = useState<number | null>(null)
  // Skeleton cho stat card mobile cho tới khi các query đầu trang xong
  const [statsLoading, setStatsLoading] = useState(true)
  // Mobile (<768px): stat compact, chart thấp lại, table chuyển thành card
  const isMobile = !Grid.useBreakpoint().md
  const chartHeight = isMobile ? 220 : 280
  const canSeeAllReports = canReport('report.read')
  const canSeeRevenue = canReport('report.revenue.read')
  const canSeeDebt = canReport('report.debt.read')
  const canSeeRanks = canReport('report.rank.read')
  const canSeeAppointmentStats = canReport('report.appointment.read')

  useEffect(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const from = dayjs().subtract(6, 'month').format('YYYY-MM-DD')
    const tasks: Promise<unknown>[] = []
    if (canSeeAllReports) {
      tasks.push(
        getUsersCustomersAdmin({ page: 1, limit: 1 })
          .then((body) => setTotalCustomers(pickMeta(body)?.total ?? 0))
          .catch(() => undefined),
      )
    }
    if (canSeeRevenue) {
      tasks.push(
        getReportsRevenueAdmin({ from_date: from, to_date: today, group_by: 'month' })
          .then((body) => {
            const rows = (pickData<any[]>(body) ?? []) as any[]
            // Fill đủ các tháng trong 6 tháng gần nhất (tháng không phát sinh = 0)
            // để chart luôn có trục thời gian thay vì báo "chưa đủ dữ liệu".
            setRevenueData(fillPeriodBuckets(from, today, 'month', rows).map((r) => ({ ...r, revenue: r.revenue / 1_000_000 })))
          })
          .catch(() => undefined),
      )
    }
    if (canSeeRanks) {
      tasks.push(
        getReportsRanksAdmin({})
          .then((body) =>
            setRankData(
              ((((pickData<any>(body) ?? {}) as any)?.ranks ?? []) as any[])
                .filter((x) => Number(x.member_count) > 0)
                .map((x) => ({ name: x.rank_name, value: Number(x.member_count) })),
            ),
          )
          .catch(() => undefined),
      )
    }
    if (canSeeAppointmentStats) {
      tasks.push(
        getReportsAppointmentsAdmin({ from_date: from, to_date: today })
          .then((body) => {
            const map: Record<string, number> = {}
            for (const s of ((((pickData<any>(body) ?? {}) as any)?.by_status ?? []) as any[])) map[s.status] = Number(s.count)
            setApptStatus(map)
          })
          .catch(() => undefined),
      )
    }
    if (canReadAppointments) {
      tasks.push(
        getAppointmentsAdmin({ page: 1, limit: 5 })
          .then((body) => setRecent((pickData<AppointmentRow[]>(body) ?? []) as AppointmentRow[]))
          .catch(() => undefined),
      )
    }
    if (canSeeDebt) {
      tasks.push(
        getReportsDebtsAdmin({})
          .then((body) => setDebtTotal(((pickData<any[]>(body) ?? []) as any[]).reduce((s, r) => s + Number(r.debt_amount ?? 0), 0)))
          .catch(() => undefined),
      )
    }
    void Promise.allSettled(tasks).then(() => setStatsLoading(false))
  }, [canSeeAllReports, canSeeRevenue, canSeeDebt, canSeeRanks, canSeeAppointmentStats, canReadAppointments])

  const pendingCount = apptStatus['pending'] ?? 0
  const totalRevenue = revenueData.reduce((s, r) => s + r.revenue, 0)
  const overviewStats: StatItem[] = []
  if (canSeeAllReports) overviewStats.push({
    key: 'customers',
    label: 'Tổng khách hàng',
    value: totalCustomers === null ? '—' : totalCustomers.toLocaleString('vi-VN'),
    icon: <TeamOutlined />,
    tone: 'primary',
    note: canSeeRanks ? `${rankData.reduce((s, r) => s + r.value, 0)} thành viên có hạng` : undefined,
  })
  if (canSeeAppointmentStats) overviewStats.push({
    key: 'pending',
    label: 'Lịch hẹn chờ duyệt',
    value: pendingCount.toLocaleString('vi-VN'),
    icon: <CalendarOutlined />,
    tone: 'secondary',
    note: `Tổng ${Object.values(apptStatus).reduce((s, v) => s + v, 0)} lịch trong 6 tháng`,
  })
  if (canSeeRevenue) overviewStats.push({
    key: 'revenue',
    label: 'Doanh thu 6 tháng',
    value: formatCompactMoney(totalRevenue * 1_000_000),
    icon: <DollarOutlined />,
    tone: 'tertiary',
  })
  if (canSeeDebt) overviewStats.push({
    key: 'debt',
    label: 'Công nợ hiện tại',
    value: debtTotal === null ? '—' : formatCompactMoney(debtTotal),
    icon: <WalletOutlined />,
    tone: 'neutral',
  })

  return (
    <>
      <div className="desktop-only">
        <StatCards items={overviewStats} />
      </div>
      <MobileStatCards items={overviewStats} loading={statsLoading} />

      {(canSeeRevenue || canSeeRanks) && <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {canSeeRevenue && <Col xs={24} lg={canSeeRanks ? 16 : 24}>
          <Card title="Doanh thu theo tháng (6 tháng gần nhất)">
            {revenueData.length === 0 ? (
              <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TableEmpty title="Chưa có dữ liệu doanh thu" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={brand.primary} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={brand.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#6F7071' }} tickFormatter={(v) => formatCompactMoney(Number(v) * 1_000_000)} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => formatCompactMoney(Number(v) * 1_000_000)} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Doanh thu"
                    stroke={brand.primary}
                    strokeWidth={2.5}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>}
        {canSeeRanks && <Col xs={24} lg={canSeeRevenue ? 8 : 24}>
          <Card title="Cơ cấu thành viên theo hạng">
            {rankData.length === 0 ? (
              <div style={{ height: chartHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TableEmpty title="Chưa có thành viên xếp hạng" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie
                    data={rankData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={isMobile ? 52 : 70}
                    outerRadius={isMobile ? 78 : 100}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {rankData.map((entry, i) => (
                      <Cell key={entry.name} fill={rankColors[i % rankColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>}
      </Row>}

      {canReadAppointments && <Card title="Lịch hẹn gần đây">
        <div className="desktop-only">
          <Table
            rowKey="id"
            dataSource={recent}
            pagination={false}
            columns={[
              {
                title: 'Khách hàng',
                render: (_, row: AppointmentRow) => displayName(row.user),
              },
              { title: 'Dịch vụ', render: (_, row: AppointmentRow) => row.service?.title ?? '—' },
              {
                title: 'Thời gian',
                key: 'time',
                width: 150,
                render: (_, row: AppointmentRow) => `${dayjs(row.appt_date).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`,
              },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                width: 130,
                render: (v?: string) => <Tag color={STATUS_MAP[v ?? '']?.color}>{STATUS_MAP[v ?? '']?.label ?? v}</Tag>,
              },
            ]}
          />
        </div>
        <MobileCards
          rows={recent}
          rowKey={(row) => String(row.id)}
          loading={statsLoading}
          emptyText="Chưa có lịch hẹn nào"
          renderCard={(row) => (
            <>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{displayName(row.user)}</div>
                  <div className="mobile-card-sub">
                    {dayjs(row.appt_date).format('DD/MM/YYYY')} {row.start_time?.slice(0, 5)}
                  </div>
                </div>
                <Tag color={STATUS_MAP[(row.status as string) ?? '']?.color}>
                  {STATUS_MAP[(row.status as string) ?? '']?.label ?? row.status}
                </Tag>
              </div>
              <div className="mobile-card-rows">
                <MobileCardRow label="Dịch vụ" value={row.service?.title ?? '—'} />
              </div>
            </>
          )}
        />
      </Card>}
    </>
  )
}

export default function Dashboard() {
  // Booleans đọc từ CASL ability một cách reactive qua children-as-function của <Can>
  const isMobile = !Grid.useBreakpoint().md
  return (
    <Can I="READ" a="REPORT" passThrough>
      {({ ability }) => {
        const canReport = (key: string) => {
          const [module, ...actionParts] = key.split('.')
          if (module !== 'report' || actionParts.length === 0) return false
          const action = actionParts.join('.').toUpperCase()
          return ability.can('READ' as never, 'REPORT') || ability.can(action as never, 'REPORT')
        }
        const canReadAppointments = ability.can('READ' as never, 'APPOINTMENT')
        const reportTabs = [
          { key: 'money', label: 'Doanh thu & Công nợ', shortLabel: 'Doanh thu', visible: canReport('report.revenue.read') || canReport('report.debt.read'), children: <ReportsTab section="money" /> },
          { key: 'customers', label: 'Báo cáo khách hàng', shortLabel: 'Khách hàng', visible: canReport('report.customer.read') || canReport('report.rank.read'), children: <ReportsTab section="customers" /> },
          { key: 'ops', label: 'Vận hành & Liệu trình', shortLabel: 'Vận hành', visible: canReport('report.appointment.read') || canReport('report.session.read'), children: <ReportsTab section="ops" /> },
        ].filter((t) => t.visible)

        return (
          <>
            <PageTitle subtitle="Tổng quan kinh doanh và hoạt động của spa">Dashboard</PageTitle>
            <Tabs
              className="dashboard-tabs"
              defaultActiveKey="overview"
              destroyOnHidden={false}
              size={isMobile ? 'small' : 'middle'}
              items={[
                { key: 'overview', label: 'Tổng quan', children: <Overview canReport={canReport} canReadAppointments={canReadAppointments} /> },
                ...reportTabs.map(({ key, label, shortLabel, children }) => ({ key, label: isMobile ? shortLabel : label, children })),
              ]}
            />
          </>
        )
      }}
    </Can>
  )
}
