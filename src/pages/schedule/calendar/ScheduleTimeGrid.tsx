import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button, Spin, Tooltip, Typography } from 'antd'
import { EditOutlined, FileTextOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import type { ScheduleStaff, ShiftTemplate, StaffScheduleDate } from '../types'
import { staffLabel } from '../types'
import { formatDuration, shiftStyle, timeToMinutes } from './shiftStyles'
import type { CalendarView } from './CalendarToolbar'

export interface ScheduleBlock {
  /** `${iso}|${templateId}` — dùng làm key chọn block. */
  key: string
  date: Dayjs
  template: ShiftTemplate | null
  /** Các dòng lịch (KTV) của cùng ngày + cùng ca. */
  rows: (StaffScheduleDate & { onLeave?: boolean })[]
  /** Vị trí template trong danh mục — dùng chọn màu ổn định khi tên ca không nhận dạng được. */
  templateIndex: number
}

export interface CalendarEvent {
  key: string
  date: Dayjs
  startMinute: number | null
  endMinute: number | null
}

type GridBlock = ScheduleBlock | CalendarEvent

/** Độ cao cố định 1 giờ trên lưới; card và vạch giờ luôn dùng chung tỉ lệ này. */
const HOUR_HEIGHT = 48
/** Số giờ lùi/dãn thêm ở 2 đầu trục quanh min/max giờ của các ca (cho thoáng). */
const AXIS_PAD_HOURS = 1
const FALLBACK_AXIS = { start: 7 * 60, end: 22 * 60 }

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

interface Props<Block extends GridBlock> {
  view: CalendarView
  /** 1 ngày (view ngày) hoặc 7 ngày (view tuần) từ thứ 2; view tháng lấy tháng của days[0]. */
  days: Dayjs[]
  blocks: Block[]
  loading: boolean
  notesByDate: Map<string, string[]>
  canManage: boolean
  staffById: Map<string, ScheduleStaff>
  selectedKey: string | null
  onSelectBlock: (block: Block) => void
  /** Nội dung popup chi tiết hiển thị khi khối ca được chọn (Popover bám theo khối). */
  renderBlockDetail?: (block: Block) => ReactNode
  onCloseBlockDetail?: () => void
  /** Nội dung popup tạo nhanh khi click vùng trống của một ngày. */
  renderQuickCreate?: (payload: { date: Dayjs; close: () => void }) => ReactNode
  /** Click tiêu đề ngày / số ngày trong view tháng → chuyển sang view ngày. */
  onSelectDay: (date: Dayjs) => void
  onEditNote: (date: Dayjs, notes: string[]) => void
  renderEvent?: (block: Block, options: { compact: boolean; height: number; onSelect: () => void }) => ReactNode
  renderDayAction?: (date: Dayjs) => ReactNode
  onCreateDay?: (date: Dayjs) => void
  moreLabel?: string
  loadingLabel?: string
  hourHeight?: number
  hourRange?: { start: number; end: number }
}

function mondayOf(date: Dayjs): Dayjs {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
}

/** Ca không tìm thấy template (đã bị xóa) — hiển thị mặc định 08:00–10:00. */
const FALLBACK_BLOCK_MIN = { start: 8 * 60, end: 10 * 60 }

function blockStartMinute(block: GridBlock): number {
  if ('startMinute' in block) return block.startMinute ?? 1440
  return block.template ? timeToMinutes(block.template.start_time) : FALLBACK_BLOCK_MIN.start
}

function blockEndMinute(block: GridBlock): number {
  if ('endMinute' in block) return block.endMinute ?? 1440
  return block.template ? timeToMinutes(block.template.end_time) : FALLBACK_BLOCK_MIN.end
}

/** Chia các block đè nhau thành lane ngang (giống Google Calendar). */
function layoutLanes<Block extends GridBlock>(blocks: Block[]): Array<{ block: Block; lane: number; lanes: number }> {
  const sorted = [...blocks].sort((a, b) => blockStartMinute(a) - blockStartMinute(b))
  const result: Array<{ block: Block; lane: number; lanes: number }> = []
  let laneEnds: number[] = []
  let group: Array<{ block: Block; lane: number }> = []
  let groupEnd = -Infinity
  const finishGroup = () => {
    for (const entry of group) result.push({ ...entry, lanes: laneEnds.length })
    group = []
    laneEnds = []
  }
  for (const block of sorted) {
    const startMin = blockStartMinute(block)
    const endMin = blockEndMinute(block)
    if (startMin >= groupEnd) {
      finishGroup()
      groupEnd = endMin
    }
    const freeLane = laneEnds.findIndex((end) => end <= startMin)
    const lane = freeLane === -1 ? laneEnds.length : freeLane
    laneEnds[lane] = endMin
    groupEnd = Math.max(groupEnd, endMin)
    group.push({ block, lane })
  }
  finishGroup()
  return result
}

const STAFF_AVATAR_SIZE = 22
const STAFF_ROW_GAP = 4
const LANE_STEP = 0.72


function StaffAvatar({ name, avatar, color }: { name: string; avatar?: string | null; color: string }) {
  const initials = name.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0)).join('').toUpperCase()
  return (
    <Tooltip title={name}>
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          style={{ width: STAFF_AVATAR_SIZE, height: STAFF_AVATAR_SIZE, boxSizing: 'border-box', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1px solid #fff' }}
        />
      ) : (
        <span
          aria-hidden
          style={{ width: STAFF_AVATAR_SIZE, height: STAFF_AVATAR_SIZE, borderRadius: '50%', background: '#fff', color, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          {initials}
        </span>
      )}
    </Tooltip>
  )
}

function ShiftBlockCard({
  block, selected, staffById, onSelect,
}: {
  block: ScheduleBlock
  selected: boolean
  staffById: Map<string, ScheduleStaff>
  onSelect: () => void
}) {
  const style = shiftStyle(block.template, block.templateIndex)
  const template = block.template
  const timeLabel = template ? `${template.start_time.slice(0, 5)} – ${template.end_time.slice(0, 5)}` : '—'
  const staffListRef = useRef<HTMLUListElement>(null)
  const [staffSlots, setStaffSlots] = useState(0)
  useEffect(() => {
    const list = staffListRef.current
    if (!list) return
    const update = () => setStaffSlots(Math.floor((list.clientHeight + STAFF_ROW_GAP) / (STAFF_AVATAR_SIZE + STAFF_ROW_GAP)))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])
  const hasNote = block.rows.some((row) => row.note?.trim())
  const staffOfBlock = block.rows.map((row) => ({
    rowId: row.id,
    name: staffLabel(staffById.get(row.staff_id)),
    onLeave: row.onLeave,
    avatar: staffById.get(row.staff_id)?.zalo_avatar ?? null,
    note: row.note?.trim(),
  }))
  const visibleCount = staffOfBlock.length <= staffSlots ? staffOfBlock.length : Math.max(0, staffSlots - 1)
  const hasHiddenNote = staffOfBlock.slice(visibleCount).some((person) => person.note)
  return (
    <div
      role="button"
      aria-label={hasNote ? `${template?.name ?? 'Ca làm việc'} ${timeLabel}. Bấm để xem ghi chú` : undefined}
      tabIndex={0}
      onMouseDown={(event) => {
        // Focus bằng chuột có thể cuộn cả card cao vào vùng nhìn thấy.
        if (event.button === 0) event.preventDefault()
      }}
      onClick={(event) => { event.stopPropagation(); onSelect() }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        background: style.bg,
        border: '1px solid var(--brand-border-soft)',
        // Giữ đầu card bo nhẹ nhưng để cạnh cuối vuông, chạm đúng mốc kết thúc ca.
        borderRadius: '5px 5px 0 0',
        padding: '8px 10px',
        color: style.text,
        lineHeight: 1.4,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: selected ? `inset 0 0 0 1px ${style.border}` : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, flexShrink: 0 }}>
        <Typography.Text strong ellipsis style={{ minWidth: 0, fontSize: 14.5, lineHeight: 1.35, color: style.text }}>{template?.name ?? 'Ca làm việc'}</Typography.Text>
        {hasHiddenNote && <Tooltip title="Nhân viên chưa hiện tên có ghi chú · Bấm để xem"><FileTextOutlined style={{ flexShrink: 0, fontSize: 13 }} /></Tooltip>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', flexShrink: 0, columnGap: 6, fontSize: 12, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: '#414b56' }}>{timeLabel}</span>
        {template && <span style={{ color: '#59636e' }}>{formatDuration(template.start_time, template.end_time)}</span>}
      </div>
        <ul ref={staffListRef} aria-label="Nhân viên trong ca" style={{ margin: '9px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: STAFF_ROW_GAP, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {staffOfBlock.slice(0, visibleCount).map((person) => (
            <li key={`${block.key}-staff-${person.rowId}`} style={{ display: 'flex', alignItems: 'center', gap: 5, marginInlineStart: -2, minWidth: 0, flexShrink: 0 }}>
              <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                <StaffAvatar name={person.name} avatar={person.avatar} color={style.text} />
                {person.note && (
                  <Tooltip title={<><strong>{person.name}</strong><div style={{ whiteSpace: 'pre-wrap' }}>{person.note}</div></>}>
                    <span role="img" aria-label={`${person.name} có ghi chú`} style={{ position: 'absolute', insetInlineEnd: -1, bottom: -1, width: 9, height: 9, boxSizing: 'border-box', border: '2px solid #fff', borderRadius: '50%', background: style.text }} />
                  </Tooltip>
                )}
              </span>
              <span title={person.name} className="min-w-0 flex-1 truncate text-xs leading-[1.3] text-[#303842]">{person.name}</span>
              {person.onLeave && <span className="shrink-0 text-[10px] font-semibold" title="Nghỉ phép" aria-label="Nghỉ phép">(P)</span>}
            </li>
          ))}
          {visibleCount > 0 && staffOfBlock.length > visibleCount && (
            <li style={{ paddingInlineStart: visibleCount ? STAFF_AVATAR_SIZE + 7 : 0, fontSize: 12, lineHeight: `${STAFF_AVATAR_SIZE}px`, color: '#59636e' }}>
              +{staffOfBlock.length - visibleCount} nhân viên khác
            </li>
          )}
        </ul>
      <div style={{ flexShrink: 0, marginTop: 4, textAlign: 'center', fontSize: 12, color: '#59636e' }}>
        {staffOfBlock.length} nhân viên
      </div>
    </div>
  )
}

