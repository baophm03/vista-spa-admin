export type UserWithRoleAssignments = {
  user_roles?: Array<{
    role?: { code?: string | null; role_name?: string | null; receptionist?: boolean | null } | null
  }> | null
}

function normalizeRole(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function isTechnicianUser(user: UserWithRoleAssignments): boolean {
  return user.user_roles?.some(({ role }) => {
    const code = normalizeRole(role?.code)
    const name = normalizeRole(role?.role_name)
    // Code 'staff' là chuẩn hiện tại (role cũ từng là 'ktv'); role_name dự phòng ('Kỹ thuật viên / ...')
    return code === 'staff' || code === 'ktv' || name.includes('ktv') || name.includes('ky thuat vien') || name === 'technician'
  }) ?? false
}

export function isReceptionistUser(user: UserWithRoleAssignments): boolean {
  return user.user_roles?.some(({ role }) => {
    const code = normalizeRole(role?.code)
    const name = normalizeRole(role?.role_name)
    // Nhận cả flag `receptionist`, code 'REC' lẫn role_name ('Lễ tân / Chăm sóc khách hàng'...)
    return role?.receptionist === true || code === 'rec' || name === 'rec' || name.includes('le tan') || name.includes('cham soc khach hang') || name.includes('receptionist')
  }) ?? false
}
