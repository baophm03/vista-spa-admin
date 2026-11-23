import { Avatar } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import type { CustomerProfileRow } from './CustomerProfileOverviewTab'
import { displayName } from '@/utils/displayName'

export default function CustomerAvatar({ profile, size = 32 }: { profile: CustomerProfileRow; size?: number }) {
  const name = displayName(profile, '?')
  const initial = name.charAt(0).toUpperCase()
  return (
    <Avatar
      size={size}
      src={profile.user?.zalo_avatar || undefined}
      icon={initial ? undefined : <UserOutlined />}
      style={{ backgroundColor: 'var(--brand-primary)', flexShrink: 0 }}
      alt={`Ảnh đại diện ${name}`}
    >
      {initial}
    </Avatar>
  )
}
