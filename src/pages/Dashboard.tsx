import { Card, Col, Row, Statistic } from 'antd'
import { TeamOutlined, GiftOutlined, ShoppingOutlined, StarOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'

const stats = [
  { title: 'Khách hàng', icon: <TeamOutlined />, color: '#8E63A9' },
  { title: 'Thành viên', icon: <StarOutlined />, color: '#C9A66B' },
  { title: 'Voucher', icon: <GiftOutlined />, color: '#8E63A9' },
  { title: 'Dịch vụ', icon: <ShoppingOutlined />, color: '#C9A66B' },
]

export default function Dashboard() {
  return (
    <>
      <PageTitle>Tổng quan</PageTitle>
      <Row gutter={[20, 20]}>
        {stats.map((s) => (
          <Col xs={24} sm={12} lg={6} key={s.title}>
            <Card styles={{ body: { padding: 24 } }}>
              <Statistic
                title={s.title}
                value="-"
                prefix={<span style={{ color: s.color, marginRight: 8 }}>{s.icon}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </>
  )
}
