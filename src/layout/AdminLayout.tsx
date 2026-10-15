import { useEffect, useState } from 'react'
import { Layout, Menu, Dropdown, Avatar, Space, theme as antdTheme } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  GiftOutlined,
  ShoppingOutlined,
  CalendarOutlined,
  ExperimentOutlined,
  UserSwitchOutlined,
  ThunderboltOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TOKEN_KEY } from '../api/client'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { type: 'group' as const, label: 'Quản lý', children: [
    { key: '/users', icon: <TeamOutlined />, label: 'Khách hàng' },
    { key: '/vouchers', icon: <GiftOutlined />, label: 'Voucher & Quà tặng' },
    { key: '/services', icon: <ShoppingOutlined />, label: 'Dịch vụ' },
  ]},
  { type: 'group' as const, label: 'Sắp ra mắt', children: [
    { key: 'appointments', icon: <CalendarOutlined />, label: 'Lịch hẹn', disabled: true },
    { key: 'staffs', icon: <UserSwitchOutlined />, label: 'Chuyên viên/KTV', disabled: true },
    { key: 'courses', icon: <ExperimentOutlined />, label: 'Liệu trình', disabled: true },
    { key: 'luckywheel', icon: <ThunderboltOutlined />, label: 'Quay số may mắn', disabled: true },
    { key: 'products', icon: <ShoppingOutlined />, label: 'Sản phẩm', disabled: true },
    { key: 'notifications', icon: <BellOutlined />, label: 'Thông báo', disabled: true },
  ]},
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [userName] = useState<string>('Admin')
  const { token: { colorBgContainer, borderRadiusLG } } = antdTheme.useToken()

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) navigate('/login', { replace: true })
  }, [navigate])

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    navigate('/login', { replace: true })
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light">
        <div style={{ height: 48, margin: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!collapsed && (
            <span style={{ fontWeight: 700, fontSize: 16, color: '#8E63A9' }}>NewSky Vista</span>
          )}
        </div>
        <Menu
          items={menuItems}
          mode="inline"
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{
          padding: '0 24px',
          background: colorBgContainer,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          borderBottom: '1px solid #F0EAF4',
          lineHeight: '64px',
        }}>
          <Dropdown
            menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: logout }] }}
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#8E63A9' }} icon={<UserOutlined />} />
              <span>{userName}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>
          <div style={{ padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
