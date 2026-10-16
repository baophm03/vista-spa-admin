import { useEffect, useState } from 'react'
import { Avatar, Badge, ConfigProvider, Dropdown, Layout, Menu, Space, Typography, theme as antdTheme } from 'antd'
import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  GiftOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProfileOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShoppingOutlined,
  SolutionOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TOKEN_KEY } from '../api/client'
import './admin-layout.css'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { type: 'group' as const, label: 'Khách hàng', children: [
    { key: '/users', icon: <TeamOutlined />, label: 'Danh sách khách' },
    { key: '/appointments', icon: <CalendarOutlined />, label: 'Lịch hẹn' },
    { key: '/treatment-customers', icon: <SolutionOutlined />, label: 'Khách dùng liệu trình' },
    { key: '/health-records', icon: <FileTextOutlined />, label: 'Sổ sức khỏe' },
    { key: '/points', icon: <StarOutlined />, label: 'Điểm & Hạng' },
    { key: '/redemptions', icon: <GiftOutlined />, label: 'Khách đổi quà' },
  ]},
  { type: 'group' as const, label: 'Kinh doanh', children: [
    { key: '/services', icon: <ShoppingOutlined />, label: 'Dịch vụ' },
    { key: '/treatments', icon: <ExperimentOutlined />, label: 'Liệu trình' },
    { key: '/products', icon: <ShoppingOutlined />, label: 'Sản phẩm' },
    { key: '/orders', icon: <ProfileOutlined />, label: 'Đơn hàng' },
    { key: '/vouchers', icon: <GiftOutlined />, label: 'Voucher & Quà tặng' },
    { key: '/luckywheel', icon: <ThunderboltOutlined />, label: 'Quay số may mắn' },
  ]},
  { type: 'group' as const, label: 'Nhân sự', children: [
    { key: '/staffs', icon: <UserSwitchOutlined />, label: 'Chuyên viên/KTV' },
    { key: '/schedule', icon: <ClockCircleOutlined />, label: 'Lịch làm việc' },
  ]},
  { type: 'group' as const, label: 'Hệ thống', children: [
    { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo' },
    { key: '/accounts', icon: <UserOutlined />, label: 'Tài khoản' },
    { key: '/roles', icon: <SafetyOutlined />, label: 'Phân quyền' },
    { key: '/site-config', icon: <SettingOutlined />, label: 'Cấu hình trang' },
  ]},
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { token: { colorBgContainer, borderRadiusLG } } = antdTheme.useToken()

  const pageTitle =
    menuItems
      .flatMap((item) => ('children' in item ? item.children ?? [] : [item]))
      .find((item) => item.key === location.pathname)?.label ?? 'Dashboard'

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) navigate('/login', { replace: true })
  }, [navigate])

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    navigate('/login', { replace: true })
  }

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHeight: 40,
            itemBorderRadius: 10,
            itemMarginInline: 12,
            itemMarginBlock: 3,
            itemSelectedBg: '#F0E6F6',
            itemSelectedColor: '#54316F',
            itemHoverBg: '#F7F3FA',
            activeBarBorderWidth: 0,
            fontSize: 14,
          },
        },
      }}
    >
      <Layout style={{ height: '100vh', overflow: 'hidden', background: '#F5F1F7' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          trigger={null}
          theme="light"
          width={256}
          collapsedWidth={78}
          className="admin-sider"
          style={{
            height: '100vh',
            borderRight: '1px solid #F0EAF4',
          }}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              borderBottom: '1px solid #F0EAF4',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #54316F, #8E63A9)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              V
            </div>
            {!collapsed && (
              <div style={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#54316F' }}>NewSky Vista</div>
                <div style={{ fontSize: 11, color: '#A9ADB2' }}>Học viện Spa</div>
              </div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>
            <Menu
              className="admin-menu"
              items={menuItems}
              mode="inline"
              selectedKeys={[location.pathname]}
              onClick={({ key }) => navigate(key)}
              style={{ borderInlineEnd: 'none', paddingTop: 4 }}
            />
          </div>
        </Sider>

        <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Header
            style={{
              padding: '0 24px',
              background: colorBgContainer,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid #F0EAF4',
              height: 64,
              lineHeight: 'normal',
              flexShrink: 0,
              gap: 16,
            }}
          >
            <Space size={16}>
              <Typography.Text
                style={{ fontSize: 18, color: '#54316F', cursor: 'pointer' }}
                onClick={() => setCollapsed((c) => !c)}
              >
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </Typography.Text>
              <Typography.Text strong style={{ fontSize: 16, color: '#3A2C44' }}>
                {pageTitle}
              </Typography.Text>
            </Space>

            <Space size={20}>
              <Badge count={3} size="small">
                <Typography.Text
                  style={{ fontSize: 18, color: '#6F7071', cursor: 'pointer' }}
                  onClick={() => navigate('/notifications')}
                >
                  <BellOutlined />
                </Typography.Text>
              </Badge>
              <div style={{ width: 1, height: 24, background: '#F0EAF4' }} />
              <Dropdown
                menu={{
                  items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout }],
                }}
              >
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar size={34} style={{ backgroundColor: '#8E63A9' }} icon={<UserOutlined />} />
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Admin</div>
                    <div style={{ fontSize: 11, color: '#A9ADB2' }}>Quản trị viên</div>
                  </div>
                </Space>
              </Dropdown>
            </Space>
          </Header>

          <Content className="admin-content" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, minHeight: '100%' }}>
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}
