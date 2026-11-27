import type { CustomerProfileRow } from './CustomerProfileOverviewTab'
import { displayName } from '@/utils/displayName'
import { avatarSources } from '@/utils/avatar'
import { UserAvatar } from '@/components/base/UserAvatar'

/** Ảnh khách: ảnh hệ thống nếu có, không thì ảnh Zalo, không có cả hai thì chữ cái đầu tên */
export default function CustomerAvatar({ profile, size = 32 }: { profile: CustomerProfileRow; size?: number }) {
  return <UserAvatar src={avatarSources(profile).display} name={displayName(profile, '')} size={size} />
}
