import { useEffect, useState } from 'react'
import { ConfigProvider, Layout } from 'antd'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { TOKEN_KEY, clearAuth } from '../api/client'
import { AdminHeader, AdminSidebar, getPageTitle } from '../components/layout'
import { refreshThemeFromServer } from '../themeRuntime'

const { Content } = Layout

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const pageTitle = getPageTitle(location.pathname)

  useEffect(() => {
    // Chỉ gọi API khi đã có token — tránh bắn request lỗi trước khi guard redirect
    if (localStorage.getItem(TOKEN_KEY)) refreshThemeFromServer()
  }, [])

  const logout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  // Chưa login → redirect ngay trong render, KHÔNG mount Outlet (children sẽ không chạy effect/fetch API)
  if (!localStorage.getItem(TOKEN_KEY)) return <Navigate to="/login" replace />

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHeight: 40,
            itemBorderRadius: 10,
            itemMarginInline: 12,
            itemMarginBlock: 3,
            itemSelectedBg: 'var(--brand-tint)',
            itemSelectedColor: 'var(--brand-dark)',
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
            <div className="min-h-full rounded-xl border border-[var(--brand-border)] bg-white p-3 shadow-[0_1px_2px_rgba(var(--brand-dark-rgb),0.04),0_12px_32px_-16px_rgba(var(--brand-dark-rgb),0.1)] sm:p-4 lg:p-6">
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}
