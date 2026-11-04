import type { Branch } from '@/api/models/branch'
import type { StaffDayOff } from '@/api/models/staffDayOff'
import type { StaffSchedule } from '@/api/models/staffSchedule'
import type { ShiftTemplate } from '@/api/models/shiftTemplate'

export interface ScheduleStaff {
  id: string
  zalo_name?: string
  email?: string
  phone_number?: string
  branch_id?: string
  user_roles?: { role?: { role_name?: string } }[]
}

export interface ScheduleUser {
  id?: string
  user_roles?: { role?: { role_name?: string; receptionist?: boolean } }[]
}

export interface ScheduleAccess {
  isAdmin: boolean
  isReceptionist: boolean
  isTechnician: boolean
  currentUserId?: string
}

export interface SchedulePageData {
  branches: Branch[]
  staff: ScheduleStaff[]
  sharedError?: string
  retryShared: () => void
  access: ScheduleAccess
}

export type { StaffDayOff, StaffSchedule, ShiftTemplate }

export function staffLabel(staff?: ScheduleStaff | { id: string; zalo_name?: string; email?: string; phone_number?: string }): string {
  if (!staff) return 'KTV';
  return staff.zalo_name || staff.email || staff.phone_number || staff.id.slice(0, 8)
}

export function normalizeRole(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}
