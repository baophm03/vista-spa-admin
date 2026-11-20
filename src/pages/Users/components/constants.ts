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

/** Nhận diện vai trò Admin (có thể là Admin cơ sở hoặc toàn hệ thống). */
export function isAdminRole(code?: string | null): boolean {
  return String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'admin'
}

/** Vai trò thuộc trang quản lý nhân sự (loại trừ Khách hàng — customer chỉ được gán tự động). */
export function isUserRole(code?: string | null): boolean {
  return String(code || '').trim().toLowerCase() !== 'customer'
}

/** Màu badge vai trò: KTV/chuyên viên (staff) — xanh, lễ tân (rec) — cam, admin — đỏ, còn lại — tím. */
export function roleTagColor(code?: string | null): string {
  const normalized = String(code || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  if (normalized === 'staff') return 'green'
  if (normalized === 'rec') return 'orange'
  if (normalized === 'admin') return 'red'
  return 'purple'
}
