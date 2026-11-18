import type dayjs from 'dayjs'
import type { ShiftTemplate } from '../types'

/** Style khối ca trên calendar — màu soft kiểu Google Calendar (bg nhạt + viền trái đậm). */
export interface ShiftStyle {
  bg: string
  border: string
  text: string
}

/** Palette sự kiện cố định (tiền lệ: AppointmentsCalendar đã dùng màu event cứng). */
const SHIFT_PALETTE: ShiftStyle[] = [
  { bg: '#E0F2FE', border: '#4285F4', text: '#075985' }, // blue
  { bg: '#DEF7EB', border: '#34A853', text: '#116044' }, // green
  { bg: '#FFF0CB', border: '#F0A400', text: '#84500B' }, // amber
  { bg: '#F3E8FD', border: '#A142F4', text: '#6D1BA3' }, // purple
  { bg: '#E4F7FA', border: '#24A0B4', text: '#0B6475' }, // teal
  { bg: '#FCE8E6', border: '#E67365', text: '#A50E0E' }, // rose
  { bg: '#EDEFFC', border: '#5F6BC4', text: '#2C348C' }, // indigo
  { bg: '#FFF0E6', border: '#F2760C', text: '#9C4210' }, // orange
]

/** Màu ô vuông KTV trong panel lọc (theo vị trí KTV trong danh sách). */
export const STAFF_CHIP_COLORS = [
  '#4285F4', '#34A853', '#A142F4', '#F0A400', '#24A0B4', '#E67365', '#5F6BC4', '#F2760C',
]

export function staffChipColor(index: number): string {
  return STAFF_CHIP_COLORS[index % STAFF_CHIP_COLORS.length]
}

/**
 * Quyết định màu khối ca theo tên template (Ca sáng → xanh, Ca chiều → xanh lá,
 * Ca tối → vàng) — giống mockup. Tên lạ rơi vào palette theo index để màu ổn định.
 */
export function shiftStyle(template: ShiftTemplate | null | undefined, index = 0): ShiftStyle {
  const name = String(template?.name ?? '').toLowerCase()
  if (name.includes('sáng') || name.includes('sang') || name.includes('morning')) return SHIFT_PALETTE[0]
  if (name.includes('chiều') || name.includes('chieu') || name.includes('afternoon')) return SHIFT_PALETTE[1]
  if (name.includes('tối') || name.includes('toi') || name.includes('evening') || name.includes('night')) return SHIFT_PALETTE[2]
  const safeIndex = ((Math.trunc(index) % SHIFT_PALETTE.length) + SHIFT_PALETTE.length) % SHIFT_PALETTE.length
  return SHIFT_PALETTE[safeIndex]
}

/** Số phút từ mốc 00:00 của start_time/end_time ('HH:mm:ss'). */
export function timeToMinutes(value?: string | null): number {
  const [hour = 0, minute = 0] = String(value ?? '').split(':').map(Number)
  return hour * 60 + minute
}

/** Thời lượng dạng gọn: '4h50', '2h', '45p'. */
export function formatDuration(from?: string | null, to?: string | null): string {
  const minutes = Math.max(timeToMinutes(to) - timeToMinutes(from), 0)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest) return `${hours}h${rest}`
  if (hours) return `${hours}h`
  return `${rest}p`
}

/** Thời lượng dạng dài cho panel chi tiết: '4 giờ 50 phút'. */
export function formatDurationLong(from?: string | null, to?: string | null): string {
  const minutes = Math.max(timeToMinutes(to) - timeToMinutes(from), 0)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours && rest) return `${hours} giờ ${rest} phút`
  if (hours) return `${hours} giờ`
  return `${rest} phút`
}

const WEEKDAY_FULL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

/** Nhãn ngày đầy đủ tiếng Việt: 'Thứ ba, 17 thg 11 2026'. */
export function formatFullDate(date: dayjs.Dayjs): string {
  return `${WEEKDAY_FULL[date.day()]}, ${date.format('DD [thg] M YYYY')}`
}

/** Nhãn ngày cho panel chi tiết: 'Thứ Ba, 17 tháng 11, 2026'. */
export function formatPanelDate(date: dayjs.Dayjs): string {
  const weekdayTitle = WEEKDAY_FULL[date.day()]
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  return `${weekdayTitle}, ${date.format('D [tháng] M, YYYY')}`
}
