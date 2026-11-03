import { BellOutlined, LogoutOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Badge, Dropdown, Layout, Space, Typography } from 'antd'
import { useProfileStore } from '../stores/profile-store'
import { useGetNotifications } from '../api/endpoints/admin'
import { pickData } from '../api/helpers'

const { Header } = Layout

type AdminHeaderProps = {
  collapsed: boolean
  pageTitle: string
  onToggleCollapsed: () => void
  onOpenMobileMenu: () => void
  onNavigateNotifications: () => void
  onLogout: () => void
}

export default function AdminHeader({
  collapsed,
  pageTitle,
  onToggleCollapsed,
  onOpenMobileMenu,
  onNavigateNotifications,
  onLogout,
}: AdminHeaderProps) {
  const profile = useProfileStore((state) => state.profile)
  // Số chưa đọc trên chuông = số thông báo is_read=false trong hệ thống
  const notificationsQuery = useGetNotifications()
  const notificationRows = pickData<{ is_read?: boolean }[] | { rows?: { is_read?: boolean }[] }>(notificationsQuery.data)
  const unreadCount = ((Array.isArray(notificationRows) ? notificationRows : notificationRows?.rows ?? []) as { is_read?: boolean }[])
    .filter((row) => !row.is_read).length
  const displayName =
    (profile?.full_name as string | undefined) ||
    (profile?.zalo_name as string | undefined) ||
    (profile?.email as string | undefined) ||
    'Admin'
  // Quyền admin hệ thống xác định theo mã vai trò (roles.code = 'admin').
  const roleList = (profile?.user_roles as { role?: { code?: string | null; role_name?: string } }[] | undefined) ?? []
  const isAdminRole = roleList.some(({ role }) =>
    String(role?.code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'admin',
  )
  const roleLabel = isAdminRole ? 'Quản trị viên' : 'Nhân viên'
  return (
    <Header className="flex! h-16! shrink-0! items-center! justify-between! gap-4! border-b! border-[var(--brand-border-soft)]! bg-white! px-4! py-0! leading-normal! lg:px-6!">
      <div className="flex flex-1 items-center justify-start gap-4">
        <button
          type="button"
          aria-label="Mở menu"
          className="cursor-pointer border-0 bg-transparent p-0 text-lg leading-none text-[var(--brand-dark)] lg:hidden"
          onClick={onOpenMobileMenu}
        >
          <MenuOutlined />
        </button>
        <button
          type="button"
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          className="hidden cursor-pointer border-0 bg-transparent p-0 text-lg leading-none text-[var(--brand-dark)] lg:inline-block"
          onClick={onToggleCollapsed}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
        <Typography.Text strong className="text-base text-[#3A2C44]!">
          {pageTitle}
        </Typography.Text>
      </div>

      <Space size={20}>
        <Badge count={unreadCount} size="small" overflowCount={99}>
          <button
            type="button"
            aria-label="Thông báo"
            className="cursor-pointer border-0 bg-transparent p-0 text-lg leading-none text-[#6F7071]"
            onClick={onNavigateNotifications}
          >
            <BellOutlined />
          </button>
        </Badge>
        <div className="h-6 w-px bg-[var(--brand-border-soft)]" />
        <Dropdown
          menu={{
            items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', onClick: onLogout }],
          }}
        >
          <Space className="cursor-pointer">
            <Avatar size={34} className="bg-[var(--brand-primary)]!" icon={<UserOutlined />}>
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
            {/* Mobile: chỉ còn khung avatar; tên + vai trò chỉ hiện từ lg trở lên */}
            <div className="hidden leading-[1.2] lg:block">
              <div className="text-[13px] font-semibold">{displayName}</div>
              <div className="text-[11px] text-[#A9ADB2]">{roleLabel}</div>
            </div>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  )
}
