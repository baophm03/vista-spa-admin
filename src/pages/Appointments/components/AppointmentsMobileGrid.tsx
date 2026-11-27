import { useMemo } from 'react'
import type { Dayjs } from 'dayjs'
import { displayName } from '@/utils/displayName'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import { appointmentDay, timeInMinutes } from '../calendar'
import { STATUS_COLORS, STATUS_META, type AppointmentRow } from './constants'

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const HOUR_HEIGHT = 56
const TIME_COLUMN = 52
const DAY_COLUMN = 120
const DEFAULT_START = 7 * 60
const DEFAULT_END = 18 * 60

interface Props {
  rows: AppointmentRow[]
  days: Dayjs[]
  /** Khung giờ theo ca làm việc (phút trong ngày); thiếu thì lấy 07:00–18:00 và nới theo lịch hẹn */
  hourRange?: { start: number; end: number }
  onSelect: (row: AppointmentRow) => void
}

interface PlacedRow {
  row: AppointmentRow
  start: number
  end: number
  lane: number
  lanes: number
}

/** Xếp lịch hẹn trùng giờ thành các cột con chia đều bề ngang ô ngày. */
function placeRows(rows: AppointmentRow[]): PlacedRow[] {
  const items = rows
    .map((row) => {
      const start = timeInMinutes(row.start_time)
      if (start === null) return null
      const end = timeInMinutes(row.end_time)
      return { row, start, end: end !== null && end > start ? end : start + 60, lane: 0, lanes: 1 }
    })
    .filter((item): item is PlacedRow => item !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  let cluster: PlacedRow[] = []
  let clusterEnd = -1
  const flush = () => {
    const laneEnds: number[] = []
    for (const item of cluster) {
      const lane = laneEnds.findIndex((end) => end <= item.start)
      item.lane = lane === -1 ? laneEnds.length : lane
      laneEnds[item.lane] = item.end
    }
    for (const item of cluster) item.lanes = laneEnds.length
    cluster = []
  }
  for (const item of items) {
    if (item.start >= clusterEnd) flush()
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return items
}

/** Lưới giờ mobile (Figma "Mobile / Lịch hẹn · Tuần"): cột Giờ cố định, các ngày vuốt ngang. */
export default function AppointmentsMobileGrid({ rows, days, hourRange, onSelect }: Props) {
  const single = days.length === 1
  const byDay = useMemo(() => {
    const map = new Map<string, PlacedRow[]>()
    for (const day of days) {
      const key = day.format('YYYY-MM-DD')
      map.set(key, placeRows(rows.filter((row) => appointmentDay(row) === key)))
    }
    return map
  }, [rows, days])

  const [startHour, endHour] = useMemo(() => {
    let start = hourRange?.start ?? DEFAULT_START
    let end = hourRange?.end ?? DEFAULT_END
    for (const items of byDay.values()) {
      for (const item of items) {
        start = Math.min(start, item.start)
        end = Math.max(end, item.end)
      }
    }
    return [Math.floor(start / 60), Math.ceil(end / 60)]
  }, [byDay, hourRange])
  const hours = Array.from({ length: Math.max(endHour - startHour, 1) }, (_, index) => startHour + index)
  const columns = `${TIME_COLUMN}px repeat(${days.length}, ${single ? 'minmax(0, 1fr)' : `${DAY_COLUMN}px`})`

  return (
    <div className="grid gap-2">
      {!single && <p className="m-0 text-[13px] text-[#6F7071]">Vuốt ngang để xem các ngày còn lại</p>}
      <div className="overflow-x-auto rounded-lg border border-(--brand-border-soft) bg-white">
        <div className={single ? '' : 'w-max'}>
          <div className="grid bg-(--brand-primary) text-[13px] font-semibold text-white" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-10 bg-(--brand-primary) px-2 py-2.5">Giờ</div>
            {days.map((day) => (
              <div key={day.format('YYYY-MM-DD')} className="px-2 py-2.5 whitespace-nowrap tabular-nums">
                {WEEKDAY_LABELS[day.day()]} {day.format('DD/MM')}
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: columns }}>
            <div className="sticky left-0 z-10 bg-white">
              {hours.map((hour) => (
                <div key={hour} className="flex items-center justify-center border-b border-(--brand-border-soft) text-[13px] text-[#6F7071] tabular-nums" style={{ height: HOUR_HEIGHT }}>
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map((day) => {
              const key = day.format('YYYY-MM-DD')
              return (
                <div key={key} className="relative border-l border-(--brand-border-soft)">
                  {hours.map((hour) => (
                    <div key={hour} className="border-b border-(--brand-border-soft)" style={{ height: HOUR_HEIGHT }} />
                  ))}
                  {(byDay.get(key) ?? []).map(({ row, start, end, lane, lanes }) => {
                    const status = row.status as AppointmentStatus
                    const colors = STATUS_COLORS[status] ?? STATUS_COLORS.approved
                    const top = ((start - startHour * 60) / 60) * HOUR_HEIGHT + 2
                    const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 4, 44)
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => onSelect(row)}
                        className="absolute flex cursor-pointer flex-col items-start overflow-hidden rounded-md border-0 px-1.5 py-1 text-left"
                        style={{
                          top,
                          height,
                          left: `calc(${(lane / lanes) * 100}% + 3px)`,
                          width: `calc(${100 / lanes}% - 6px)`,
                          background: colors.bg,
                          borderInlineStart: `3px solid ${colors.accent}`,
                        }}
                      >
                        <span className="w-full truncate text-[10px] leading-tight" style={{ color: colors.text }}>{STATUS_META[status]?.label ?? row.status}</span>
                        <span className="w-full truncate text-[13px] leading-tight font-semibold text-[#282335]">{displayName(row.user, 'Khách hàng')}</span>
                        {row.user?.phone && <span className="w-full truncate text-[11px] leading-tight text-[#6F7071] tabular-nums">{row.user.phone}</span>}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
