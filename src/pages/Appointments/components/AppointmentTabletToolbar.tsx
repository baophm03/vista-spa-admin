import { Badge, Button, DatePicker, Segmented, Select } from 'antd'
import { CalendarOutlined, FilterOutlined, LeftOutlined, PlusOutlined, RightOutlined, UnorderedListOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import type { CalendarView } from '../../schedule/calendar/CalendarToolbar'

interface Props {
  mode: 'calendar' | 'list'
  view: CalendarView
  date: Dayjs
  periodLabel: string
  /** Số điều kiện đang áp dụng — hiện thành badge trên nút Bộ lọc. */
  activeFilterCount?: number
  onModeChange: (mode: 'calendar' | 'list') => void
  onViewChange: (view: CalendarView) => void
  onDateChange: (date: Dayjs) => void
  onOpenFilters: () => void
  onCreate?: () => void
}

/** Thanh công cụ lịch hẹn cho tablet. Cơ sở và trạng thái nằm trong Bộ lọc
 *  (AppointmentCalendarFilterPanel) để hàng trên chỉ còn chế độ xem + hành động. */
export default function AppointmentTabletToolbar({
  mode, view, date, periodLabel, activeFilterCount = 0,
  onModeChange, onViewChange, onDateChange, onOpenFilters, onCreate,
}: Props) {
  const period = view === 'day' ? 'day' : view === 'week' ? 'week' : 'month'

  return (
    <div className="mb-3 hidden shrink-0 gap-2 md:max-lg:grid">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Select<CalendarView | 'all'>
            className="w-24 shrink-0"
            aria-label="Phạm vi lịch hẹn"
            disabled={mode === 'list'}
            value={mode === 'list' ? 'all' : view}
            options={mode === 'list' ? [{ value: 'all', label: 'Tất cả' }] : [
              { value: 'day', label: 'Ngày' },
              { value: 'week', label: 'Tuần' },
              { value: 'month', label: 'Tháng' },
            ]}
            onChange={(value) => { if (value !== 'all') onViewChange(value) }}
          />
          <Segmented<'calendar' | 'list'>
            className="appointment-tablet-segment"
            aria-label="Kiểu hiển thị lịch hẹn"
            value={mode}
            options={[
              { value: 'calendar', label: 'Lịch', icon: <CalendarOutlined /> },
              { value: 'list', label: 'Danh sách', icon: <UnorderedListOutlined /> },
            ]}
            onChange={onModeChange}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge count={activeFilterCount} size="small">
            <Button icon={<FilterOutlined />} onClick={onOpenFilters}>Bộ lọc</Button>
          </Badge>
          {onCreate && <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>Thêm lịch hẹn</Button>}
        </div>
      </div>
      {mode === 'calendar' && (
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
          <Button aria-label="Kỳ trước" icon={<LeftOutlined />} onClick={() => onDateChange(date.subtract(1, period))} />
          <DatePicker
            aria-label={view === 'week' ? 'Chọn tuần' : view === 'month' ? 'Chọn tháng' : 'Chọn ngày'}
            allowClear={false}
            inputReadOnly
            picker={view === 'day' ? 'date' : view}
            value={date}
            format={() => periodLabel}
            className="min-w-0 [&_input]:text-center! [&_input]:text-[var(--brand-primary)]!"
            onChange={(value) => { if (value) onDateChange(value) }}
          />
          <Button aria-label="Kỳ sau" icon={<RightOutlined />} onClick={() => onDateChange(date.add(1, period))} />
        </div>
      )}
    </div>
  )
}
