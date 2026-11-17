export type UserWithRoleAssignments = {
  user_roles?: Array<{
    role?: { code?: string | null; role_name?: string | null } | null
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
    return code === 'ktv' || name === 'ktv' || name === 'ky thuat vien' || name === 'technician'
  }) ?? false
}
