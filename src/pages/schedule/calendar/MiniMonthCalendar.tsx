import dayjs, { type Dayjs } from 'dayjs'

const WEEKDAY_MINI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function mondayOf(date: Dayjs): Dayjs {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
}

interface Props {
  /** Ngày đang được chọn trên lịch chính (highlight viền). */
  value: Dayjs
  onSelect: (date: Dayjs) => void
  /** Các ngày có ca làm — hiển thị chấm nhỏ dưới số ngày. */
  eventDates?: Set<string>
}

/** Lịch tháng thu nhỏ trong bảng điều khiển bên trái. */
export default function MiniMonthCalendar({ value, onSelect, eventDates }: Props) {
  const month = value.startOf('month')
  const gridStart = mondayOf(month)
  const cells = Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'))
  const todayIso = dayjs().format('YYYY-MM-DD')
  const selectedIso = value.format('YYYY-MM-DD')

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', textAlign: 'center', marginBottom: 6, borderBottom: '1px solid var(--brand-border-soft)' }}>
        {WEEKDAY_MINI.map((label) => (
          <span key={label} style={{ fontSize: 11, fontWeight: 600, color: label === 'T7' || label === 'CN' ? 'var(--brand-primary)' : '#616973', padding: '4px 0 7px' }}>{label}</span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: 2, justifyItems: 'center' }}>
        {cells.map((date) => {
          const iso = date.format('YYYY-MM-DD')
          const muted = !date.isSame(month, 'month')
          const isToday = iso === todayIso
          const isSelected = iso === selectedIso
          const isWeekend = date.day() === 0 || date.day() === 6
          const hasEvent = eventDates?.has(iso) ?? false
          return (
            <button
              key={iso}
              type="button"
              aria-label={`${date.format('DD/MM/YYYY')}${hasEvent ? ', có ca làm' : ''}`}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onSelect(date)}
              style={{
                border: `1px solid ${isToday && !isSelected ? 'var(--brand-primary)' : 'transparent'}`,
                background: isSelected
                  ? 'var(--brand-primary)'
                  : 'transparent',
                borderRadius: 8,
                color: isSelected ? 'var(--brand-on-primary)' : muted ? '#747d88' : isWeekend ? 'var(--brand-primary)' : '#26313d',
                fontWeight: isSelected || isToday ? 700 : 400,
                fontSize: 12,
                height: 29,
                width: 30,
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
          )
        })}
      </div>
    </div>
  )
}
