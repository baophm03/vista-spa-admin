import { Button } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { CalendarView } from './CalendarToolbar'

const WEEKDAY_MINI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function mondayOf(date: Dayjs): Dayjs {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
}

interface Props {
  /** Ngày đang được chọn trên lịch chính (highlight viền). */
  value: Dayjs
  view?: CalendarView
  onSelect: (date: Dayjs) => void
  /** Các ngày có ca làm — hiển thị chấm nhỏ dưới số ngày. */
  eventDates?: Set<string>
  eventLabel?: string
  onMonthChange?: (date: Dayjs) => void
}

/** Lịch tháng thu nhỏ trong bảng điều khiển bên trái. */
export default function MiniMonthCalendar({ value, view = 'day', onSelect, eventDates, eventLabel = 'có ca làm', onMonthChange }: Props) {
  const month = value.startOf('month')
  const gridStart = mondayOf(month)
  const cells = Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'))
  const todayIso = dayjs().format('YYYY-MM-DD')
  const selectedIso = value.format('YYYY-MM-DD')
  const weekStart = mondayOf(value)
  const weekEnd = weekStart.add(6, 'day')
  const navigable = Boolean(onMonthChange)

  return (
    <div style={{ padding: onMonthChange ? 0 : '4px 0' }}>
      {onMonthChange && (
        <div className="mb-2 flex items-center justify-between gap-1 px-1">
          <span className="text-sm font-semibold leading-5 text-neutral-800">{month.format('[Tháng] M/YYYY')}</span>
          <div className="flex">
            <Button type="text" size="small" className="h-7! w-7! rounded-full!" aria-label="Tháng trước" icon={<LeftOutlined style={{ fontSize: 10 }} />} onClick={() => onMonthChange(value.subtract(1, 'month'))} />
            <Button type="text" size="small" className="h-7! w-7! rounded-full!" aria-label="Tháng sau" icon={<RightOutlined style={{ fontSize: 10 }} />} onClick={() => onMonthChange(value.add(1, 'month'))} />
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', textAlign: 'center', marginBottom: 4, borderBottom: navigable ? undefined : '1px solid var(--brand-border-soft)' }}>
        {WEEKDAY_MINI.map((label) => (
          <span key={label} style={{ fontSize: 11, fontWeight: navigable ? 500 : 600, color: !navigable && (label === 'T7' || label === 'CN') ? 'var(--brand-primary)' : '#616973', padding: navigable ? 0 : '3px 0 5px' }}>{label}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: 1, justifyItems: 'center' }}>
        {cells.map((date) => {
          const iso = date.format('YYYY-MM-DD')
          const muted = !date.isSame(month, 'month')
          const isToday = iso === todayIso
          const isSelected = iso === selectedIso
          const inPeriod = view === 'month'
            ? !muted
            : view === 'week'
              ? !date.isBefore(weekStart, 'day') && !date.isAfter(weekEnd, 'day')
              : isSelected
          const isWeekend = date.day() === 0 || date.day() === 6
          const hasEvent = eventDates?.has(iso) ?? false
          const showBand = navigable && view !== 'day' && inPeriod
          const bandStart = date.day() === 1 || (view === 'month' && date.date() === 1)
          const bandEnd = date.day() === 0 || (view === 'month' && date.isSame(month.endOf('month'), 'day'))
          return (
            <div
              key={iso}
              className={`flex w-full justify-center ${showBand ? 'bg-[color-mix(in_srgb,var(--brand-primary)_6%,white)]' : ''} ${showBand && bandStart ? 'rounded-s-md' : ''} ${showBand && bandEnd ? 'rounded-e-md' : ''}`}
            >
              <button
                type="button"
                aria-label={`${date.format('DD/MM/YYYY')}${hasEvent ? `, ${eventLabel}` : ''}`}
                aria-pressed={inPeriod}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => onSelect(date)}
                className={navigable ? 'tabular-nums shadow-none! transition-colors aria-[pressed=false]:hover:bg-[var(--brand-tint)]! focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--brand-primary)]' : undefined}
                style={{
                  border: `1px solid ${isToday && !isSelected ? 'var(--brand-primary)' : 'transparent'}`,
                  background: isSelected
                    ? 'var(--brand-primary)'
                    : 'transparent',
                  borderRadius: navigable ? '50%' : 8,
                  color: isSelected ? 'var(--brand-on-primary)' : isToday || (!navigable && isWeekend && !muted) ? 'var(--brand-primary)' : muted ? '#747d88' : '#26313d',
                  fontWeight: isSelected || isToday ? (navigable ? 600 : 700) : 400,
                  fontSize: 12,
                  height: navigable ? 26 : 28,
                  width: navigable ? 26 : 28,
                  maxWidth: '100%',
                  cursor: 'pointer',
                  padding: hasEvent ? '0 0 3px' : 0,
                  position: 'relative',
                }}
              >
                {date.date()}
                {hasEvent && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 2,
                      transform: 'translateX(-50%)',
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: isSelected ? 'var(--brand-on-primary)' : 'var(--brand-primary)',
                    }}
                  />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
