import { useEffect, useState, type ReactNode } from 'react'
import { ConfigProvider, Layout, Result } from 'antd'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useGetUsersGetMyInfo } from '../api/endpoints/users'
import { clearAuth } from '../api/mutator/custom-instance'
import { AdminHeader, AdminSidebar, getPageTitle } from '../components/layout'
import { canAccessPage, getProfileRoleNames, isKtvRoleName } from '../components/layout/sidebarMenu'
import { ability } from '../config/casl/ability'
import { AbilityProvider } from '@casl/react'
import { useAuthStore } from '../stores/auth-store'
import { useProfileStore } from '../stores/profile-store'
import { refreshThemeFromServer } from '../themeRuntime'

const { Content } = Layout

// Route guard theo CASL — page có khai báo permission mà user không có ⇒ 403
function PermissionGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const profile = useProfileStore((s) => s.profile)
  if (!profile) return <>{children}</>
  const allowed = canAccessPage(location.pathname, getProfileRoleNames(profile), !!profile.is_admin)
  if (allowed) return <>{children}</>
  return (
    <Result
      status="403"
      title="403"
      subTitle="Bạn không có quyền truy cập trang này."
    />
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const accessToken = useAuthStore((state) => state.accessToken)
  const profile = useProfileStore((state) => state.profile)
  const setProfile = useProfileStore((state) => state.setProfile)
  const profileQuery = useGetUsersGetMyInfo({ query: { enabled: Boolean(accessToken) } })
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const responseProfile = profileQuery.data
    ? ((profileQuery.data.responseData ?? (profileQuery.data as any).data ?? profileQuery.data) as Record<string, unknown>)
    : null
  const activeProfile = profile ?? responseProfile

  const pageTitle = getPageTitle(location.pathname)

  useEffect(() => {
    // Chỉ gọi API khi đã có token — tránh bắn request lỗi trước khi guard redirect
    if (accessToken) refreshThemeFromServer()
  }, [accessToken])

  useEffect(() => {
    const response = profileQuery.data
    if (!response) return
    setProfile((response.responseData ?? (response as any).data ?? response) as Record<string, unknown>)
  }, [profileQuery.data, setProfile])

  const logout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  // Chưa login → redirect ngay trong render, KHÔNG mount Outlet (children sẽ không chạy effect/fetch API)
  if (!accessToken) return <Navigate to="/login" replace />

  // KTV không có Dashboard. Đưa tài khoản về trang công việc của họ thay vì để Dashboard trả 403.
  if (location.pathname === '/' && activeProfile) {
    const roles = getProfileRoleNames(activeProfile as Parameters<typeof getProfileRoleNames>[0])
    if (!activeProfile.is_admin && roles.some(isKtvRoleName)) {
      return <Navigate to="/my-sessions" replace />
    }
  }

  // Khi mở thẳng trang chủ sau khi profile chưa được khôi phục, chờ myInfo để chọn đúng trang.
  if (location.pathname === '/' && !activeProfile && profileQuery.isLoading) {
    return <div className="grid h-screen place-items-center text-sm text-[#8a8494]">Đang tải tài khoản...</div>
  }

  // AbilityProvider — giống admin/layout của meu, để <Can> trong pages đọc ability từ context
  return (
    <AbilityProvider value={ability}>
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHeight: 40,
            itemBorderRadius: 10,
            itemMarginInline: 12,
            itemMarginBlock: 3,
            itemSelectedBg: 'var(--brand-primary)',
            itemSelectedColor: 'var(--brand-on-primary)',
            itemHoverBg: 'var(--brand-hover)',
            activeBarBorderWidth: 0,
            fontSize: 14,
          },
        },
      }}
    >
      <Layout className="h-screen! overflow-hidden! bg-[var(--brand-bg)]!">
        <AdminSidebar
          collapsed={collapsed}
          mobileOpen={mobileMenuOpen}
          pathname={location.pathname}
          onNavigate={navigate}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <Layout className="flex h-screen! flex-col!">
          <AdminHeader
            collapsed={collapsed}
            pageTitle={pageTitle}
            onToggleCollapsed={() => setCollapsed((current) => !current)}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onNavigateNotifications={() => navigate('/notifications')}
            onLogout={logout}
          />

          <Content className="min-h-0 flex-1 overflow-y-auto bg-[var(--brand-bg)]! p-3! sm:p-4! lg:p-6! [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-xl [&::-webkit-scrollbar-thumb]:bg-[var(--brand-border)]">
            {/* Nền trang theo brand.background_color — bảng/card bên trong có nền trắng riêng nên vẫn dễ đọc */}
            <div className="min-h-full">
              <PermissionGate>
                <Outlet />
              </PermissionGate>
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
    </AbilityProvider>
  )
}
