import type { ReactNode } from 'react'
import { Result } from 'antd'
import { useLocation } from 'react-router-dom'
import { useProfileStore } from '../stores/profile-store'
import { canAccessPage, getProfileRoleNames } from './sidebarMenu'

// Route guard theo CASL — page có khai báo permission mà user không có ⇒ 403
export default function PermissionGate({ children }: { children: ReactNode }) {
  const location = useLocation()
  const profile = useProfileStore((s) => s.profile)
  if (!profile) return <>{children}</>
  const isGlobalAdmin = Boolean(profile.is_admin || profile.is_super_admin)
  const allowed = canAccessPage(location.pathname, getProfileRoleNames(profile), isGlobalAdmin)
  if (allowed) return <>{children}</>
  return (
    <Result
      status="403"
      title="403"
      subTitle="Bạn không có quyền truy cập trang này."
    />
  )
}
