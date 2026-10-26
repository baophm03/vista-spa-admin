import { createElement } from 'react'
import {
  AppstoreOutlined,
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  GiftOutlined,
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

export const menuItems = [
  { key: '/', icon: createElement(DashboardOutlined), label: 'Dashboard' },
  {
    type: 'group' as const,
    label: 'Khách hàng',
    children: [
      { key: '/users', icon: createElement(TeamOutlined), label: 'Danh sách khách' },
      { key: '/appointments', icon: createElement(CalendarOutlined), label: 'Lịch hẹn' },
      { key: '/treatment-customers', icon: createElement(SolutionOutlined), label: 'Khách dùng liệu trình' },
      { key: '/health-records', icon: createElement(FileTextOutlined), label: 'Sổ sức khỏe' },
      { key: '/points', icon: createElement(StarOutlined), label: 'Điểm & Hạng' },
      { key: '/rewards', icon: createElement(GiftOutlined), label: 'Quà & Lượt đổi' },
    ],
  },
  {
    type: 'group' as const,
    label: 'Kinh doanh',
    children: [
      { key: '/services', icon: createElement(ShoppingOutlined), label: 'Dịch vụ' },
      { key: '/treatments', icon: createElement(ExperimentOutlined), label: 'Liệu trình' },
      { key: '/products', icon: createElement(ShoppingOutlined), label: 'Sản phẩm' },
      { key: '/orders', icon: createElement(ProfileOutlined), label: 'Đơn hàng' },
      { key: '/vouchers', icon: createElement(GiftOutlined), label: 'Voucher & Quà tặng' },
      { key: '/luckywheel', icon: createElement(ThunderboltOutlined), label: 'Quay số may mắn' },
    ],
  },
  {
    type: 'group' as const,
    label: 'Nhân sự',
    children: [
      { key: '/staffs', icon: createElement(UserSwitchOutlined), label: 'Chuyên viên/KTV' },
      { key: '/schedule', icon: createElement(ClockCircleOutlined), label: 'Lịch làm việc' },
    ],
  },
  {
    type: 'group' as const,
    label: 'Hệ thống',
    children: [
      { key: '/branches', icon: createElement(AppstoreOutlined), label: 'Cơ sở' },
      { key: '/customer-data-config', icon: createElement(ProfileOutlined), label: 'Dữ liệu khách hàng' },
      { key: '/settings/lookups', icon: createElement(AppstoreOutlined), label: 'Danh mục chọn' },
      { key: '/settings/brand', icon: createElement(SettingOutlined), label: 'Thương hiệu' },
      { key: '/settings/integrations', icon: createElement(SettingOutlined), label: 'Tích hợp' },
      { key: '/notifications', icon: createElement(BellOutlined), label: 'Thông báo' },
      { key: '/roles', icon: createElement(SafetyOutlined), label: 'Phân quyền' },
    ],
  },
]

export function getPageTitle(pathname: string) {
  const item = menuItems
    .flatMap((entry) => ('children' in entry ? (entry.children ?? []) : []))
    .find((entry) => entry.key === pathname)
  return item?.label ?? 'Dashboard'
}
