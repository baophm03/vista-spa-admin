import { useProfileStore, type AdminProfile } from '@/stores/profile-store'

/** Thông tin tài khoản hiện tại trả về từ GET /users/getMyInfo (responseData). */
export interface CurrentUserInfo {
  id?: string
  permissions?: string[]
  user_roles?: Array<{
    role?: {
      role_name?: string
      code?: string | null
      receptionist?: boolean
    } | null
  }>
}

export function asCurrentUser(profile: AdminProfile | null): CurrentUserInfo | null {
  return (profile as unknown as CurrentUserInfo) ?? null
}

export interface CustomerProfileAccess {
  isAdmin: boolean
  isReceptionist: boolean
  isTechnician: boolean
  canRead: boolean
  canManage: boolean
  canDelete: boolean
  canExport: boolean
  canViewQr: boolean
}

export const NO_CUSTOMER_PROFILE_ACCESS: CustomerProfileAccess = {
  isAdmin: false,
  isReceptionist: false,
  isTechnician: false,
  canRead: false,
  canManage: false,
  canDelete: false,
  canExport: false,
  canViewQr: false,
}

function normalizeRoleName(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function getCustomerProfileAccess(user: CurrentUserInfo | null): CustomerProfileAccess {
  if (!user) return NO_CUSTOMER_PROFILE_ACCESS
  const roles = user?.user_roles?.map((item) => item.role).filter(Boolean) ?? []
  // Quyền admin hệ thống xác định theo mã vai trò (roles.code = 'admin').
  const isAdmin = roles.some((role) => normalizeRoleName(role?.code) === 'admin')
  const isReceptionist = roles.some((role) => {
    const name = normalizeRoleName(role?.role_name)
    return role?.receptionist === true || name === 'le tan' || name === 'rec' || name === 'receptionist'
  })
  const isTechnician = roles.some((role) => {
    return normalizeRoleName(role?.code) === 'ktv'
  })
  const canRead = isAdmin || isReceptionist || isTechnician
  const canManage = isAdmin || isReceptionist

  return {
    isAdmin,
    isReceptionist,
    isTechnician,
    canRead,
    canManage,
    canDelete: isAdmin,
    canExport: canManage,
    canViewQr: canManage,
  }
}

export function normalizeRole(value: unknown): string {
  return normalizeRoleName(value)
}

/** Access hiện tại từ profile-store (được AdminLayout nạp từ getMyInfo). */
export function useCustomerProfileAccess(): CustomerProfileAccess {
  const profile = useProfileStore((s) => s.profile)
  return getCustomerProfileAccess(asCurrentUser(profile))
}
