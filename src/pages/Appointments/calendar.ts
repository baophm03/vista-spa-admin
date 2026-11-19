import type { Dayjs } from 'dayjs'
import { getAppointmentsAdmin } from '@/api/endpoints/appointments'
import { pickData, pickMeta } from '@/api/helpers'
import type { GetAppointmentsAdminParams } from '@/api/models/getAppointmentsAdminParams'
import type { CalendarView } from '../schedule/calendar/CalendarToolbar'
import type { AppointmentRow } from './components/constants'

export function mondayOf(date: Dayjs) {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
}

export function getCalendarDays(anchor: Dayjs, view: CalendarView) {
  const first = view === 'day' ? anchor.startOf('day') : mondayOf(view === 'month' ? anchor.startOf('month') : anchor)
  const count = view === 'month' ? 42 : view === 'week' ? 7 : 1
  return Array.from({ length: count }, (_, index) => first.add(index, 'day'))
}

export function getPeriodLabel(anchor: Dayjs, view: CalendarView, days: Dayjs[]) {
  if (view === 'day') return anchor.format('DD/MM/YYYY')
  if (view === 'month') return anchor.format('[Tháng] M/YYYY')
  const first = days[0]
  const last = days[days.length - 1]
  return `Tuần ${first.format(first.isSame(last, 'year') ? 'DD/MM' : 'DD/MM/YYYY')} – ${last.format('DD/MM/YYYY')}`
}

export async function fetchCalendarAppointments(params: GetAppointmentsAdminParams, signal: AbortSignal) {
  const limit = 200
  const rows = new Map<string, AppointmentRow>()
  let page = 1
  let total = 0
  do {
    const response = await getAppointmentsAdmin({ ...params, page, limit }, signal)
    const items = pickData<AppointmentRow[]>(response)
    for (const row of items) rows.set(row.id, row)
    total = pickMeta(response)?.total ?? 0
    page += 1
  } while ((page - 1) * limit < total)
  return [...rows.values()]
}

export function appointmentDay(row: AppointmentRow) {
  return row.appt_date.slice(0, 10)
}

export function timeInMinutes(time?: string | null) {
  if (!time || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(time)) return null
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
}
