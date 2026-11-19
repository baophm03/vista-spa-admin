export interface UserRow {
  id: string
  zalo_name?: string
  email?: string
  phone_number?: string
  branch_id?: string | null
  is_active?: boolean
  is_admin?: boolean
  is_super_admin?: boolean
  user_roles?: { role_id?: string; role?: { role_name?: string; code?: string | null } }[]
}

/** Nhận diện vai trò KTV (bỏ dấu, lowercase). */
export function isTechnicianRole(code?: string | null): boolean {
  return String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'ktv'
}

/** Nhận diện vai trò Admin (có thể là Admin cơ sở hoặc toàn hệ thống). */
export function isAdminRole(code?: string | null): boolean {
  return String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'admin'
}

/** Vai trò thuộc trang quản lý nhân sự (loại trừ Khách hàng — customer chỉ được gán tự động). */
export function isUserRole(code?: string | null): boolean {
  return String(code || '').trim().toLowerCase() !== 'customer'
}

export type UserColumnKey = 'User' | 'role' | 'branch' | 'status' | 'phone' | 'email' | 'profile' | 'in_app'

export const User_COLUMN_OPTIONS: { label: string; value: UserColumnKey }[] = [
  { label: 'Nhân viên', value: 'User' },
  { label: 'Vai trò', value: 'role' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Trạng thái', value: 'status' },
  { label: 'SĐT', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Chức danh & dịch vụ phụ trách', value: 'profile' },
  { label: 'Hiện trên app', value: 'in_app' },
]

export const DEFAULT_VISIBLE_COLUMNS = User_COLUMN_OPTIONS.map((column) => column.value)
