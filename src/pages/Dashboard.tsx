import { useMemo } from 'react'
import { Card, Col, Empty, Row, Statistic, Table, Tag, Typography } from 'antd'
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
import PageTitle from '../components/base/PageTitle'
import { useGetAppointments } from '../api/endpoints/appointments'
import { useGetCustomerProfiles } from '../api/endpoints/customer-profiles'
import { useGetReportsAppointments, useGetReportsRanks, useGetReportsRevenue } from '../api/endpoints/reports'

interface Appointment {
  id: string
  appt_date: string
  start_time: string
  status: string
  customer_profile?: { full_name?: string }
  service?: { title?: string }
}
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
  const profilesQuery = useGetCustomerProfiles()
  const revenueQuery = useGetReportsRevenue()
  const ranksQuery = useGetReportsRanks()
  const appointmentsReportQuery = useGetReportsAppointments()
  const appointmentsQuery = useGetAppointments()
  const totalCustomers = ((profilesQuery.data?.responseData ?? (profilesQuery.data as any)?.data ?? {}) as { count?: number }).count ?? null
  const revenueRows = ((revenueQuery.data?.responseData ?? (revenueQuery.data as any)?.data ?? []) as any[])
  const revenueData = useMemo(() => {
    const merged = new Map<string, number>()
    for (const row of Array.isArray(revenueRows) ? revenueRows : []) merged.set(row.period, (merged.get(row.period) ?? 0) + Number(row.revenue))
    return [...merged.entries()].map(([period, revenue]) => ({ period, revenue: revenue / 1_000_000 }))
  }, [revenueQuery.data])
  const rankRows = ((ranksQuery.data?.responseData ?? (ranksQuery.data as any)?.data ?? []) as any[])
  const rankData = (Array.isArray(rankRows) ? rankRows : []).filter((row) => Number(row.member_count) > 0).map((row) => ({ name: row.rank_name, value: Number(row.member_count) }))
  const reportData = ((appointmentsReportQuery.data?.responseData ?? (appointmentsReportQuery.data as any)?.data ?? {}) as { by_status?: { status: string; count: number }[] })
  const apptStatus = Object.fromEntries((reportData.by_status ?? []).map((row) => [row.status, Number(row.count)]))
  const appointmentData = ((appointmentsQuery.data?.responseData ?? (appointmentsQuery.data as any)?.data ?? {}) as { rows?: Appointment[]; data?: Appointment[] })
  const recent = (appointmentData.rows ?? appointmentData.data ?? []).slice(0, 5)

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
            {revenueData.length < 2 ? (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={revenueData.length === 0 ? 'Chưa có dữ liệu doanh thu' : 'Chưa đủ dữ liệu — cần ít nhất 2 tháng'} />
              </div>
            ) : (
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
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Cơ cấu thành viên theo hạng">
            {rankData.length === 0 ? (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có thành viên xếp hạng" />
              </div>
            ) : (
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
            )}
          </Card>
        </Col>
      </Row>

      <Card title="Lịch hẹn gần đây">
        <Table<Appointment>
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
