import { BellOutlined, LogoutOutlined, MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Badge, Dropdown, Empty, Layout, Popover, Space, Typography } from 'antd'
import dayjs from 'dayjs'
import { useProfileStore } from '../stores/profile-store'
import { useGetNotifications } from '../api/endpoints/admin'
import { pickData } from '../api/helpers'
import { groupNotifications, type NotificationGroup } from '../utils/notificationGroups'

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
  // Số chưa đọc trên chuông = số sự kiện có ít nhất 1 bản ghi is_read=false
  // (1 sự kiện gửi N người → N bản ghi trong bảng, gộp lại để đếm 1 lần)
  const notificationsQuery = useGetNotifications()
  const notificationRows = pickData<NotificationGroup['rep'][] | { rows?: NotificationGroup['rep'][] }>(notificationsQuery.data)
  const groups = groupNotifications(Array.isArray(notificationRows) ? notificationRows : notificationRows?.rows ?? [])
  const unreadCount = groups.filter((group) => group.unreadIds.length > 0).length
  // Popover chuông: 5 thông báo gần nhất; chi tiết đầy đủ ở trang Thông báo
  const latestGroups = groups.slice(0, 5)
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

  const notificationPanel = (
    <div style={{ width: 340 }}>
      <div className="flex items-center justify-between border-b border-[var(--brand-border-soft)] px-3 py-2">
        <Typography.Text strong>Thông báo</Typography.Text>
        {unreadCount > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {unreadCount} chưa đọc
          </Typography.Text>
        )}
      </div>
      {latestGroups.length === 0 ? (
        <Empty description="Chưa có thông báo" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '16px 0' }} />
      ) : (
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {latestGroups.map((group) => {
            const hasUnread = group.unreadIds.length > 0
            return (
              <div
                key={group.id}
                onClick={onNavigateNotifications}
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--brand-border-soft, #F0F0F0)',
                  background: hasUnread ? 'rgba(112, 31, 125, 0.04)' : undefined,
                }}
              >
                <div style={{ fontWeight: hasUnread ? 600 : 400, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {hasUnread && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--brand-primary)', flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.title || group.event_key}
                  </span>
                </div>
                {group.body && (
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6F7071',
                      marginTop: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {group.body}
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#A9ADB2', marginTop: 2 }}>
                  {group.sent_at ? dayjs(group.sent_at).format('DD/MM/YYYY HH:mm') : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div
        onClick={onNavigateNotifications}
        className="cursor-pointer border-t border-[var(--brand-border-soft)] px-3 py-2 text-center text-[13px] font-semibold text-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft, #F7F2FA)]"
      >
        Xem tất cả thông báo
      </div>
    </div>
  )

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
        <Popover content={notificationPanel} trigger="click" placement="bottomRight" arrow={false}>
          <Badge count={unreadCount} size="small" overflowCount={99}>
            <button
              type="button"
              aria-label="Thông báo"
              className="cursor-pointer border-0 bg-transparent p-0 text-lg leading-none text-[#6F7071]"
            >
              <BellOutlined />
            </button>
          </Badge>
        </Popover>
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
