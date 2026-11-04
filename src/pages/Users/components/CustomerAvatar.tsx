import { Avatar } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import type { CustomerProfileRow } from '@/components/CustomerProfileOverviewTab'

export default function CustomerAvatar({ profile, size = 32 }: { profile: CustomerProfileRow; size?: number }) {
  const initial = profile.full_name?.trim().charAt(0).toUpperCase()
  return (
    <Avatar
      size={size}
      src={profile.user?.zalo_avatar || undefined}
      icon={initial ? undefined : <UserOutlined />}
      style={{ backgroundColor: 'var(--brand-primary)', flexShrink: 0 }}
      alt={`Ảnh đại diện ${profile.full_name}`}
    >
      {initial}
    </Avatar>
  )
}
