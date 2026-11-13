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
import { ability } from '@/configs/casl/ability'

export interface PagePermission {
  action: string
  subject: string
}

interface MenuLeaf {
  key: string
  icon: ReactNode
  label: string
  hideForKtv?: boolean
  hideForReceptionist?: boolean
  ktvOnly?: boolean
  adminOnly?: boolean
  receptionistOrAdminOnly?: boolean
  brandReadForStaff?: boolean
  // Page không khai báo permission ⇒ hiển thị cho mọi user đã đăng nhập.
  permission?: PagePermission | PagePermission[]
}

interface MenuGroup extends Omit<MenuLeaf, 'permission' | 'key'> {
  type: 'group'
  children: MenuLeaf[]
}

export type MenuItem = MenuLeaf | MenuGroup

export const menuItems: MenuItem[] = [
  { key: '/', icon: createElement(DashboardOutlined), label: 'Dashboard', adminOnly: true },
  {
    type: 'group',
    label: 'Khách hàng',
    icon: null,
    children: [
      { key: '/users', icon: createElement(TeamOutlined), label: 'Danh sách khách', permission: { action: 'READ', subject: 'CUSTOMER' } },
      { key: '/appointments', icon: createElement(CalendarOutlined), label: 'Lịch hẹn', permission: { action: 'READ', subject: 'APPOINTMENT' } },
      { key: '/treatment-customers', icon: createElement(SolutionOutlined), label: 'Liệu trình KH', permission: { action: 'READ', subject: 'TREATMENT_PACKAGE' } },
      { key: '/my-sessions', icon: createElement(ExperimentOutlined), label: 'Buổi của tôi', permission: { action: 'READ', subject: 'CUSTOMER' }, ktvOnly: true },
      { key: '/health-records', icon: createElement(FileTextOutlined), label: 'Sổ sức khỏe', permission: { action: 'READ', subject: 'CUSTOMER' }, hideForKtv: true },
      {
        key: '/points', icon: createElement(StarOutlined), label: 'Điểm & Hạng', permission: [
          { action: 'RECALCULATE', subject: 'MEMBERSHIP' },
          { action: 'RANK_OVERRIDE', subject: 'MEMBERSHIP' },
          { action: 'POINTS_ADJUST', subject: 'MEMBERSHIP' },
          { action: 'READ', subject: 'CARD_RANK' },
        ]
      },
      { key: '/rewards', icon: createElement(GiftOutlined), label: 'Quà & Lượt đổi', permission: { action: 'READ', subject: 'REWARD' } },
      { key: '/warranty-claims', icon: createElement(FileTextOutlined), label: 'Bảo hành gói liệu trình', permission: { action: 'READ', subject: 'CUSTOMER' }, hideForKtv: true },
    ],
  },
  {
    type: 'group',
    label: 'Kinh doanh',
    icon: null,
    children: [
      { key: '/services', icon: createElement(ShoppingOutlined), label: 'Gói dịch vụ', permission: { action: 'READ', subject: 'SERVICE' } },
      { key: '/treatments', icon: createElement(ExperimentOutlined), label: 'Gói liệu trình', permission: { action: 'READ', subject: 'TREATMENT_PACKAGE' } },
      { key: '/payments', icon: createElement(AccountBookOutlined), label: 'Sổ thanh toán', permission: { action: 'READ', subject: 'PAYMENT' } },
      { key: '/products', icon: createElement(ShoppingOutlined), label: 'Sản phẩm', hideForKtv: true },
      { key: '/orders', icon: createElement(ProfileOutlined), label: 'Đơn hàng', hideForKtv: true },
      { key: '/academy/courses', icon: createElement(BookOutlined), label: 'Khóa học đào tạo', permission: { action: 'READ', subject: 'ACADEMY' } },
      { key: '/academy/registrations', icon: createElement(SolutionOutlined), label: 'Đăng ký học viên', permission: { action: 'READ', subject: 'ACADEMY' } },
      { key: '/discount-rules', icon: createElement(StarOutlined), label: 'Giảm giá & Ưu đãi', permission: { action: 'READ', subject: 'DISCOUNT' } },
      { key: '/vouchers', icon: createElement(GiftOutlined), label: 'Voucher & Quà tặng', permission: { action: 'READ', subject: 'VOUCHER' } },
      { key: '/luckywheel', icon: createElement(ThunderboltOutlined), label: 'Quay số may mắn', permission: { action: 'READ', subject: 'WHEEL' } },
      { key: '/commission-rules', icon: createElement(StarOutlined), label: 'Quy tắc hoa hồng', permission: { action: 'RULE_MANAGE', subject: 'COMMISSION' } },
      { key: '/commissions', icon: createElement(ProfileOutlined), label: 'Hoa hồng', permission: { action: 'READ', subject: 'COMMISSION' } },
      { key: '/collaborators', icon: createElement(TeamOutlined), label: 'Cộng tác viên', permission: { action: 'READ', subject: 'COLLABORATOR' } },
      { key: '/referrals', icon: createElement(UserSwitchOutlined), label: 'Lịch sử giới thiệu', permission: { action: 'READ', subject: 'REFERRAL' } },
    ],
  },
  {
    type: 'group',
    label: 'Nhân sự',
    icon: null,
    children: [
      { key: '/staffs', icon: createElement(UserSwitchOutlined), label: 'Chuyên viên/KTV', permission: { action: 'READ', subject: 'STAFF_PROFILE' } },
      { key: '/schedule', icon: createElement(ClockCircleOutlined), label: 'Lịch làm việc', permission: { action: 'READ', subject: 'SCHEDULE' } },
    ],
  },
  {
    type: 'group',
    label: 'Hệ thống',
    icon: null,
    children: [
      { key: '/content-posts', icon: createElement(FileTextOutlined), label: 'Nội dung App', permission: { action: 'READ', subject: 'CONTENT' } },
      { key: '/branches', icon: createElement(AppstoreOutlined), label: 'Cơ sở', permission: { action: 'READ', subject: 'BRANCH' } },
      { key: '/imports', icon: createElement(ProfileOutlined), label: 'Nhập dữ liệu khách cũ', permission: { action: 'RUN', subject: 'IMPORT' } },
      { key: '/customer-data-config', icon: createElement(ProfileOutlined), label: 'Dữ liệu khách hàng', permission: { action: 'READ', subject: 'CUSTOM_FIELD' }, hideForKtv: true, hideForReceptionist: true },
      { key: '/settings/lookups', icon: createElement(AppstoreOutlined), label: 'Danh mục chọn', permission: { action: 'READ', subject: 'LOOKUP' }, hideForKtv: true, hideForReceptionist: true },
      { key: '/settings/brand', icon: createElement(SettingOutlined), label: 'Thương hiệu', permission: { action: 'READ', subject: 'SETTING' }, brandReadForStaff: true },
      { key: '/settings/system', icon: createElement(SettingOutlined), label: 'Cài đặt hệ thống', permission: { action: 'READ', subject: 'SETTING' } },
      { key: '/settings/integrations', icon: createElement(SettingOutlined), label: 'Tích hợp dịch vụ', permission: { action: 'UPDATE', subject: 'SETTING' } },
      { key: '/notification-templates', icon: createElement(BellOutlined), label: 'Mẫu thông báo', permission: { action: 'READ', subject: 'NOTIFICATION' }, receptionistOrAdminOnly: true },
      { key: '/notifications', icon: createElement(BellOutlined), label: 'Thông báo', permission: { action: 'READ', subject: 'NOTIFICATION' } },
      { key: '/roles', icon: createElement(SafetyOutlined), label: 'Phân quyền', permission: { action: 'MANAGE', subject: 'PERMISSION' } },
      { key: '/access-logs', icon: createElement(HistoryOutlined), label: 'Nhật ký truy cập', permission: { action: 'MANAGE', subject: 'PERMISSION' } },
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
export function isKtvRoleName(role: string): boolean {
  const normalized = role.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return normalized.includes('ktv') || normalized.includes('ky thuat vien') || normalized.includes('technician')
}

export function isReceptionistRoleName(role: string): boolean {
  const normalized = role.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  return normalized === 'rec' || normalized === 'le tan' || normalized === 'receptionist'
}

function isAdminRoleName(role: string): boolean {
  return role.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'admin'
}

export function getProfileRoleNames(profile?: {
  roles?: string[]
  user_roles?: { role?: { role_name?: string } | null }[]
} | null): string[] {
  return [...new Set([
    ...(profile?.roles ?? []),
    ...(profile?.user_roles ?? []).map((assignment) => assignment.role?.role_name).filter((name): name is string => Boolean(name)),
  ])]
}

export function hasPagePermission(
  entry: { permission?: PagePermission | PagePermission[]; hideForKtv?: boolean; hideForReceptionist?: boolean; ktvOnly?: boolean; adminOnly?: boolean; receptionistOrAdminOnly?: boolean; brandReadForStaff?: boolean },
  roles: string[] = [],
  isAdmin = false,
): boolean {
  const hasAdminRole = isAdmin || roles.some(isAdminRoleName)
  if (entry.adminOnly && !hasAdminRole) return false
  if (entry.receptionistOrAdminOnly && !hasAdminRole && !roles.some(isReceptionistRoleName)) return false
  if (entry.hideForKtv && !hasAdminRole && roles.some(isKtvRoleName)) return false
  if (entry.hideForReceptionist && !hasAdminRole && roles.some(isReceptionistRoleName)) return false
  if (entry.ktvOnly && !hasAdminRole && !roles.some(isKtvRoleName)) return false
  if (entry.brandReadForStaff && roles.some((role) => isKtvRoleName(role) || isReceptionistRoleName(role))) return true
  const perms = entryPermissions(entry)
  if (!perms) return true
  return perms.some((p) => ability.can(p.action as never, p.subject))
}

function findPageEntry(pathname: string): MenuLeaf | undefined {
  for (const entry of menuItems) {
    if ('children' in entry) {
      const child = (entry.children ?? []).find((item) => item.key === pathname)
      if (child) return child
    } else if (entry.key === pathname) {
      return entry
    }
  }
  return undefined
}

export function getPagePermission(pathname: string): PagePermission[] | null {
  const entry = findPageEntry(pathname)
  return entry ? entryPermissions(entry) : null
}

export function canAccessPage(pathname: string, roles: string[] = [], isAdmin = false): boolean {
  const entry = findPageEntry(pathname)
  return !entry || hasPagePermission(entry, roles, isAdmin)
}

export function getPageTitle(pathname: string) {
  const item = menuItems
    .flatMap((entry) => ('children' in entry ? (entry.children ?? []) : []))
    .find((entry) => entry.key === pathname)
  return item?.label ?? 'Dashboard'
}
