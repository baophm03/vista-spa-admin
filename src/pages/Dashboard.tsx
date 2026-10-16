import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd'
import {
  ArrowUpOutlined,
  CalendarOutlined,
  DollarOutlined,
  TeamOutlined,
  UserOutlined,
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
import PageTitle from '../components/PageTitle'
import { APPOINTMENTS } from '../mock/admin'

const REVENUE_DATA = [
  { month: 'T5', revenue: 152, appointments: 210 },
  { month: 'T6', revenue: 168, appointments: 232 },
  { month: 'T7', revenue: 175, appointments: 245 },
  { month: 'T8', revenue: 189, appointments: 261 },
  { month: 'T9', revenue: 212, appointments: 298 },
  { month: 'T10', revenue: 245, appointments: 324 },
]

const WEEKDAY_DATA = [
  { day: 'T2', count: 18 },
  { day: 'T3', count: 22 },
  { day: 'T4', count: 25 },
  { day: 'T5', count: 20 },
  { day: 'T6', count: 28 },
  { day: 'T7', count: 42 },
  { day: 'CN', count: 38 },
]

const RANK_DATA = [
  { name: 'Vista', value: 742 },
  { name: 'VIP', value: 386 },
  { name: 'Kim Cương', value: 120 },
]

const RANK_COLORS = ['#8E63A9', '#D9A441', '#3B5BDB']

const SERVICE_DATA = [
  { name: 'Chăm sóc da cơ bản', count: 96 },
  { name: 'Glow Skin duy trì', count: 74 },
  { name: 'Peel Acne chuyên sâu', count: 61 },
  { name: 'Gội đầu thư giãn', count: 48 },
  { name: 'Nâng cơ vàng 24K', count: 32 },
]

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid #E9DDF0',
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

export default function Dashboard() {
  return (
    <>
      <PageTitle>Dashboard</PageTitle>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Tổng khách hàng" value={1248} />
              <div style={KPI_ICON_STYLE('#F0E6F6', '#8E63A9')}>
                <TeamOutlined />
              </div>
            </div>
            <Typography.Text type="success" style={{ fontSize: 12 }}>
              <ArrowUpOutlined /> +12% so với tháng trước
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Thành viên" value={386} />
              <div style={KPI_ICON_STYLE('#FBF3DF', '#D9A441')}>
                <UserOutlined />
              </div>
            </div>
            <Typography.Text type="success" style={{ fontSize: 12 }}>
              <ArrowUpOutlined /> +8% so với tháng trước
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Lịch hẹn hôm nay" value={12} />
              <div style={KPI_ICON_STYLE('#E8EDFB', '#3B5BDB')}>
                <CalendarOutlined />
              </div>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              3 lịch hẹn chờ xác nhận
            </Typography.Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card styles={{ body: { padding: '18px 20px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="Doanh thu tháng" value={245} suffix="tr" />
              <div style={KPI_ICON_STYLE('#E4F5EC', '#16A34A')}>
                <DollarOutlined />
              </div>
            </div>
            <Typography.Text type="success" style={{ fontSize: 12 }}>
              <ArrowUpOutlined /> +15.6% so với tháng trước
            </Typography.Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={16}>
          <Card title="Doanh thu & Lượt hẹn 6 tháng gần nhất">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={REVENUE_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8E63A9" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#8E63A9" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="aptGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B5BDB" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3B5BDB" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE8F3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Doanh thu (tr)"
                  stroke="#8E63A9"
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="appointments"
                  name="Lượt hẹn"
                  stroke="#3B5BDB"
                  strokeWidth={2}
                  fill="url(#aptGrad)"
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
                  data={RANK_DATA}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {RANK_DATA.map((entry, i) => (
                    <Cell key={entry.name} fill={RANK_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={12}>
          <Card title="Lịch hẹn theo ngày trong tuần">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={WEEKDAY_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE8F3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F5F1F7' }} />
                <Bar dataKey="count" name="Lượt hẹn" fill="#8E63A9" radius={[8, 8, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Dịch vụ phổ biến nhất">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={SERVICE_DATA}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 30, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EFE8F3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#6F7071' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 12, fill: '#6F7071' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#F5F1F7' }} />
                <Bar dataKey="count" name="Lượt đặt" fill="#B892D0" radius={[0, 8, 8, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="Lịch hẹn gần đây">
        <Table
          rowKey="id"
          dataSource={APPOINTMENTS.slice(0, 5)}
          pagination={false}
          size="small"
          columns={[
            {
              title: 'Mã',
              dataIndex: 'code',
              width: 100,
              render: (v) => <Typography.Text code>{v}</Typography.Text>,
            },
            { title: 'Khách hàng', dataIndex: 'customer' },
            { title: 'Dịch vụ', dataIndex: 'service' },
            { title: 'Thời gian', dataIndex: 'datetime', width: 150 },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 130,
              render: (v: string) => {
                const map: Record<string, { label: string; color: string }> = {
                  pending: { label: 'Chờ xác nhận', color: 'orange' },
                  confirmed: { label: 'Đã xác nhận', color: 'purple' },
                  done: { label: 'Hoàn tất', color: 'green' },
                  cancelled: { label: 'Đã hủy', color: 'default' },
                }
                return <Tag color={map[v]?.color}>{map[v]?.label ?? v}</Tag>
              },
            },
          ]}
        />
      </Card>
    </>
  )
}