export default function ScheduleTimeGrid<Block extends GridBlock>({
  view, days, blocks, loading, notesByDate, canManage, staffById, selectedKey,
  onSelectBlock, onSelectDay, onEditNote,
  renderBlockDetail, onCloseBlockDetail, renderQuickCreate,
  renderEvent, renderDayAction, onCreateDay, moreLabel = 'ca nữa', loadingLabel = 'Đang tải lịch làm việc…', hourHeight = HOUR_HEIGHT, hourRange,
}: Props<Block>) {
  const appointmentGrid = Boolean(renderEvent)
  const minutesToPixels = useCallback((minutes: number) => minutes * hourHeight / 60, [hourHeight])
  const ruleColor = appointmentGrid ? '#edeaf0' : 'var(--brand-border-soft)'
  const todayBackground = appointmentGrid ? 'color-mix(in srgb, var(--brand-primary) 3%, white)' : 'var(--brand-tint)'
  const hourGridBackground = `repeating-linear-gradient(to bottom, ${ruleColor} 0 1px, transparent 1px ${minutesToPixels(60)}px)`
  const frameStyle = { border: appointmentGrid ? undefined : '1px solid var(--brand-border-soft)', borderRadius: appointmentGrid ? 0 : 12 }
  const [now, setNow] = useState<Dayjs>(() => dayjs())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(dayjs()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const gridBodyRef = useRef<HTMLDivElement | null>(null)
  const initializedScrollRange = useRef<string | null>(null)
  /** Popup tạo nhanh hiện khi click vùng trống — neo theo tọa độ click. */
  const [quickCreate, setQuickCreate] = useState<{ date: Dayjs; x: number; y: number } | null>(null)
  useEffect(() => {
    setQuickCreate(null)
  }, [view, days])
  /** Popup chi tiết: định vị cạnh khối ca được chọn, bám theo khi cuộn lưới. */
  const [detailPos, setDetailPos] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => {
    if (!selectedKey) { setDetailPos(null); return }
    const gridBody = gridBodyRef.current
    const measure = () => {
      const el = gridBody?.querySelector<HTMLElement>(`[data-block-key="${CSS.escape(selectedKey)}"]`)
      if (!el) { setDetailPos(null); return }
      const rect = el.getBoundingClientRect()
      const width = 330
      let x = rect.right + 8
      if (x + width > window.innerWidth - 12) x = Math.max(rect.left - width - 8, 8)
      const y = Math.min(Math.max(rect.top, 70), Math.max(window.innerHeight - 380, 70))
      setDetailPos((current) => (current && Math.abs(current.x - x) < 1 && Math.abs(current.y - y) < 1 ? current : { x, y }))
    }
    measure()
    window.addEventListener('resize', measure)
    gridBody?.addEventListener('scroll', measure)
    const timers = [200, 600].map((delay) => window.setTimeout(measure, delay))
    return () => {
      window.removeEventListener('resize', measure)
      gridBody?.removeEventListener('scroll', measure)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [selectedKey, view, days, blocks])
  // Click ra ngoài popup (kể cả click chọn khối khác) → đóng popup chi tiết
  useEffect(() => {
    if (!selectedKey) return
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-detail-popover]')) return
      onCloseBlockDetail?.()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [selectedKey, onCloseBlockDetail])
  // Popup tạo nhanh: click ngoài (trừ portal của antd) → đóng
  useEffect(() => {
    if (!quickCreate) return
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-quick-popover], .ant-select-dropdown')) return
      setQuickCreate(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [quickCreate])

  const blocksByIso = useMemo(() => {
    const map = new Map<string, Block[]>()
    for (const block of blocks) {
      const iso = block.date.format('YYYY-MM-DD')
      map.set(iso, [...(map.get(iso) ?? []), block])
    }
    return map
  }, [blocks])

  // Trục giờ lấy MIN giờ bắt đầu và MAX giờ kết thúc của các ca đang hiển thị,
  // dãn thêm 1 giờ mỗi đầu cho thoáng (kiểu Google Calendar tự biết miền giờ).
  const { axisStartMin, axisEndMin } = useMemo(() => {
    if (hourRange) return { axisStartMin: hourRange.start, axisEndMin: hourRange.end }
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const block of blocks) {
      if ('startMinute' in block && block.startMinute === null) continue
      min = Math.min(min, blockStartMinute(block))
      max = Math.max(max, blockEndMinute(block))
    }
    if (!Number.isFinite(min)) return { axisStartMin: FALLBACK_AXIS.start, axisEndMin: FALLBACK_AXIS.end }
    const start = Math.max(Math.floor(min / 60) * 60 - AXIS_PAD_HOURS * 60, 0)
    const end = Math.min(Math.ceil(max / 60) * 60 + AXIS_PAD_HOURS * 60, 24 * 60)
    if (appointmentGrid) return { axisStartMin: Math.min(start, FALLBACK_AXIS.start), axisEndMin: Math.max(end, FALLBACK_AXIS.end) }
    return { axisStartMin: start, axisEndMin: Math.max(end, start + 60) }
  }, [blocks, appointmentGrid, hourRange])
  const firstHour = Math.ceil(axisStartMin / 60) * 60
  const timeTicks = [axisStartMin]
  for (let minute = firstHour; minute < axisEndMin; minute += 60) {
    if (minute === axisStartMin) continue
    if (hourRange && (minutesToPixels(minute - axisStartMin) < 22 || minutesToPixels(axisEndMin - minute) < 22)) continue
    timeTicks.push(minute)
  }
  if (hourRange) timeTicks.push(axisEndMin)
  const gridHeight = minutesToPixels(axisEndMin - axisStartMin)
  const scrollRange = `${view}:${days[0]?.format('YYYY-MM-DD')}`

  // Tự cuộn tới giờ hiện tại nếu hôm nay nằm trong phạm vi, ngược lại về đầu trục
  useEffect(() => {
    if (view === 'month') {
      initializedScrollRange.current = null
      return
    }
    if (loading || initializedScrollRange.current === scrollRange) return
    const el = gridBodyRef.current
    if (!el) return
    initializedScrollRange.current = scrollRange
    const nowMinutes = now.hour() * 60 + now.minute()
    const nowTop = minutesToPixels(nowMinutes - axisStartMin)
    const todayVisible = days.some((date) => date.format('YYYY-MM-DD') === now.format('YYYY-MM-DD'))
    if (appointmentGrid && view === 'week') {
      const first = blocks.reduce((earliest, block) => Math.min(earliest, blockStartMinute(block)), 1440)
      el.scrollTop = first < 1440 ? Math.max(minutesToPixels(first - axisStartMin) - 56, 0) : 0
      return
    }
    el.scrollTop = todayVisible ? Math.max(nowTop - 120, 0) : 0
  }, [view, loading, days, axisStartMin, now, scrollRange, minutesToPixels, appointmentGrid, blocks])

  const todayIso = now.format('YYYY-MM-DD')
  const nowTop = minutesToPixels(now.hour() * 60 + now.minute() - axisStartMin)
  const nowLineVisible = nowTop >= 0 && nowTop <= gridHeight

  const gridColumn = view === 'month'
    ? renderEvent ? 'repeat(7, minmax(92px, 1fr))' : 'repeat(7, minmax(0, 1fr))'
    : `${appointmentGrid ? 44 : 56}px repeat(${days.length}, minmax(${renderEvent ? 92 : 130}px, 1fr))`

  if (loading) {
    return (
      <div style={{ ...frameStyle, background: '#fff', minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div role="status" className="flex flex-col items-center gap-2 text-sm text-neutral-600">
          <Spin />
          {loadingLabel}
        </div>
      </div>
    )
  }

  // ---------------- View tháng ----------------
  const detailPopup = renderBlockDetail && selectedKey && detailPos && (() => {
        const detailBlock = blocks.find((item) => item.key === selectedKey)
        if (!detailBlock) return null
        return createPortal(
          <div
            data-detail-popover
            style={{ position: 'fixed', zIndex: 1041, left: detailPos.x, top: detailPos.y, width: 330 }}
          >
            <div style={{ background: '#fff', borderRadius: 8, border: '1px solid var(--brand-border-soft)', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', maxHeight: `calc(100dvh - ${detailPos.y + 12}px)`, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {renderBlockDetail?.(detailBlock)}
            </div>
          </div>,
          document.body,
        )
      })()

  if (view === 'month') {
    const monthStart = days[0].startOf('month')
    const gridStart = mondayOf(monthStart)
    const cells = Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'))
    return (
      <div ref={gridBodyRef} className="no-scrollbar" style={{ ...frameStyle, position: 'absolute', inset: 0, background: '#fff', overflow: 'auto', overscrollBehavior: 'contain' }}>
        <div style={{ display: 'grid', gridTemplateColumns: gridColumn, borderBottom: '1px solid var(--brand-border-soft)' }}>
          {WEEKDAY_LABELS.slice(1).concat(WEEKDAY_LABELS[0]).map((label) => (
            <div key={label} style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, color: '#6F7071', textAlign: 'center' }}>{label}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: gridColumn }}>
          {cells.map((date) => {
            const iso = date.format('YYYY-MM-DD')
            const muted = !date.isSame(days[0], 'month')
            const dayBlocks = [...(blocksByIso.get(iso) ?? [])].sort((a, b) => blockStartMinute(a) - blockStartMinute(b))
            const visible = dayBlocks.slice(0, 3)
            const hiddenCount = dayBlocks.length - visible.length
            const noteText = (notesByDate.get(iso) ?? []).join(' · ')
            return (
              <div
                key={iso}
                onClick={(event) => {
                  if (onCreateDay) onCreateDay(date)
                  else if (renderQuickCreate) setQuickCreate({ date, x: event.clientX, y: event.clientY })
                }}
                style={{
                  minHeight: 104,
                  borderTop: `1px solid ${ruleColor}`,
                  borderLeft: `1px solid ${ruleColor}`,
                  padding: appointmentGrid ? 8 : 6,
                  cursor: onCreateDay || renderQuickCreate ? 'pointer' : undefined,
                  background: muted ? (appointmentGrid ? '#faf8f6' : 'var(--brand-bg)') : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => { event.stopPropagation(); onSelectDay(date) }}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onSelectDay(date) } }}
                    style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: iso === todayIso ? 700 : 400,
                      background: iso === todayIso ? 'var(--brand-primary)' : 'transparent',
                      color: iso === todayIso ? 'var(--brand-on-primary)' : muted ? '#B6B7B8' : '#3B3C3D',
                      cursor: 'pointer',
                    }}
                  >
                    {date.date()}
                  </span>
                  {canManage && noteText && (
                    <Tooltip title={noteText}>
                      <Button
                        aria-label={`Sửa ghi chú ngày ${date.format('DD/MM')}`}
                        type="text" size="small"
                        icon={<EditOutlined style={{ fontSize: 11 }} />}
                        onClick={(event) => { event.stopPropagation(); onEditNote(date, notesByDate.get(iso) ?? []) }}
                      />
                    </Tooltip>
                  )}
                </div>
                {noteText && (
                  <Typography.Text ellipsis={{ tooltip: noteText }} style={{ fontSize: 10, color: 'var(--brand-dark)', background: 'var(--brand-tint)', borderRadius: 6, padding: '1px 6px', alignSelf: 'flex-start', maxWidth: '100%' }}>
                    {noteText}
                  </Typography.Text>
                )}
                {visible.map((block) => {
                  if (renderEvent) return <div key={block.key} style={{ minWidth: 0 }}>{renderEvent(block, { compact: true, height: 20, onSelect: () => onSelectBlock(block) })}</div>
                  if (!('template' in block)) return null
                  const style = shiftStyle(block.template, block.templateIndex)
                  const template = block.template
                  return (
                    <div
                      key={block.key}
                      data-block-key={block.key}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => { event.stopPropagation(); onSelectBlock(block) }}
                      onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onSelectBlock(block) } }}
                      style={{
                        borderLeft: `2px solid ${style.border}`, borderRadius: 5, background: style.bg, color: style.text,
                        fontSize: 11, lineHeight: 1.3, padding: '1px 5px', cursor: 'pointer', overflow: 'hidden',
                        boxShadow: selectedKey === block.key ? `0 0 0 2px ${style.border}` : undefined,
                      }}
                    >
                      <span style={{ display: 'block', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {template?.name ?? 'Ca làm'}
                      </span>
                      <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.85 }}>
                        {template ? `${template.start_time.slice(0, 5)} · ${block.rows.length} nhân viên` : '—'}
                      </span>
                    </div>
                  )
                })}
                {hiddenCount > 0 && (
                  <Button type="link" size="small" style={{ padding: 0, height: 18, fontSize: 11 }} onClick={(event) => { event.stopPropagation(); onSelectDay(date) }}>
                    +{hiddenCount} {moreLabel}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        {detailPopup}
      </div>
    )
  }

  // ---------------- View ngày / tuần ----------------
  const cornerNowPill = days.some((date) => date.format('YYYY-MM-DD') === todayIso) && nowLineVisible

  return (
    <>
      <div ref={gridBodyRef} className={appointmentGrid ? '[scrollbar-color:#d7d0ca_transparent] [scrollbar-width:thin]' : 'no-scrollbar'} style={{ ...frameStyle, position: 'absolute', inset: 0, background: '#fff', overflow: 'auto', overscrollBehavior: 'contain' }}>
      {/* Header cột ngày — dính trên khung cuộn riêng của lưới (kiểu Google Calendar) */}
      <div data-grid-header style={{ display: 'grid', gridTemplateColumns: gridColumn, position: 'sticky', top: 0, zIndex: 4, background: '#fff', borderBottom: `1px solid ${ruleColor}` }}>
        <div style={{ padding: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {cornerNowPill && (
            <span style={{ background: '#D93025', color: '#fff', fontSize: 11, borderRadius: 4, padding: '1px 4px', fontWeight: 600 }}>
              {now.format('HH:mm')}
            </span>
          )}
        </div>
        {days.map((date) => {
          const iso = date.format('YYYY-MM-DD')
          const isToday = iso === todayIso
          const noteText = (notesByDate.get(iso) ?? []).join(' · ')
          const appointmentCount = blocksByIso.get(iso)?.length ?? 0
          return (
            <div
              key={iso}
              className={appointmentGrid ? 'group/day-header' : undefined}
              onClick={() => onSelectDay(date)}
              style={{
                padding: appointmentGrid ? '4px 22px 4px 4px' : '8px 10px 6px', textAlign: 'center', borderLeft: `1px solid ${ruleColor}`, position: 'relative',
                cursor: 'pointer', userSelect: 'none',
                background: isToday ? todayBackground : '#fff',
              }}
            >
              {renderEvent ? (
                <button type="button" className="flex min-h-8 w-full cursor-pointer flex-wrap items-center justify-center gap-x-1.5 rounded-md border-0 bg-transparent px-1 text-inherit focus-visible:outline-2" aria-label={`Xem ngày ${date.format('DD/MM/YYYY')}, ${appointmentCount} lịch hẹn`} aria-current={isToday ? 'date' : undefined}>
                  <span className="block text-[12px] font-medium leading-4 text-stone-500">{WEEKDAY_LABELS[date.day()]}</span>
                  <span className={`block rounded-md px-1.5 py-0.5 text-[13px] font-semibold tabular-nums ${isToday ? 'bg-[var(--brand-primary)] text-[var(--brand-on-primary)]' : 'text-stone-800'}`}>{date.format('DD/MM')}</span>
                  {appointmentCount > 0 && (
                    <span aria-hidden className="rounded bg-[var(--brand-tint)] px-1 text-[10px] font-semibold tabular-nums text-[var(--brand-dark)]">{appointmentCount}</span>
                  )}
                </button>
              ) : (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? 'var(--brand-dark)' : '#6F7071' }}>{WEEKDAY_LABELS[date.day()]}</div>
                  <div style={{ fontSize: 15, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--brand-dark)' : '#3B3C3D', marginTop: 1 }}>
                    {date.format('DD/MM')}
                  </div>
                </>
              )}
              {renderDayAction?.(date)}
              {noteText && (
                <div
                  role={canManage ? 'button' : undefined}
                  onClick={(event) => { if (canManage) { event.stopPropagation(); onEditNote(date, notesByDate.get(iso) ?? []) } }}
                  style={{
                    fontSize: appointmentGrid ? 11 : 10, lineHeight: 1.3, color: 'var(--brand-dark)', background: 'rgba(255,255,255,0.85)',
                    borderRadius: 6, padding: '1px 6px', marginTop: 4, cursor: canManage ? 'pointer' : 'default',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >
                  {noteText}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Thân lưới giờ */}
      <div style={{ display: 'grid', gridTemplateColumns: gridColumn, position: 'relative' }}>
        {/* Trục giờ */}
        <div style={{ position: 'relative', height: gridHeight, zIndex: 1, background: '#fff' }}>
          {timeTicks.map((minute) => (
            <span key={minute} style={{ position: 'absolute', top: minutesToPixels(minute - axisStartMin), transform: minute === axisStartMin ? undefined : minute === axisEndMin ? 'translateY(-100%)' : 'translateY(-50%)', right: appointmentGrid ? 5 : 8, fontSize: appointmentGrid ? 11 : 10, color: appointmentGrid ? '#626973' : '#9AA0A6' }}>
              {String(Math.floor(minute / 60)).padStart(2, '0')}:{String(minute % 60).padStart(2, '0')}
            </span>
          ))}
        </div>

        {days.map((date) => {
          const iso = date.format('YYYY-MM-DD')
          const isToday = iso === todayIso
          const dayBlocks = blocksByIso.get(iso) ?? []
          const dayLayout = layoutLanes(dayBlocks.filter((block) =>
            (!('startMinute' in block) || block.startMinute !== null) &&
            (!hourRange || (blockStartMinute(block) < axisEndMin && blockEndMinute(block) > axisStartMin)),
          ))
          return (
            <div
              key={iso}
              onClick={(event) => {
                if (onCreateDay) onCreateDay(date)
                else if (renderQuickCreate) setQuickCreate({ date, x: event.clientX, y: event.clientY })
              }}
              style={{ position: 'relative', height: gridHeight, borderLeft: `1px solid ${ruleColor}`, backgroundColor: isToday ? todayBackground : '#fff', backgroundImage: hourGridBackground, backgroundPositionY: minutesToPixels(firstHour - axisStartMin), cursor: onCreateDay || renderQuickCreate ? 'pointer' : undefined }}
            >
              {isToday && nowLineVisible && (
                <div aria-hidden style={{ position: 'absolute', top: nowTop, left: 0, right: 0, zIndex: 2, pointerEvents: 'none' }}>
                  <span style={{ position: 'absolute', left: -1, top: -3, width: 7, height: 7, borderRadius: '50%', background: '#D93025' }} />
                  <div style={{ borderTop: '2px solid #D93025' }} />
                </div>
              )}
              {dayLayout.map(({ block, lane, lanes }) => {
                const startMin = blockStartMinute(block)
                const endMin = blockEndMinute(block)
                const top = minutesToPixels(Math.max(startMin, axisStartMin) - axisStartMin)
                const bottom = minutesToPixels(Math.min(endMin, axisEndMin) - axisStartMin)
                // Đo chiều cao giữa hai mốc quy đổi giống nhau để ca 17–21 và mọi thời lượng khác cùng đúng tỉ lệ.
                const height = Math.max(bottom - top, 0)
                const laneStep = renderEvent ? 0.58 : LANE_STEP
                const laneWidth = 100 / (1 + (lanes - 1) * laneStep)
                const laneStart = lane * laneWidth * laneStep
                const isSelected = selectedKey === block.key
                const width = isSelected && lanes > 1 ? Math.max(laneWidth, 84) : laneWidth
                const left = Math.min(laneStart, 100 - width)
                return (
                  <div
                    key={block.key}
                    data-block-key={block.key}
                    className={renderEvent
                      ? 'hover:inset-x-1! hover:w-auto! hover:z-[35]! has-[:focus-visible]:inset-x-1! has-[:focus-visible]:w-auto! has-[:focus-visible]:z-[34]!'
                      : 'hover:left-1! hover:w-[calc(100%_-_8px)]! hover:z-[25]! focus-visible:z-[20]'}
                    style={{
                      position: 'absolute',
                      top,
                      height,
                      left: `calc(${left}% + 4px)`,
                      width: `max(1px, calc(${width}% - 8px))`,
                      zIndex: isSelected ? (renderEvent ? 30 : 6) : undefined,
                      isolation: renderEvent ? 'isolate' : undefined,
                      borderRadius: renderEvent ? 6 : undefined,
                      boxShadow: renderEvent && isSelected && lanes > 1
                        ? '0 4px 14px rgba(15, 23, 42, 0.22)'
                        : undefined,
                      boxSizing: 'border-box',
                    }}
                  >
                    {renderEvent ? renderEvent(block, { compact: false, height, onSelect: () => onSelectBlock(block) }) : 'template' in block && <ShiftBlockCard
                      block={block}
                      selected={isSelected}
                      staffById={staffById}
                      onSelect={() => {
                        setQuickCreate(null)
                        onSelectBlock(block)
                      }}
                    />}
                  </div>
                )
              })}
              {!renderEvent && dayLayout.map(({ block, lane, lanes }) => {
                const endMin = blockEndMinute(block)
                const hasNextBlockInLane = dayLayout.some((next) =>
                  next.lane === lane && next.lanes === lanes && blockStartMinute(next.block) === endMin,
                )
                if (!hasNextBlockInLane) return null

                const laneWidth = 100 / (1 + (lanes - 1) * LANE_STEP)
                const boundaryY = minutesToPixels(endMin - axisStartMin)
                return (
                  <div
                    key={`${block.key}-separator`}
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: boundaryY - 2,
                      height: 4,
                      left: `calc(${lane * laneWidth * LANE_STEP}% + 4px)`,
                      width: `max(1px, calc(${laneWidth}% - 8px))`,
                      background: isToday ? 'var(--brand-tint)' : '#fff',
                      zIndex: 3,
                      pointerEvents: 'none',
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
      {renderEvent && days.some((date) => blocksByIso.get(date.format('YYYY-MM-DD'))?.some((block) => 'startMinute' in block && block.startMinute === null)) && (
        <div style={{ display: 'grid', gridTemplateColumns: gridColumn, borderTop: '1px solid var(--brand-border-soft)' }}>
          <div className="p-1 text-xs text-neutral-600">Chưa rõ giờ</div>
          {days.map((date) => (
            <div key={date.format('YYYY-MM-DD')} className="min-w-0 space-y-1 p-1">
              {blocksByIso.get(date.format('YYYY-MM-DD'))?.filter((block) => 'startMinute' in block && block.startMinute === null).map((block) => (
                <div key={block.key}>{renderEvent(block, { compact: true, height: 20, onSelect: () => onSelectBlock(block) })}</div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Popup tạo nhanh — nổi tại vị trí click, đóng khi click ra ngoài */}
      {quickCreate && !selectedKey && createPortal(
        <div
          data-quick-popover
          style={{
            position: 'fixed',
            zIndex: 1041,
            width: 'min(320px, calc(100vw - 16px))',
            maxHeight: 'calc(100dvh - 16px)',
            overflowY: 'auto',
            left: Math.min(Math.max(quickCreate.x, 8), window.innerWidth - 336),
            top: Math.max(8, Math.min(quickCreate.y, window.innerHeight - 360)),
          }}
        >
          {renderQuickCreate?.({ date: quickCreate.date, close: () => setQuickCreate(null) })}
        </div>,
        document.body,
      )}

      {detailPopup}
      </div>
    </>
  )
}
