import { Drawer, Layout, Menu } from 'antd'
import { menuItems } from './sidebarMenu'

const { Sider } = Layout

const menuClassName =
  '[--ant-menu-collapsed-icon-size:16px]! border-e-0! pt-1! [&_.ant-menu-item]:justify-start! [&_.ant-menu-item]:pl-3! [&_.ant-menu-item]:text-left! [&_.ant-menu-item_.anticon]:text-[16px]! [&_.ant-menu-item_.ant-menu-item-icon]:text-[16px]! [&_.ant-menu-item-group-title]:pl-5! [&_.ant-menu-item-group-title]:pr-4! [&_.ant-menu-item-group-title]:pt-4! [&_.ant-menu-item-group-title]:pb-1! [&_.ant-menu-item-group-title]:text-left! [&_.ant-menu-item-group-title]:text-[11px]! [&_.ant-menu-item-group-title]:font-semibold! [&_.ant-menu-item-group-title]:tracking-[0.08em]! [&_.ant-menu-item-group-title]:text-[#A9ADB2]! [&_.ant-menu-item-group-title]:uppercase!'

function SidebarContent({
  collapsed,
  pathname,
  onNavigate,
}: {
  collapsed?: boolean
  pathname: string
  onNavigate: (path: string) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center justify-start gap-2.5 overflow-hidden border-b border-[var(--brand-border-soft)] px-4">
        <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--brand-dark),var(--brand-primary))] text-base font-bold text-white">
          V
        </div>
        {!collapsed && (
          <div className="leading-[1.2] whitespace-nowrap">
            <div className="text-[15px] font-bold text-[var(--brand-dark)]">NewSky Vista</div>
            <div className="text-[11px] text-[#A9ADB2]">Học viện Spa</div>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-[120px]">
        <Menu
          className={`${menuClassName} ${collapsed ? '[&_.ant-menu-item-group-title]:hidden!' : ''}`}
          items={menuItems}
          mode="inline"
          selectedKeys={[pathname]}
          onClick={({ key }) => onNavigate(key)}
        />
      </div>
    </div>
  )
}

type AdminSidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  pathname: string
  onNavigate: (path: string) => void
  onMobileClose: () => void
}

export default function AdminSidebar({
  collapsed,
  mobileOpen,
  pathname,
  onNavigate,
  onMobileClose,
}: AdminSidebarProps) {
  return (
    <>
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        theme="light"
        width={256}
        collapsedWidth={78}
        className="hidden! h-screen! border-r! border-[var(--brand-border-soft)]! lg:block! [&_.ant-layout-sider-children]:flex! [&_.ant-layout-sider-children]:flex-col!"
      >
        <SidebarContent collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
      </Sider>

      <Drawer
        open={mobileOpen}
        placement="left"
        size={280}
        closable={false}
        onClose={onMobileClose}
        rootClassName="lg:hidden!"
        styles={{ body: { padding: 0 } }}
      >
        <SidebarContent
          pathname={pathname}
          onNavigate={(path) => {
            onMobileClose()
            onNavigate(path)
          }}
        />
      </Drawer>
    </>
  )
}
