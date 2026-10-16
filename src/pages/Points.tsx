import { Card, Col, Row, Table, Tag, Typography } from 'antd'
import PageTitle from '../components/PageTitle'
import { POINT_TRANSACTIONS, POINTS_POLICY } from '../mock/admin'

const RANK_COLOR: Record<string, string> = {
  Vista: 'purple',
  VIP: 'gold',
  'Kim Cương': 'geekblue',
}

export default function Points() {
  return (
    <>
      <PageTitle>Điểm & Hạng thành viên</PageTitle>
      <Row gutter={[20, 20]}>
        {POINTS_POLICY.map((p) => (
          <Col xs={24} md={8} key={p.rank}>
            <Card styles={{ body: { padding: 20 } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color={RANK_COLOR[p.rank]} style={{ fontSize: 13, padding: '2px 12px' }}>
                  {p.rank}
                </Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Từ {p.min_points.toLocaleString('vi-VN')} điểm
                </Typography.Text>
              </div>
              <div style={{ marginTop: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#6F7071' }}>Tích điểm: </span>
                  <span style={{ fontWeight: 600, color: '#54316F' }}>{p.earn_rate}</span>
                </div>
                <div style={{ marginTop: 6, color: '#6F7071' }}>{p.benefit}</div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Typography.Title level={5} style={{ marginTop: 28 }}>
        Lịch sử tích điểm
      </Typography.Title>
      <Table
        rowKey="id"
        dataSource={POINT_TRANSACTIONS}
        pagination={false}
        columns={[
          { title: 'Khách hàng', dataIndex: 'customer', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
          {
            title: 'Loại',
            dataIndex: 'type',
            width: 110,
            render: (v) => (v === 'earn' ? <Tag color="green">Tích điểm</Tag> : <Tag color="orange">Đổi điểm</Tag>),
          },
          {
            title: 'Điểm',
            dataIndex: 'points',
            width: 100,
            render: (v) => (
              <span style={{ fontWeight: 600, color: v > 0 ? '#16A34A' : '#6F7071' }}>
                {v > 0 ? `+${v}` : v}
              </span>
            ),
          },
          { title: 'Nội dung', dataIndex: 'note' },
          { title: 'Ngày', dataIndex: 'date', width: 120 },
        ]}
      />
    </>
  )
}
