import type { Appointment } from '@/api/models/appointment'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'

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
}

export interface StaffRow {
  id: string
  zalo_name?: string
  email?: string
}

export type AppointmentRow = Appointment & {
  user?: { id?: string; full_name?: string; phone?: string } | null
  service?: { title?: string; duration_minutes?: number; price?: number | string | null; price_max?: number | string | null } | null
  customer_treatment?: {
    package_snapshot?: { name?: string | null } | null
    package?: {
      name?: string | null
      service?: { title?: string; duration_minutes?: number | null } | null
    } | null
  } | null
  staff?: { zalo_name?: string } | null
  service_amount?: number | string | null
  visit_done_at?: string | null
  skin_note?: string | null
  concern?: string | null
  diary?: string | null
  products_used?: string | null
  result?: string | null
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

/** Bảng màu thẻ lịch hẹn & chấm chú giải trạng thái (tươi sáng, tách biệt rõ ràng theo chuẩn Google Calendar). */
export const STATUS_COLORS: Record<AppointmentStatus, { text: string; bg: string; accent: string }> = {
  pending: { text: '#92400E', bg: '#FEF3C7', accent: '#F59E0B' },      // Cam vàng hổ phách tươi
  approved: { text: '#5B21B6', bg: '#F3E8FF', accent: '#7C3AED' },     // Tím NewSky Vista tươi
  in_progress: { text: '#155E75', bg: '#CFFAFE', accent: '#0891B2' },  // Xanh Cyan ngọc biển tươi
  completed: { text: '#166534', bg: '#DCFCE7', accent: '#16A34A' },    // Xanh lá cây tươi sáng
  cancelled: { text: '#334155', bg: '#F1F5F9', accent: '#64748B' },    // Xám Slate hiện đại
  rejected: { text: '#9F1239', bg: '#FFE4E6', accent: '#E11D48' },     // Đỏ hồng san hô tươi
  no_show: { text: '#312E81', bg: '#EEF2FF', accent: '#4F46E5' },      // Xanh chàm Indigo tươi
}
