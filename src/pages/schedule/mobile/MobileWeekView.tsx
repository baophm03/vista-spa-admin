import { useState, type ReactNode } from 'react'
import type { Dayjs } from 'dayjs'
import { Button, DatePicker, Input, Popover } from 'antd'
import { CalendarOutlined, DeleteOutlined, ExclamationCircleOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import type { ScheduleStaff } from '../types'
import { staffLabel } from '../types'
import { MobileEmptyCard, MobileErrorCard, MobileLoadingCards } from './MobileStates'
import { mondayOf } from './weekDates'

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

/** 1 dòng ca trên card KTV — `row` là bản ghi lịch gốc để sửa/xóa. */
export interface MobileShift<Row> {
  key: string
  row: Row
  name: string
  time: string
  note?: string | null
  onLeave?: boolean
}

export interface MobileStaffDay<Row> {
  person: ScheduleStaff
  shifts: MobileShift<Row>[]
}

/** Kết quả xóa: 'conflict' = đã chuyển sang modal lịch hẹn bị ảnh hưởng. */
export type MobileDeleteResult = 'deleted' | 'conflict' | 'failed'

interface Props<Row> {
  weekStart: Dayjs
  selectedDay: Dayjs
  onSelectDay: (date: Dayjs) => void
  onWeekChange: (monday: Dayjs) => void
  showCreate: boolean
  createDisabled: boolean
  onCreate: () => void
  loading: boolean
  error?: string
  onRetry: () => void
  /** Card KTV có ca trong ngày đang chọn */
  staffDays: MobileStaffDay<Row>[]
  /** Tuần đang xem không có ca nào */
  weekEmpty: boolean
  /** KTV tự xem lịch mình: card trống vẫn hiện tên (Figma "Ngày không có ca") */
  ownStaff?: ScheduleStaff | null
  canEditRow: (row: Row) => boolean
  onEditRow: (row: Row) => void
  onDeleteRow: (row: Row, reason: string) => Promise<MobileDeleteResult>
}

/** Lịch tuần dạng chọn ngày (Figma: Mobile/Tablet · Lịch làm việc · "Hiển thị danh sách lịch kiểu khác"). */
export default function MobileWeekView<Row>({
  weekStart, selectedDay, onSelectDay, onWeekChange, showCreate, createDisabled, onCreate,
  loading, error, onRetry, staffDays, weekEmpty, ownStaff, canEditRow, onEditRow, onDeleteRow,
}: Props<Row>) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const days = Array.from({ length: 7 }, (_, index) => weekStart.add(index, 'day'))
  const weekEnd = weekStart.add(6, 'day')

  return (
    <div className="schedule-mobile-week mobile-only gap-4 pb-4">
      {/* Khoảng tuần + Đăng ký ca: mobile 2 hàng, tablet 1 hàng */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_158px]">
        <div className="relative grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2">
          <Button
            aria-label="Tuần trước"
            icon={<LeftOutlined />}
            className="h-11! w-11! rounded-xl! border-[#E9DDF0]! text-[var(--brand-primary)]!"
            onClick={() => onWeekChange(weekStart.subtract(1, 'week'))}
          />
          <div className="min-w-0">
            <Button
              aria-label={`Chọn tuần, đang xem ${weekStart.format('DD/MM')} đến ${weekEnd.format('DD/MM')}`}
              aria-expanded={pickerOpen}
              className={`h-11! w-full! rounded-xl! font-medium! text-[var(--brand-primary)]! ${pickerOpen ? 'border-[var(--brand-primary)]!' : 'border-[#E9DDF0]!'}`}
              icon={<CalendarOutlined />}
              onClick={() => setPickerOpen((open) => !open)}
            >
              {weekStart.format('DD/MM')} → {weekEnd.format('DD/MM')}
            </Button>
          </div>
          <Button
            aria-label="Tuần sau"
            icon={<RightOutlined />}
            className="h-11! w-11! rounded-xl! border-[#E9DDF0]! text-[var(--brand-primary)]!"
            onClick={() => onWeekChange(weekStart.add(1, 'week'))}
          />
          {/* Ô nhập ẩn phủ cả hàng điều hướng — chỉ để neo bảng chọn tuần ngay bên dưới */}
          <DatePicker
            picker="week"
            showWeek={false}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            value={weekStart}
            allowClear={false}
            inputReadOnly
            placement="bottomLeft"
            classNames={{ popup: 'schedule-week-picker' }}
            className="pointer-events-none! absolute! inset-0! opacity-0!"
            onChange={(date) => {
              if (date) onWeekChange(mondayOf(date))
              setPickerOpen(false)
            }}
          />
        </div>
        {showCreate && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={createDisabled}
            className="h-11! w-full! rounded-xl! font-semibold! shadow-none!"
            onClick={onCreate}
          >
            Đăng ký ca
          </Button>
        )}
      </div>

      {/* Chọn ngày trong tuần */}
      <div role="tablist" aria-label="Chọn ngày trong tuần" className="grid grid-cols-7 gap-1 md:gap-1">
        {days.map((date) => {
          const selected = date.isSame(selectedDay, 'day')
          return (
            <button
              key={date.format('YYYY-MM-DD')}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${WEEKDAY_LABELS[date.day()]} ${date.format('DD/MM')}`}
              onClick={() => onSelectDay(date)}
              className={`flex h-[58px] min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${selected
                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                : 'border-[#E9DDF0] bg-white text-[#292331] hover:border-[var(--brand-primary)]'}`}
            >
              <span className={`text-[11px] leading-none ${selected ? 'text-white/90' : 'text-[#6F7071]'}`}>{WEEKDAY_LABELS[date.day()]}</span>
              <span className="text-[19px] leading-6 font-semibold tabular-nums">{date.format('D')}</span>
            </button>
          )
        })}
      </div>

      {loading ? (
        <MobileLoadingCards />
      ) : error ? (
        <MobileErrorCard title="Không tải được lịch làm việc" onRetry={onRetry} />
      ) : weekEmpty && !ownStaff ? (
        <MobileEmptyCard title="Chưa có lịch làm việc" />
      ) : staffDays.length === 0 ? (
        <StaffDayCard
          title={ownStaff ? staffLabel(ownStaff) : 'Chưa có ca'}
          date={selectedDay}
          emptyText="Chưa có ca trong ngày này"
        />
      ) : (
        <div className="grid gap-3">
          {staffDays.map(({ person, shifts }) => (
            <StaffDayCard key={person.id} title={staffLabel(person)} date={selectedDay}>
              {shifts.map((shift) => (
                <ShiftRow
                  key={shift.key}
                  shift={shift}
                  editable={canEditRow(shift.row)}
                  onEdit={() => onEditRow(shift.row)}
                  onDelete={(reason) => onDeleteRow(shift.row, reason)}
                />
              ))}
            </StaffDayCard>
          ))}
        </div>
      )}
    </div>
  )
}

function StaffDayCard({ title, date, emptyText, children }: { title: string; date: Dayjs; emptyText?: string; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E9DDF0] bg-white px-3 pt-3 pb-3">
      <header className="flex items-center justify-between gap-2 border-b border-[#E9DDF0] pb-2">
        <h3 className="m-0 min-w-0 truncate text-[15px] font-semibold text-[#292331]">{title}</h3>
        <span className="shrink-0 rounded-md bg-[#F3E8F7] px-2 py-0.5 text-xs font-medium text-[var(--brand-primary)] tabular-nums">{date.format('DD/MM')}</span>
      </header>
      {emptyText ? (
        <p className="m-0 pt-3 text-[13px] text-[#6F7071]">{emptyText}</p>
      ) : (
        <div className="grid gap-2 pt-2">{children}</div>
      )}
    </section>
  )
}

function ShiftRow<Row>({ shift, editable, onEdit, onDelete }: {
  shift: MobileShift<Row>
  editable: boolean
  onEdit: () => void
  onDelete: (reason: string) => Promise<MobileDeleteResult>
}) {
  const label = `${shift.name} ${shift.time}`
  const content = (
    <>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {shift.onLeave && <span className="shrink-0 text-xs font-semibold text-amber-800">(P) Nghỉ phép</span>}
    </>
  )
  return (
    <div className="flex items-stretch gap-2">
      <div className="grid min-w-0 flex-1 gap-1">
        {editable ? (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Sửa ${label}`}
            className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#EAF0FB] px-3 text-left text-[14px] text-[#25407A] focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            {content}
          </button>
        ) : (
          <div className="flex min-h-11 items-center gap-2 rounded-xl bg-[#EAF0FB] px-3 text-[14px] text-[#25407A]">{content}</div>
        )}
        {!!shift.note?.trim() && <p className="m-0 px-1 text-xs break-words whitespace-pre-wrap text-[#6F7071]">{shift.note}</p>}
      </div>
      {editable && <DeleteShiftButton label={label} onDelete={onDelete} />}
    </div>
  )
}

