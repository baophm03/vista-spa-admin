import { useState } from 'react'
import { Button, Card, Col, Form, Input, Row, Switch, message } from 'antd'
import PageTitle from '../components/PageTitle'
import { SITE_CONFIG } from '../mock/admin'

export default function SiteConfig() {
  const [config, setConfig] = useState(SITE_CONFIG)
  const [form] = Form.useForm()

  const save = async () => {
    const values = await form.validateFields()
    setConfig(values)
    localStorage.setItem('vista-site-config', JSON.stringify(values))
    message.success('Đã lưu cấu hình trang')
  }

  return (
    <>
      <PageTitle
        extra={
          <Button type="primary" onClick={save}>
            Lưu cấu hình
          </Button>
        }
      >
        Cấu hình trang
      </PageTitle>
      <Row gutter={[20, 20]}>
        <Col xs={24} md={14}>
          <Card title="Thông tin spa">
            <Form form={form} layout="vertical" initialValues={config}>
              <Form.Item name="spa_name" label="Tên spa" rules={[{ required: true, message: 'Nhập tên spa' }]}>
                <Input />
              </Form.Item>
              <Form.Item name="hotline" label="Hotline">
                <Input />
              </Form.Item>
              <Form.Item name="address" label="Địa chỉ">
                <Input />
              </Form.Item>
              <Form.Item name="open_hours" label="Giờ mở cửa">
                <Input placeholder="08:00 - 21:00" />
              </Form.Item>
              <Form.Item name="zalo_oa" label="Link Zalo OA">
                <Input />
              </Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="Hiển thị" style={{ marginBottom: 20 }}>
            <Form form={form} layout="vertical" initialValues={config}>
              <Form.Item name="marquee" label="Chữ chạy trang chủ">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="hero_banner" label="Banner hero (URL)">
                <Input />
              </Form.Item>
            </Form>
            {config.hero_banner && (
              <img
                src={config.hero_banner}
                alt="banner"
                style={{ width: '100%', borderRadius: 12, objectFit: 'cover', height: 140 }}
              />
            )}
          </Card>
          <Card title="Bảo trì">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Chế độ bảo trì MiniApp</div>
                <div style={{ fontSize: 12, color: '#6F7071' }}>
                  Khách không đặt lịch được khi bật
                </div>
              </div>
              <Switch
                checked={config.maintenance}
                onChange={(v) => {
                  setConfig((c) => ({ ...c, maintenance: v }))
                  message.warning(v ? 'Đã BẬT chế độ bảo trì' : 'Đã tắt chế độ bảo trì')
                }}
              />
            </div>
          </Card>
        </Col>
      </Row>
    </>
  )
}
