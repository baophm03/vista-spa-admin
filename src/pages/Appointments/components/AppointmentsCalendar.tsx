import { useMemo, type MouseEvent } from 'react'
import { displayName } from '@/utils/displayName'
import { Button, Tooltip } from 'antd'
import {
  ClockCircleOutlined,
  FileTextOutlined,
  PhoneOutlined,
  PlusOutlined,
  TagOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import ScheduleTimeGrid, { type CalendarEvent } from '../../schedule/calendar/ScheduleTimeGrid'
import type { CalendarView } from '../../schedule/calendar/CalendarToolbar'
import { appointmentDay, timeInMinutes } from '../calendar'
import { STATUS_COLORS, STATUS_META, type AppointmentRow } from './constants'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'

interface Props {
  rows: AppointmentRow[]
  days: Dayjs[]
  anchor: Dayjs
  view: CalendarView
  loading: boolean
  filtered: boolean
  hourHeight: number
  hourRange?: { start: number; end: number }
  staffName: (row: AppointmentRow) => string
  selectedKey: string | null
  onSelect: (row: AppointmentRow) => void
  onSelectDay: (day: Dayjs) => void
  onViewWeek: () => void
  onCreate?: (day: Dayjs) => void
}

interface AppointmentEvent extends CalendarEvent {
  row: AppointmentRow
}

export type AppointmentCategory = 'consultation' | 'treatment'

export const CATEGORY_COLORS: Record<AppointmentCategory, { label: string; color: string }> = {
  consultation: { label: 'Tư vấn', color: '#0284C7' },  // Xanh dương tươi sáng
  treatment: { label: 'Liệu trình', color: '#9333EA' }, // Tím NewSky Vista tươi rực rỡ
}

function getCategory(row: AppointmentRow): AppointmentCategory {
  if (row.customer_treatment_id || row.treatment_package_id || row.customer_treatment) {
    return 'treatment'
  }
  return 'consultation'
}

/**
 * Lấy màu thẻ: kết hợp Phân loại & 7 Trạng thái chuẩn khối màu Google Calendar
 */
function getEventColor(row: AppointmentRow): string {
  const status = row.status as AppointmentStatus | undefined
  // Các trạng thái đặc thù hiển thị màu trạng thái tương ứng
  if (status && status !== 'approved' && status in STATUS_COLORS) {
    return STATUS_COLORS[status].accent
  }

  // Đã duyệt (hoặc mặc định) theo Phân loại:
  const cat = getCategory(row)
  return CATEGORY_COLORS[cat].color
}

function formatPhone(p?: string | null): string {
  if (!p) return ''
  const c = p.replace(/\D/g, '')
  if (c.length === 10) return `${c.slice(0, 4)} ${c.slice(4, 7)} ${c.slice(7)}`
  if (c.length === 11) return `${c.slice(0, 5)} ${c.slice(5, 8)} ${c.slice(8)}`
  return p
}

const EMPTY_MAP = new Map()
const ignore = () => {}

export default function AppointmentsCalendar({
  rows,
  days,
  anchor,
  view,
  loading,
  filtered,
  hourHeight,
  hourRange,
  staffName,
  selectedKey,
  onSelect,
  onSelectDay,
  onViewWeek,
  onCreate,
}: Props) {
  const events = useMemo(() => rows.map((row): AppointmentEvent => {
    const startMinute = timeInMinutes(row.start_time)
    const end = timeInMinutes(row.end_time)
    const endMinute = startMinute === null ? null : end !== null && end > startMinute ? end : Math.min(1440, startMinute + 30)
    return { key: row.id, date: dayjs(appointmentDay(row)), row, startMinute, endMinute }
  }), [rows])

  const gridDays = useMemo(() => view === 'month' ? [anchor.startOf('month')] : days, [view, anchor, days])

  return (
    <div className="flex min-h-[60dvh] min-w-0 flex-1 flex-col md:min-h-0">
      {!loading && !rows.length && (
        <div className="flex min-h-8 shrink-0 flex-wrap items-center justify-center gap-x-2 border-b border-[var(--brand-border-soft)] bg-neutral-50 px-3 py-1 text-center text-xs text-neutral-700">
          <span role="status">
            {filtered ? 'Không có lịch hẹn phù hợp bộ lọc' : view === 'day' ? `Không có lịch hẹn ngày ${anchor.format('DD/MM')}` : 'Không có lịch hẹn trong khoảng này'}
          </span>
          {view === 'day' && (
            <Button type="link" size="small" className="px-0! text-xs!" onClick={onViewWeek}>Xem tuần</Button>
          )}
        </div>
      )}

      <div className="relative min-h-0 min-w-0 flex-1">
        <ScheduleTimeGrid
          view={view}
          days={gridDays}
          blocks={events}
          loading={loading}
          hourHeight={hourHeight}
          hourRange={hourRange}
          loadingLabel="Đang tải lịch hẹn…"
          moreLabel="lịch hẹn"
          notesByDate={EMPTY_MAP}
          staffById={EMPTY_MAP}
          canManage={false}
          selectedKey={selectedKey}
          onEditNote={ignore}
          onSelectBlock={({ row }) => onSelect(row)}
          onSelectDay={onSelectDay}
          onCreateDay={onCreate}
          renderDayAction={onCreate && ((date) => (
            <Button
              type="text"
              size="small"
              className="absolute! right-0.5 top-1/2 -translate-y-1/2 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/day-header:opacity-100 [@media(hover:hover)]:group-focus-within/day-header:opacity-100"
              icon={<PlusOutlined />}
              aria-label={`Thêm lịch hẹn ngày ${date.format('DD/MM/YYYY')}`}
              onClick={(event) => { event.stopPropagation(); onCreate(date) }}
            />
          ))}
          renderEvent={({ row, startMinute }, { compact, height, onSelect: select }) => {
            const statusKey = row.status as AppointmentStatus | undefined
            const statusLabel = (statusKey && STATUS_META[statusKey]?.label) || 'Chưa rõ'
            const isCancelled = statusKey === 'cancelled' || statusKey === 'rejected' || statusKey === 'no_show'
            const bgColor = getEventColor(row)

            const cat = getCategory(row)
            const categoryLabel = CATEGORY_COLORS[cat].label

            const name = displayName(row.customer_profile, 'Khách hàng')
            const phone = row.customer_profile?.phone
            const time = startMinute === null ? '' : row.start_time.slice(0, 5)
            const knownEnd = timeInMinutes(row.end_time)
            const timeRange = time && knownEnd !== null && startMinute !== null && knownEnd > startMinute
              ? `${time} – ${row.end_time?.slice(0, 5)}`
              : time

            const treatmentService = row.customer_treatment?.package?.service
            const serviceTitle = row.service?.title || treatmentService?.title
            const packageName = row.customer_treatment?.package?.name || row.customer_treatment?.package_snapshot?.name

            const serviceName = packageName
              ? (packageName.trim().toLowerCase().startsWith('gói') ? packageName.trim() : `Gói ${packageName.trim()}`)
              : serviceTitle?.trim() || (cat === 'treatment' ? 'Buổi liệu trình' : 'Tư vấn thăm khám')

            const durationMinutes = row.service?.duration_minutes
              ?? treatmentService?.duration_minutes
              ?? (knownEnd !== null && startMinute !== null && knownEnd > startMinute ? knownEnd - startMinute : null)

            const staff = staffName(row)
            const staffLabel = staff === 'Chưa phân công' ? 'Chưa gán KTV' : staff

            const singleLine = compact || height < 28

            const tooltipContent = (
              <div className="space-y-2 p-0.5 select-none min-w-[230px] max-w-[280px]">
                {/* Tiêu đề & Trạng thái */}
                <div className="flex items-start justify-between gap-2.5 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: bgColor }}
                    />
                    <span className="truncate font-bold text-slate-900 text-[13.5px] leading-snug">
                      {name}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold text-white leading-none shadow-2xs"
                    style={{ backgroundColor: bgColor }}
                  >
                    {statusLabel}
                  </span>
                </div>

                {/* Danh sách thông tin */}
                <div className="space-y-1.5 text-xs text-slate-700">
                  {/* Thời gian */}
                  <div className="flex items-center gap-2 text-slate-700">
                    <ClockCircleOutlined className="shrink-0 text-slate-400 text-[12px]" />
                    <span className="font-semibold text-slate-900 tabular-nums">
                      {timeRange || 'Chưa rõ giờ'}
                    </span>
                    {durationMinutes && (
                      <span className="text-slate-400 text-[11px] font-normal">({durationMinutes} phút)</span>
                    )}
                  </div>

                  {/* Phân loại & Dịch vụ */}
                  <div className="flex items-start gap-2 text-slate-700">
                    <TagOutlined className="shrink-0 text-slate-400 text-[12px] mt-0.5" />
                    <div className="min-w-0 leading-snug">
                      <span className="font-semibold text-slate-900">{categoryLabel}</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-700 font-medium">{serviceName}</span>
                    </div>
                  </div>

                  {/* Kỹ thuật viên */}
                  {staffLabel !== 'Chưa gán KTV' && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <UserOutlined className="shrink-0 text-slate-400 text-[12px]" />
                      <span className="text-slate-500">KTV:</span>
                      <span className="font-medium text-slate-900">{staffLabel}</span>
                    </div>
                  )}

                  {/* SĐT */}
                  {phone && (
                    <div className="flex items-center gap-2 text-slate-700">
                      <PhoneOutlined className="shrink-0 text-slate-400 text-[12px]" />
                      <span className="font-medium text-slate-800 tabular-nums">{formatPhone(phone)}</span>
                    </div>
                  )}

                  {/* Ghi chú */}
                  {row.note && (
                    <div className="flex items-start gap-2 text-slate-600 pt-1.5 border-t border-slate-100">
                      <FileTextOutlined className="shrink-0 text-slate-400 text-[12px] mt-0.5" />
                      <span className="leading-snug text-slate-700">{row.note}</span>
                    </div>
                  )}
                </div>
              </div>
            )

            return (
              <Tooltip
                title={tooltipContent}
                color="#ffffff"
                mouseEnterDelay={0.2}
                destroyTooltipOnHide
                overlayInnerStyle={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  color: '#0f172a',
                  boxShadow: '0 10px 25px -4px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.06)',
                  border: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  onClick={(event: MouseEvent<HTMLButtonElement>) => { event.stopPropagation(); select() }}
                  className={`group relative flex w-full min-w-0 cursor-pointer appearance-none flex-col overflow-hidden text-left transition-all duration-100 focus-visible:outline-2 focus-visible:outline-white hover:brightness-95 hover:shadow-md active:brightness-90 ${
                    isCancelled ? 'opacity-80' : ''
                  }`}
                  style={{
                    height: compact ? 20 : Math.max(20, height),
                    backgroundColor: bgColor,
                    borderRadius: 4,
                    border: '1px solid #ffffff',
                    boxSizing: 'border-box',
                    boxShadow: '0 1px 2px rgba(60,64,67,0.3)',
                    color: '#ffffff',
                  }}
                >
                  {/* Google Calendar: Micro / Single line mode (Month view hoặc ca < 28px) */}
                  {singleLine ? (
                    <div className="flex h-full w-full min-w-0 items-center gap-1.5 px-2 py-0.5 text-white leading-none">
                      {time && <span className="shrink-0 font-semibold text-[10px] tabular-nums opacity-95">{time}</span>}
                      <span className="shrink-0 rounded bg-white/25 px-1 py-0.2 text-[9px] font-semibold leading-none">{categoryLabel}</span>
                      <span className={`min-w-0 flex-1 truncate text-[11px] font-medium ${isCancelled ? 'line-through opacity-75' : ''}`}>
                        {name}
                      </span>
                    </div>
                  ) : height < 46 ? (
                    /* Google Calendar: Compact mode (30 min) */
                    <div className="flex h-full w-full min-w-0 flex-col justify-center px-2 py-0.5 text-white leading-tight">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="shrink-0 rounded bg-white/25 px-1 py-0.2 text-[9px] font-semibold leading-none">{categoryLabel}</span>
                        <span className={`min-w-0 flex-1 truncate text-[11.5px] font-semibold ${isCancelled ? 'line-through opacity-75' : ''}`}>{name}</span>
                      </div>
                      <div className="w-full truncate text-[10.5px] opacity-90 tabular-nums">
                        {timeRange || time}
                      </div>
                    </div>
                  ) : height < 68 ? (
                    /* Google Calendar: Medium mode (45 min) */
                    <div className="flex h-full w-full min-w-0 flex-col justify-start gap-0.5 px-2 py-1 text-white leading-tight">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="shrink-0 rounded bg-white/25 px-1 py-0.2 text-[9px] font-semibold leading-none">{categoryLabel}</span>
                        <span className={`min-w-0 flex-1 truncate text-[12px] font-semibold ${isCancelled ? 'line-through opacity-75' : ''}`}>{name}</span>
                      </div>
                      <div className="w-full truncate text-[11px] opacity-90 tabular-nums">
                        {timeRange || time}
                      </div>
                      <div className="w-full truncate text-[10.5px] opacity-85">
                        {packageName ? `Gói: ${packageName}` : serviceTitle || categoryLabel}
                      </div>
                    </div>
                  ) : (
                    /* Google Calendar: Standard / Tall mode (60+ min) */
                    <div className="flex h-full w-full min-w-0 flex-col justify-start gap-0.5 px-2.5 py-1.5 text-white leading-tight">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="shrink-0 rounded bg-white/25 px-1.5 py-0.5 text-[9.5px] font-semibold leading-none">{categoryLabel}</span>
                        <span className={`min-w-0 flex-1 truncate text-[12.5px] font-bold ${isCancelled ? 'line-through opacity-75' : ''}`}>{name}</span>
                      </div>
                      <div className="w-full truncate text-[11px] opacity-90 tabular-nums">
                        {timeRange || time}
                      </div>
                      <div className="w-full truncate text-[11px] opacity-85">
                        {packageName ? `Gói: ${packageName}` : serviceTitle || categoryLabel}
                      </div>
                      {staffLabel !== 'Chưa gán KTV' && (
                        <div className="w-full truncate text-[10.5px] opacity-75 mt-0.5">
                          KTV: {staffLabel}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              </Tooltip>
            )
          }}
        />
      </div>

      {/* Thanh chú giải: Phân loại & 7 Trạng thái */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-[var(--brand-border-soft)] bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
        {/* Nhóm Phân loại: 2 loại chuẩn là Tư vấn & Liệu trình */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-neutral-500">Phân loại:</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.consultation.color }} /> Tư vấn
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_COLORS.treatment.color }} /> Liệu trình
          </span>
        </div>

        {/* Nhóm 7 Trạng thái */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-neutral-500">Trạng thái:</span>
          {(Object.keys(STATUS_COLORS) as AppointmentStatus[]).map((st) => (
            <span key={st} className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: STATUS_COLORS[st].accent }}
              />
              {STATUS_META[st]?.label ?? st}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
