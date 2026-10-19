import { useEffect, useState } from 'react'
import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd'
import {
  CalendarOutlined,
  DollarOutlined,
  TeamOutlined,
  UserOutlined,
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
import PageTitle from '../components/PageTitle'
import { listAppointments, listCustomerProfiles, reportAppointments, reportRanks, reportRevenue } from '../api/newsky'
import type { Appointment } from '../api/newsky'
import { useBrandColors } from '../themeRuntime'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid var(--brand-border)',
  fontSize: 13,
}

const KPI_ICON_STYLE = (bg: string, color: string) => ({
  width: 42,
  height: 42,
  borderRadius: 12,
  background: bg,
  color,
  display: 'flex' as const,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  fontSize: 18,
})

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'purple' },
  in_progress: { label: 'Đang làm', color: 'blue' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
}

export default function Dashboard() {
  const brand = useBrandColors()
  const rankColors = [brand.primary, '#D9A441', '#3B5BDB', '#16A34A', '#E06666']
  const [totalCustomers, setTotalCustomers] = useState<number | null>(null)
  const [revenueData, setRevenueData] = useState<{ period: string; revenue: number }[]>([])
  const [rankData, setRankData] = useState<{ name: string; value: number }[]>([])
  const [apptStatus, setApptStatus] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<Appointment[]>([])

  useEffect(() => {
    const today = dayjs().format('YYYY-MM-DD')
    const from = dayjs().subtract(6, 'month').format('YYYY-MM-DD')
    listCustomerProfiles({ page: 1, limit: 1 })
      .then(({ meta }) => setTotalCustomers(meta?.total ?? 0))
      .catch(() => undefined)
    reportRevenue({ from_date: from, to_date: today, group_by: 'month' })
      .then((rows: any) => {
        const merged = new Map<string, number>()
        for (const r of rows as any[]) merged.set(r.period, (merged.get(r.period) ?? 0) + Number(r.revenue))
        setRevenueData([...merged.entries()].map(([period, revenue]) => ({ period, revenue: revenue / 1_000_000 })))
      })
      .catch(() => undefined)
    reportRanks({})
      .then((rows: any) => setRankData((rows as any[]).filter((r) => Number(r.member_count) > 0).map((r) => ({ name: r.rank_name, value: Number(r.member_count) }))))
      .catch(() => undefined)
    reportAppointments({ from_date: from, to_date: today })
      .then((r: any) => {
        const map: Record<string, number> = {}
        for (const s of r.by_status ?? []) map[s.status] = Number(s.count)
        setApptStatus(map)
      })
      .catch(() => undefined)
    listAppointments({ page: 1, limit: 5 })
      .then(({ data }) => setRecent(data))
      .catch(() => undefined)
  }, [])

  const pendingCount = apptStatus['pending'] ?? 0
  const totalRevenue = revenueData.reduce((s, r) => s + r.revenue, 0)

  return (
    <>
      <PageTitle>Dashboard</PageTitle>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Tổng khách hàng" value={totalCustomers ?? '—'} />
              <div style={KPI_ICON_STYLE(brand.tint, brand.primary)}>
                <TeamOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Thành viên có hạng" value={rankData.reduce((s, r) => s + r.value, 0)} />
              <div style={KPI_ICON_STYLE('#FBF3DF', '#D9A441')}>
                <UserOutlined />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Lịch hẹn chờ duyệt" value={pendingCount} />
              <div style={KPI_ICON_STYLE('#E8EDFB', '#3B5BDB')}>
                <CalendarOutlined />
              </div>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Tổng {Object.values(apptStatus).reduce((s, v) => s + v, 0)} lịch 6 tháng
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Doanh thu 6 tháng" value={totalRevenue.toFixed(1)} suffix="tr" />
              <div style={KPI_ICON_STYLE('#E4F5EC', '#16A34A')}>
                <DollarOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={16}>
          <Card title="Doanh thu theo tháng (6 tháng gần nhất)">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={brand.primary} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={brand.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={brand.border} vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Number(v).toFixed(1)} tr`} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Doanh thu (tr)"
                  stroke={brand.primary}
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Cơ cấu thành viên theo hạng">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={rankData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={100}
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
          </Card>
        </Col>
      </Row>

      <Card title="Lịch hẹn gần đây">
        <Table
          rowKey="id"
          dataSource={recent}
          pagination={false}
          size="small"
          columns={[
            {
              title: 'Khách hàng',
              dataIndex: ['customer_profile', 'full_name'],
            },
            { title: 'Dịch vụ', dataIndex: ['service', 'title'] },
            {
              title: 'Thời gian',
              key: 'time',
              width: 150,
              render: (_, row) => `${dayjs(row.appt_date).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`,
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 130,
              render: (v: string) => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label ?? v}</Tag>,
            },
          ]}
        />
      </Card>
    </>
  )
}