/** Nút thùng rác + popover "Xóa lịch ngày này?" (Figma: Xác nhận / Đang kiểm tra / Lỗi). */
function DeleteShiftButton({ label, onDelete }: { label: string; onDelete: (reason: string) => Promise<MobileDeleteResult> }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'failed'>('idle')

  const close = () => {
    setOpen(false)
    setReason('')
    setStatus('idle')
  }
  const confirm = async () => {
    const trimmed = reason.trim()
    if (!trimmed) return
    setStatus('checking')
    const result = await onDelete(trimmed)
    if (result === 'failed') setStatus('failed')
    else close()
  }

  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : status !== 'checking' && close())}
      content={
        <div className="grid w-[min(300px,calc(100vw-48px))] gap-2">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#292331]">
            <ExclamationCircleOutlined aria-hidden className="text-[#D97706]" />
            Xóa lịch ngày này?
          </div>
          {status === 'checking' && <p className="m-0 text-[13px] text-[#6F7071]">Đang kiểm tra lịch trước khi xóa…</p>}
          {status === 'failed' && <p role="alert" className="m-0 text-[13px] text-[#B42318]">Không xóa được lịch. Vui lòng thử lại.</p>}
          <label className="grid gap-1 text-xs font-semibold text-[#292331]">
            Lý do xóa <span className="sr-only">(bắt buộc)</span>
            <Input.TextArea
              aria-label="Lý do xóa"
              placeholder="Nhập lý do để xác nhận"
              rows={2}
              maxLength={500}
              value={reason}
              disabled={status === 'checking'}
              onChange={(event) => setReason(event.target.value)}
              style={{ resize: 'none' }}
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button className="h-11! rounded-xl!" disabled={status === 'checking'} onClick={close}>Hủy</Button>
            <Button
              type="primary"
              className="h-11! rounded-xl! font-semibold!"
              loading={status === 'checking'}
              disabled={!reason.trim()}
              onClick={() => void confirm()}
            >
              {status === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra và xóa'}
            </Button>
          </div>
        </div>
      }
    >
      <Button
        danger
        aria-label={`Xóa ${label}`}
        icon={<DeleteOutlined />}
        className="h-11! w-11! shrink-0 self-start rounded-xl! border-0! bg-[#FDECEC]!"
      />
    </Popover>
  )
}
