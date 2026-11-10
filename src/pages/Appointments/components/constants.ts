import type { Appointment } from '@/api/models/appointment'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import type { CustomerTreatment } from '@/api/models/customerTreatment'

export interface Slot {
  date?: string
  start_time: string
  end_time?: string
  staff_ids: string[]
}

export interface ProfileRow {
  id: string
  full_name?: string
  phone?: string
  branch_id?: string | null
}

export interface StaffRow {
  id: string
  zalo_name?: string
  email?: string
}

export type TreatmentWithMeta = CustomerTreatment & { package_type?: { name?: string }; allowed_service_ids?: string[] }

export type AppointmentRow = Appointment & {
  customer_profile?: { id?: string; full_name?: string; phone?: string; branch_id?: string | null } | null
  service?: { title?: string; duration_minutes?: number; price?: number | string | null; price_max?: number | string | null } | null
  staff?: { zalo_name?: string } | null
  treatment_package?: { id?: string; name?: string } | null
  customer_treatment?: {
    id?: string
    package_snapshot?: { name?: string } | null
    package?: { name?: string } | null
  } | null
  service_amount?: number | string | null
  visit_done_at?: string | null
  skin_note?: string | null
  concern?: string | null
  diary?: string | null
  products_used?: string | null
  result?: string | null
}

export const treatmentPackageName = (row: AppointmentRow) =>
  row.customer_treatment?.package_snapshot?.name || row.customer_treatment?.package?.name || null

export const treatmentCode = (row: AppointmentRow) => {
  const id = row.customer_treatment?.id || row.customer_treatment_id
  return id ? `G-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : null
}

export const STATUS_META: Record<AppointmentStatus, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'purple' },
  in_progress: { label: 'Đang thực hiện', color: 'blue' },
  completed: { label: 'Hoàn tất', color: 'green' },
  cancelled: { label: 'Đã hủy', color: 'default' },
  rejected: { label: 'Từ chối', color: 'red' },
  no_show: { label: 'Không đến', color: 'volcano' },
}
