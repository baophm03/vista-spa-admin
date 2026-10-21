import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Col, Divider, Row, Space, Steps, Tag, Typography, Alert, message } from 'antd'
import { ArrowLeftOutlined, EnvironmentOutlined, PhoneOutlined, PrinterOutlined } from '@ant-design/icons'
import PageTitle from '../components/base/PageTitle'
import { ORDERS } from '../mock/admin'
import type { Order } from '../mock/admin'
import { ORDER_STATUS_META } from './Orders'

type OrderStatus = Order['status']

const STEP_ORDER: OrderStatus[] = ['pending', 'confirmed', 'shipping', 'done']

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | undefined>(ORDERS.find((o) => o.id === id))

  if (!order) {
    return (
      <>
        <PageTitle>Đơn hàng</PageTitle>
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Dữ liệu minh họa — backend chưa có module đơn hàng."
        />
      </>
    )
  }

  const total = order.items.reduce((s, i) => s + i.price * i.qty, 0)
  const currentStep = order.status === 'cancelled' ? 1 : STEP_ORDER.indexOf(order.status)

  const setStatus = (status: OrderStatus, msg: string) => {
    setOrder((o) => (o ? { ...o, status } : o))
    message.success(msg)
  }

  return (
    <>
      <PageTitle
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>
            Quay lại
          </Button>
        }
      >
        Chi tiết đơn {order.code}
      </PageTitle>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Dữ liệu minh họa — backend chưa có module đơn hàng."
      />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space size={12}>
            <Typography.Text strong style={{ fontSize: 16, color: 'var(--brand-dark)' }}>
              {order.code}
            </Typography.Text>
            <Tag color={ORDER_STATUS_META[order.status].color} style={{ fontSize: 13 }}>
              {ORDER_STATUS_META[order.status].label}
            </Tag>
          </Space>
          <Space className="max-sm:flex! max-sm:w-full! max-sm:flex-wrap!">
            <Button icon={<PrinterOutlined />} onClick={() => message.success('Đã gửi lệnh in hóa đơn')}>
              In hóa đơn
            </Button>
            {order.status === 'pending' && (
              <>
                <Button className="max-sm:w-full" type="primary" onClick={() => setStatus('confirmed', `Đã xác nhận ${order.code}`)}>
                  Xác nhận đơn
                </Button>
                <Button className="max-sm:w-full" danger onClick={() => setStatus('cancelled', `Đã hủy ${order.code}`)}>
                  Hủy đơn
                </Button>
              </>
            )}
            {order.status === 'confirmed' && (
              <>
                <Button type="primary" onClick={() => setStatus('shipping', `Đang giao ${order.code}`)}>
                  Bắt đầu giao
                </Button>
                <Button danger onClick={() => setStatus('cancelled', `Đã hủy ${order.code}`)}>
                  Hủy đơn
                </Button>
              </>
            )}
            {order.status === 'shipping' && (
              <Button type="primary" onClick={() => setStatus('done', `Hoàn tất ${order.code}`)}>
                Giao thành công
              </Button>
            )}
          </Space>
        </div>

        {order.status !== 'cancelled' ? (
          <Steps
            style={{ marginTop: 28 }}
            size="small"
            current={currentStep}
            items={[
              { title: 'Chờ xác nhận' },
              { title: 'Đã xác nhận' },
              { title: 'Đang giao' },
              { title: 'Hoàn tất' },
            ]}
          />
        ) : (
          <div style={{ marginTop: 20, padding: '14px 18px', background: 'var(--brand-bg)', borderRadius: 12 }}>
            <Typography.Text type="danger" strong>
              Đơn hàng đã bị hủy
            </Typography.Text>
          </div>
        )}
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={16}>
          <Card title={`Sản phẩm (${order.items.length})`}>
            {order.items.map((item, idx) => (
              <div key={idx}>
                {idx > 0 && <Divider style={{ margin: '14px 0' }} />}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <img
                    src={item.image}
                    alt={item.name}
                    width={64}
                    height={64}
                    style={{ borderRadius: 12, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{item.name}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Số lượng: x{item.qty}
                    </Typography.Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{(item.price * item.qty).toLocaleString('vi-VN')}đ</div>
                    {item.qty > 1 && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {item.price.toLocaleString('vi-VN')}đ/sp
                      </Typography.Text>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <Divider />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography.Text strong style={{ fontSize: 15 }}>
                Tổng cộng
              </Typography.Text>
              <Typography.Text strong style={{ fontSize: 18, color: 'var(--brand-dark)' }}>
                {total.toLocaleString('vi-VN')}đ
              </Typography.Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Khách hàng" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{order.customer}</div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8, fontSize: 13 }}>
              <Space>
                <PhoneOutlined style={{ color: 'var(--brand-primary)' }} />
                <span>{order.phone}</span>
              </Space>
              <Space align="start">
                <EnvironmentOutlined style={{ color: 'var(--brand-primary)', marginTop: 3 }} />
                <span>{order.address}</span>
              </Space>
            </div>
            {order.note && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#FBF3DF', borderRadius: 12, fontSize: 13 }}>
                Ghi chú: {order.note}
              </div>
            )}
          </Card>

          <Card title="Thanh toán & Giao hàng">
            <div style={{ display: 'grid', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary">Phương thức</Typography.Text>
                <Typography.Text strong>{order.payment}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary">Ngày đặt</Typography.Text>
                <Typography.Text strong>{order.date}</Typography.Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary">Trạng thái</Typography.Text>
                <Tag color={ORDER_STATUS_META[order.status].color}>{ORDER_STATUS_META[order.status].label}</Tag>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </>
  )
}
