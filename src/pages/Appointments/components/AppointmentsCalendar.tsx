import { Typography } from 'antd'
import dayjs from 'dayjs'
import type { AppointmentStatus } from '@/api/models/appointmentStatus'
import { STATUS_META } from './constants'
import type { AppointmentRow } from './constants'

const CALENDAR_START_HOUR = 7
const CALENDAR_END_HOUR = 22
const CALENDAR_HOURS = Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => CALENDAR_START_HOUR + index)

const CALENDAR_STATUS_STYLE: Record<AppointmentStatus, { border: string; background: string }> = {
  pending: { border: '#5bbfba', background: '#f0fffd' },
  approved: { border: '#52a66b', background: '#f1fbf3' },
  in_progress: { border: '#4587c7', background: '#eff7ff' },
  completed: { border: '#8bbf69', background: '#f5fbef' },
  cancelled: { border: '#a6adb1', background: '#f4f5f6' },
  rejected: { border: '#d75a5a', background: '#fff2f0' },
  no_show: { border: '#d46b08', background: '#fff7e6' },
}

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function AppointmentCalendarCard({ row, branchName, onClick }: { row: AppointmentRow; branchName: (id?: string) => string; onClick: () => void }) {
  const status = row.status as AppointmentStatus
  const style = CALENDAR_STATUS_STYLE[status] ?? CALENDAR_STATUS_STYLE.pending
  const branch = branchName(row.branch_id)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick() } }}
      style={{ borderLeft: `3px solid ${style.border}`, borderRadius: 7, background: style.background, padding: '8px 10px', marginBottom: 6, lineHeight: 1.4, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}
    >
      <Typography.Text strong style={{ display: 'block', alignSelf: 'flex-start', marginBottom: 2, fontSize: 11, color: style.border }}>
        {STATUS_META[status]?.label || status}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
        {dayjs(row.appt_date).format('DD/MM/YYYY')} {row.start_time?.slice(0, 5) || '—'}
      </Typography.Text>
      <Typography.Text strong style={{ display: 'block', fontSize: 12 }}>
        {row.customer_profile?.full_name || 'Khách hàng'}
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
        {row.customer_profile?.phone || 'Chưa có số điện thoại'}
      </Typography.Text>
      {branch !== '—' && (
        <Typography.Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
          {branch}
        </Typography.Text>
      )}
    </div>
  )
}

interface AppointmentsCalendarProps {
  rows: AppointmentRow[]
  loading: boolean
  view: 'day' | 'week'
  /** Các ngày hiển thị trên lưới: 1 ngày (view 'day') hoặc 7 ngày (view 'week') */
  days: dayjs.Dayjs[]
  branchName: (id?: string) => string
  onSelect: (row: AppointmentRow) => void
}

export default function AppointmentsCalendar({ rows, loading, view, days, branchName, onSelect }: AppointmentsCalendarProps) {
  if (loading) {
    return (
      <div style={{ overflowX: 'auto', border: '1px solid var(--brand-border-soft, #ECEFEA)', borderRadius: 12, background: '#fff' }}>
        <div style={{ padding: 32, textAlign: 'center' }}>Đang tải lịch hẹn…</div>
      </div>
    )
  }

  const start = days[0]

  if (view === 'day') {
    return (
      <div style={{ overflowX: 'auto', border: '1px solid var(--brand-border-soft, #ECEFEA)', borderRadius: 12, background: '#fff' }}>
        <div style={{ minWidth: 420 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px minmax(190px, 1fr)', position: 'sticky', top: 0, zIndex: 2, background: 'var(--brand-primary)', borderBottom: '1px solid var(--brand-dark)', color: 'var(--brand-on-primary)' }}>
            <div style={{ padding: 12, fontWeight: 600 }}>{start.format('DD/MM')}</div>
            <div style={{ padding: 12, borderLeft: '1px solid rgba(255, 255, 255, 0.14)', fontWeight: 600 }}>Lịch hẹn</div>
          </div>
          {CALENDAR_HOURS.map((hour) => (
            <div key={hour} style={{ display: 'grid', gridTemplateColumns: '80px minmax(190px, 1fr)', minHeight: 82, borderBottom: '1px solid #edf1f2' }}>
              <div style={{ padding: '8px 12px', color: '#849197', fontSize: 12 }}>{String(hour).padStart(2, '0')}:00</div>
              <div style={{ borderLeft: '1px solid #edf1f2', padding: 5 }}>
                {rows.filter((row) => dayjs(row.appt_date).isSame(start, 'day') && Number(row.start_time?.slice(0, 2)) === hour).map((row) => (
                  <AppointmentCalendarCard key={row.id} row={row} branchName={branchName} onClick={() => onSelect(row)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--brand-border-soft, #ECEFEA)', borderRadius: 12, background: '#fff' }}>
      <div style={{ minWidth: 1160 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(150px, 1fr))', position: 'sticky', top: 0, zIndex: 2, background: 'var(--brand-primary)', borderBottom: '1px solid var(--brand-dark)', color: 'var(--brand-on-primary)' }}>
          <div style={{ padding: 12, fontWeight: 600 }}>Giờ</div>
          {days.map((date) => <div key={date.format('YYYY-MM-DD')} style={{ padding: 12, borderLeft: '1px solid rgba(255, 255, 255, 0.14)', fontWeight: 600 }}>{WEEKDAY_LABELS[date.day()]} {date.format('DD/MM')}</div>)}
        </div>
        {CALENDAR_HOURS.map((hour) => (
          <div key={hour} style={{ display: 'grid', gridTemplateColumns: '80px repeat(7, minmax(150px, 1fr))', minHeight: 92, borderBottom: '1px solid #edf1f2' }}>
            <div style={{ padding: '8px 12px', color: '#849197', fontSize: 12 }}>{String(hour).padStart(2, '0')}:00</div>
            {days.map((date) => (
              <div key={date.format('YYYY-MM-DD')} style={{ borderLeft: '1px solid #edf1f2', padding: 5 }}>
                {rows.filter((row) => dayjs(row.appt_date).isSame(date, 'day') && Number(row.start_time?.slice(0, 2)) === hour).map((row) => (
                  <AppointmentCalendarCard key={row.id} row={row} branchName={branchName} onClick={() => onSelect(row)} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
