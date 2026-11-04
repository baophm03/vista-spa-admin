export interface StaffRow {
  id: string
  zalo_name?: string
  email?: string
  phone_number?: string
  branch_id?: string | null
  is_active?: boolean
  user_roles?: { role_id?: string; role?: { role_name?: string; code?: string | null } }[]
}

/** Nhận diện vai trò KTV (bỏ dấu, lowercase). */
export function isTechnicianRole(code?: string | null): boolean {
  return String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'ktv'
}

/** Nhận diện vai trò Admin hệ thống qua mã vai trò (roles.code = 'admin'). */
export function isAdminRole(code?: string | null): boolean {
  return String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'admin'
}

export type StaffColumnKey = 'staff' | 'role' | 'branch' | 'status' | 'phone' | 'email' | 'profile' | 'in_app'

export const STAFF_COLUMN_OPTIONS: { label: string; value: StaffColumnKey }[] = [
  { label: 'Nhân viên', value: 'staff' },
  { label: 'Vai trò', value: 'role' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Trạng thái', value: 'status' },
  { label: 'SĐT', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Chức danh & dịch vụ phụ trách', value: 'profile' },
  { label: 'Hiện trên app', value: 'in_app' },
]

export const DEFAULT_VISIBLE_COLUMNS = STAFF_COLUMN_OPTIONS.map((column) => column.value)
