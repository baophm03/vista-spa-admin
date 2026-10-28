import { createElement, type ReactNode } from 'react'
import {
  AppstoreOutlined,
  BellOutlined,
  BookOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  AccountBookOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  GiftOutlined,
  HistoryOutlined,
  ProfileOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShoppingOutlined,
  SolutionOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import { ability } from '@/config/casl/ability'

export interface PagePermission {
  action: string
  subject: string
}

interface MenuLeaf {
  key: string
  icon: ReactNode
  label: string
  // Page không khai báo permission ⇒ hiển thị cho mọi user đã đăng nhập
  // (BE vista cũng không chặn các module đó — products, orders, staffs).
  permission?: PagePermission | PagePermission[]
}

interface MenuGroup extends Omit<MenuLeaf, 'permission' | 'key'> {
  type: 'group'
  children: MenuLeaf[]
}

export type MenuItem = MenuLeaf | MenuGroup

export const menuItems: MenuItem[] = [
  { key: '/', icon: createElement(DashboardOutlined), label: 'Dashboard' },
  {
    type: 'group',
    label: 'Khách hàng',
    icon: null,
    children: [
      { key: '/users', icon: createElement(TeamOutlined), label: 'Danh sách khách', permission: { action: 'READ', subject: 'CUSTOMER' } },
      { key: '/appointments', icon: createElement(CalendarOutlined), label: 'Lịch hẹn', permission: { action: 'READ', subject: 'APPOINTMENT' } },
      { key: '/treatment-customers', icon: createElement(SolutionOutlined), label: 'Khách dùng liệu trình', permission: { action: 'READ', subject: 'TREATMENT_PACKAGE' } },
      { key: '/health-records', icon: createElement(FileTextOutlined), label: 'Sổ sức khỏe', permission: { action: 'READ', subject: 'CUSTOMER' } },
      { key: '/points', icon: createElement(StarOutlined), label: 'Điểm & Hạng', permission: [
        { action: 'RECALCULATE', subject: 'MEMBERSHIP' },
        { action: 'RANK_OVERRIDE', subject: 'MEMBERSHIP' },
        { action: 'POINTS_ADJUST', subject: 'MEMBERSHIP' },
      ] },
      { key: '/rewards', icon: createElement(GiftOutlined), label: 'Quà & Lượt đổi', permission: { action: 'READ', subject: 'REWARD' } },
    ],
  },
  {
    type: 'group',
    label: 'Kinh doanh',
    icon: null,
    children: [
      { key: '/services', icon: createElement(ShoppingOutlined), label: 'Dịch vụ', permission: { action: 'READ', subject: 'SERVICE' } },
      { key: '/treatments', icon: createElement(ExperimentOutlined), label: 'Liệu trình', permission: { action: 'READ', subject: 'TREATMENT_PACKAGE' } },
      { key: '/academy/courses', icon: createElement(BookOutlined), label: 'Khóa học đào tạo', permission: { action: 'READ', subject: 'ACADEMY' } },
      { key: '/products', icon: createElement(ShoppingOutlined), label: 'Sản phẩm' },
      { key: '/orders', icon: createElement(ProfileOutlined), label: 'Đơn hàng' },
      { key: '/vouchers', icon: createElement(GiftOutlined), label: 'Voucher & Quà tặng', permission: { action: 'READ', subject: 'VOUCHER' } },
      { key: '/luckywheel', icon: createElement(ThunderboltOutlined), label: 'Quay số may mắn', permission: { action: 'READ', subject: 'WHEEL' } },
      { key: '/payments', icon: createElement(AccountBookOutlined), label: 'Sổ thanh toán', permission: { action: 'READ', subject: 'CUSTOMER' } },
    ],
  },
  {
    type: 'group',
    label: 'Nhân sự',
    icon: null,
    children: [
      { key: '/staffs', icon: createElement(UserSwitchOutlined), label: 'Chuyên viên/KTV' },
      { key: '/schedule', icon: createElement(ClockCircleOutlined), label: 'Lịch làm việc', permission: { action: 'READ', subject: 'SCHEDULE' } },
    ],
  },
  {
    type: 'group',
    label: 'Hệ thống',
    icon: null,
    children: [
      { key: '/branches', icon: createElement(AppstoreOutlined), label: 'Cơ sở', permission: { action: 'READ', subject: 'BRANCH' } },
      { key: '/customer-data-config', icon: createElement(ProfileOutlined), label: 'Dữ liệu khách hàng', permission: { action: 'READ', subject: 'CUSTOM_FIELD' } },
      { key: '/settings/lookups', icon: createElement(AppstoreOutlined), label: 'Danh mục chọn', permission: { action: 'READ', subject: 'LOOKUP' } },
      { key: '/settings/brand', icon: createElement(SettingOutlined), label: 'Thương hiệu', permission: { action: 'READ', subject: 'SETTING' } },
      { key: '/settings/system', icon: createElement(SettingOutlined), label: 'Cài đặt hệ thống', permission: { action: 'READ', subject: 'SETTING' } },
      { key: '/settings/integrations', icon: createElement(SettingOutlined), label: 'Tích hợp', permission: { action: 'UPDATE', subject: 'SETTING' } },
      { key: '/notifications', icon: createElement(BellOutlined), label: 'Thông báo', permission: { action: 'READ', subject: 'NOTIFICATION' } },
      { key: '/access-logs', icon: createElement(HistoryOutlined), label: 'Nhật ký truy cập', permission: { action: 'MANAGE', subject: 'PERMISSION' } },
      { key: '/roles', icon: createElement(SafetyOutlined), label: 'Phân quyền', permission: { action: 'MANAGE', subject: 'PERMISSION' } },
    ],
  },
]

function entryPermissions(entry: { permission?: PagePermission | PagePermission[] }): PagePermission[] | null {
  if (!entry.permission) return null
  return Array.isArray(entry.permission) ? entry.permission : [entry.permission]
}

/**
 * Check permission của 1 menu/page entry qua CASL ability — giống hasPermission
 * trong sidebar của meu. Nhiều permission ⇒ qua nếu có ÍT NHẤT một.
 */
export function hasPagePermission(entry: { permission?: PagePermission | PagePermission[] }): boolean {
  const perms = entryPermissions(entry)
  if (!perms) return true
  return perms.some((p) => ability.can(p.action as never, p.subject))
}

// Map route path → permission, dùng cho route guard trong AdminLayout
export function getPagePermission(pathname: string): PagePermission[] | null {
  for (const entry of menuItems) {
    if ('children' in entry) {
      const child = (entry.children ?? []).find((item) => item.key === pathname)
      if (child) return entryPermissions(child)
    } else if (entry.key === pathname) {
      return entryPermissions(entry)
    }
  }
  return null
}

export function getPageTitle(pathname: string) {
  const item = menuItems
    .flatMap((entry) => ('children' in entry ? (entry.children ?? []) : []))
    .find((entry) => entry.key === pathname)
  return item?.label ?? 'Dashboard'
}
