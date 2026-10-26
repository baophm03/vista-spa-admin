import { useProfileStore } from '@/stores/profile-store'

/**
 * Quyền hạn từ getMyInfo: is_admin bypass toàn bộ, còn lại kiểm tra permissions[].
 */
export function usePermissions() {
  const profile = useProfileStore((s) => s.profile)
  const isAdmin = !!profile?.is_admin
  const permissions = Array.isArray(profile?.permissions) ? (profile.permissions as string[]) : []
  const can = (key: string) => isAdmin || permissions.includes(key)
  const canAny = (...keys: string[]) => isAdmin || keys.some((key) => permissions.includes(key))
  return { isAdmin, permissions, can, canAny }
}
