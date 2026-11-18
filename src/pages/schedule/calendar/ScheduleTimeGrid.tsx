import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  rows: StaffScheduleDate[]
  /** Vị trí template trong danh mục — dùng chọn màu ổn định khi tên ca không nhận dạng được. */
  templateIndex: number
}

/** Độ cao cố định 1 giờ trên lưới; card và vạch giờ luôn dùng chung tỉ lệ này. */
const HOUR_HEIGHT = 48
const minutesToPixels = (minutes: number) => (minutes / 60) * HOUR_HEIGHT
const hourGridBackground = `repeating-linear-gradient(to bottom, var(--brand-border-soft) 0 1px, transparent 1px ${HOUR_HEIGHT}px)`
/** Số giờ lùi/dãn thêm ở 2 đầu trục quanh min/max giờ của các ca (cho thoáng). */
const AXIS_PAD_HOURS = 1
const FALLBACK_AXIS = { start: 7 * 60, end: 22 * 60 }

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

interface Props {
  view: CalendarView
  /** 1 ngày (view ngày) hoặc 7 ngày (view tuần) từ thứ 2; view tháng lấy tháng của days[0]. */
  days: Dayjs[]
  blocks: ScheduleBlock[]
  loading: boolean
  notesByDate: Map<string, string[]>
  canManage: boolean
  staffById: Map<string, ScheduleStaff>
  selectedKey: string | null
  onSelectBlock: (block: ScheduleBlock) => void
  /** Nội dung popup chi tiết hiển thị khi khối ca được chọn (Popover bám theo khối). */
  renderBlockDetail?: (block: ScheduleBlock) => ReactNode
  onCloseBlockDetail?: () => void
  /** Nội dung popup tạo nhanh khi click vùng trống của một ngày. */
  renderQuickCreate?: (payload: { date: Dayjs; close: () => void }) => ReactNode
  /** Click tiêu đề ngày / số ngày trong view tháng → chuyển sang view ngày. */
  onSelectDay: (date: Dayjs) => void
  onEditNote: (date: Dayjs, notes: string[]) => void
}

function mondayOf(date: Dayjs): Dayjs {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
}

/** Ca không tìm thấy template (đã bị xóa) — hiển thị mặc định 08:00–10:00. */
const FALLBACK_BLOCK_MIN = { start: 8 * 60, end: 10 * 60 }

function blockStartMinute(block: ScheduleBlock): number {
  return block.template ? timeToMinutes(block.template.start_time) : FALLBACK_BLOCK_MIN.start
}

function blockEndMinute(block: ScheduleBlock): number {
  return block.template ? timeToMinutes(block.template.end_time) : FALLBACK_BLOCK_MIN.end
}

/** Chia các block đè nhau thành lane ngang (giống Google Calendar). */
function layoutLanes(blocks: ScheduleBlock[]): Array<{ block: ScheduleBlock; lane: number; lanes: number }> {
  const sorted = [...blocks].sort((a, b) => blockStartMinute(a) - blockStartMinute(b))
  const result: Array<{ block: ScheduleBlock; lane: number; lanes: number }> = []
  let laneEnds: number[] = []
  let group: Array<{ block: ScheduleBlock; lane: number }> = []
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
        {hasHiddenNote && <Tooltip title="KTV chưa hiện tên có ghi chú · Bấm để xem"><FileTextOutlined style={{ flexShrink: 0, fontSize: 13 }} /></Tooltip>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', flexShrink: 0, columnGap: 6, fontSize: 12, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ color: '#414b56' }}>{timeLabel}</span>
        {template && <span style={{ color: '#59636e' }}>{formatDuration(template.start_time, template.end_time)}</span>}
      </div>
        <ul ref={staffListRef} aria-label="Kỹ thuật viên trong ca" style={{ margin: '9px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: STAFF_ROW_GAP, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {staffOfBlock.slice(0, visibleCount).map((person) => (
            <li key={`${block.key}-staff-${person.rowId}`} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                <StaffAvatar name={person.name} avatar={person.avatar} color={style.text} />
                {person.note && (
                  <Tooltip title={<><strong>{person.name}</strong><div style={{ whiteSpace: 'pre-wrap' }}>{person.note}</div></>}>
                    <span role="img" aria-label={`${person.name} có ghi chú`} style={{ position: 'absolute', insetInlineEnd: -1, bottom: -1, width: 9, height: 9, boxSizing: 'border-box', border: '2px solid #fff', borderRadius: '50%', background: style.text }} />
                  </Tooltip>
                )}
              </span>
              <Typography.Text ellipsis={{ tooltip: person.name }} style={{ flex: '1 1 auto', minWidth: 0, fontSize: 14, lineHeight: 1.3, color: '#303842' }}>{person.name}</Typography.Text>
            </li>
          ))}
          {visibleCount > 0 && staffOfBlock.length > visibleCount && (
            <li style={{ paddingInlineStart: visibleCount ? STAFF_AVATAR_SIZE + 7 : 0, fontSize: 12, lineHeight: `${STAFF_AVATAR_SIZE}px`, color: '#59636e' }}>
              +{staffOfBlock.length - visibleCount} KTV khác
            </li>
          )}
        </ul>
      <div style={{ flexShrink: 0, marginTop: 4, textAlign: 'center', fontSize: 12, color: '#59636e' }}>
        {staffOfBlock.length} KTV
      </div>
    </div>
  )
}

export default function ScheduleTimeGrid({
  view, days, blocks, loading, notesByDate, canManage, staffById, selectedKey,
  onSelectBlock, onSelectDay, onEditNote,
  renderBlockDetail, onCloseBlockDetail, renderQuickCreate,
}: Props) {
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
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-block-key="${CSS.escape(selectedKey)}"]`)
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
    gridBodyRef.current?.addEventListener('scroll', measure)
    const timers = [200, 600].map((delay) => window.setTimeout(measure, delay))
    return () => {
      window.removeEventListener('resize', measure)
      gridBodyRef.current?.removeEventListener('scroll', measure)
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
    const map = new Map<string, ScheduleBlock[]>()
    for (const block of blocks) {
      const iso = block.date.format('YYYY-MM-DD')
      map.set(iso, [...(map.get(iso) ?? []), block])
    }
    return map
  }, [blocks])

  // Trục giờ lấy MIN giờ bắt đầu và MAX giờ kết thúc của các ca đang hiển thị,
  // dãn thêm 1 giờ mỗi đầu cho thoáng (kiểu Google Calendar tự biết miền giờ).
  const { axisStartMin, axisEndMin } = useMemo(() => {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const block of blocks) {
      min = Math.min(min, blockStartMinute(block))
      max = Math.max(max, blockEndMinute(block))
    }
    if (!Number.isFinite(min)) return { axisStartMin: FALLBACK_AXIS.start, axisEndMin: FALLBACK_AXIS.end }
    const start = Math.max(Math.floor(min / 60) * 60 - AXIS_PAD_HOURS * 60, 0)
    const end = Math.min(Math.ceil(max / 60) * 60 + AXIS_PAD_HOURS * 60, 24 * 60)
    return { axisStartMin: start, axisEndMin: Math.max(end, start + 60) }
  }, [blocks])
  const axisHours = Math.max((axisEndMin - axisStartMin) / 60, 1)
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
    el.scrollTop = todayVisible ? Math.max(nowTop - 120, 0) : 0
  }, [view, loading, days, axisStartMin, now, scrollRange])

  const todayIso = now.format('YYYY-MM-DD')
  const nowTop = minutesToPixels(now.hour() * 60 + now.minute() - axisStartMin)
  const nowLineVisible = nowTop >= 0 && nowTop <= gridHeight

  const gridColumn = view === 'month'
    ? 'repeat(7, minmax(0, 1fr))'
    : `56px repeat(${days.length}, minmax(130px, 1fr))`

  if (loading) {
    return (
      <div style={{ border: '1px solid var(--brand-border-soft)', borderRadius: 12, background: '#fff', minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Đang tải lịch làm việc…" />
      </div>
    )
  }

  // ---------------- View tháng ----------------
  if (view === 'month') {
    const monthStart = days[0].startOf('month')
    const gridStart = mondayOf(monthStart)
    const cells = Array.from({ length: 42 }, (_, index) => gridStart.add(index, 'day'))
    return (
      <div className="no-scrollbar" style={{ position: 'absolute', inset: 0, border: '1px solid var(--brand-border-soft)', borderRadius: 12, background: '#fff', overflow: 'auto', overscrollBehavior: 'contain' }}>
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
                onClick={(event) => setQuickCreate({ date, x: event.clientX, y: event.clientY })}
                style={{
                  minHeight: 104,
                  borderTop: '1px solid var(--brand-border-soft)',
                  borderLeft: '1px solid var(--brand-border-soft)',
                  padding: 6,
                  cursor: 'pointer',
                  background: muted ? 'var(--brand-bg)' : '#fff',
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
                        {template ? `${template.start_time.slice(0, 5)} · ${block.rows.length} KTV` : '—'}
                      </span>
                    </div>
                  )
                })}
                {hiddenCount > 0 && (
                  <Button type="link" size="small" style={{ padding: 0, height: 18, fontSize: 11 }} onClick={(event) => { event.stopPropagation(); onSelectDay(date) }}>
                    +{hiddenCount} ca nữa
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ---------------- View ngày / tuần ----------------
  const cornerNowPill = days.some((date) => date.format('YYYY-MM-DD') === todayIso) && nowLineVisible

  return (
    <>
      <div ref={gridBodyRef} className="no-scrollbar" style={{ position: 'absolute', inset: 0, border: '1px solid var(--brand-border-soft)', borderRadius: 12, background: '#fff', overflow: 'auto', overscrollBehavior: 'contain' }}>
      {/* Header cột ngày — dính trên khung cuộn riêng của lưới (kiểu Google Calendar) */}
      <div data-grid-header style={{ display: 'grid', gridTemplateColumns: gridColumn, position: 'sticky', top: 0, zIndex: 4, background: '#fff', borderBottom: '1px solid var(--brand-border-soft)' }}>
        <div style={{ padding: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {cornerNowPill && (
            <span style={{ background: '#D93025', color: '#fff', fontSize: 10, borderRadius: 4, padding: '1px 4px', fontWeight: 600 }}>
              {now.format('HH:mm')}
            </span>
          )}
        </div>
        {days.map((date) => {
          const iso = date.format('YYYY-MM-DD')
          const isToday = iso === todayIso
          const noteText = (notesByDate.get(iso) ?? []).join(' · ')
          return (
            <div
              key={iso}
              onClick={() => onSelectDay(date)}
              style={{
                padding: '8px 10px 6px', textAlign: 'center', borderLeft: '1px solid var(--brand-border-soft)',
                cursor: 'pointer', userSelect: 'none',
                background: isToday ? 'var(--brand-tint)' : '#fff',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? 'var(--brand-dark)' : '#6F7071' }}>{WEEKDAY_LABELS[date.day()]}</div>
              <div style={{ fontSize: 15, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--brand-dark)' : '#3B3C3D', marginTop: 1 }}>
                {date.format('DD/MM')}
              </div>
              {noteText && (
                <div
                  role={canManage ? 'button' : undefined}
                  onClick={(event) => { if (canManage) { event.stopPropagation(); onEditNote(date, notesByDate.get(iso) ?? []) } }}
                  style={{
                    fontSize: 10, lineHeight: 1.3, color: 'var(--brand-dark)', background: 'rgba(255,255,255,0.85)',
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
          {Array.from({ length: Math.round(axisHours) }, (_, index) => (
            <span key={index} style={{ position: 'absolute', top: minutesToPixels(index * 60), transform: index === 0 ? undefined : 'translateY(-50%)', right: 8, fontSize: 10, color: '#9AA0A6' }}>
              {String(Math.floor(axisStartMin / 60) + index).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {days.map((date) => {
          const iso = date.format('YYYY-MM-DD')
          const isToday = iso === todayIso
          const dayLayout = layoutLanes(blocksByIso.get(iso) ?? [])
          return (
            <div
              key={iso}
              onClick={(event) => setQuickCreate({ date, x: event.clientX, y: event.clientY })}
              style={{ position: 'relative', height: gridHeight, borderLeft: '1px solid var(--brand-border-soft)', backgroundColor: isToday ? 'var(--brand-tint)' : '#fff', backgroundImage: hourGridBackground, cursor: 'pointer' }}
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
                const top = minutesToPixels(startMin - axisStartMin)
                const bottom = minutesToPixels(endMin - axisStartMin)
                // Đo chiều cao giữa hai mốc quy đổi giống nhau để ca 17–21 và mọi thời lượng khác cùng đúng tỉ lệ.
                const height = Math.max(bottom - top, 0)
                const laneWidth = 100 / (1 + (lanes - 1) * LANE_STEP)
                const laneStart = lane * laneWidth * LANE_STEP
                const isSelected = selectedKey === block.key
                const width = isSelected && lanes > 1 ? Math.max(laneWidth, 84) : laneWidth
                const left = Math.min(laneStart, 100 - width)
                return (
                  <div
                    key={block.key}
                    data-block-key={block.key}
                    className="hover:z-[5] focus-within:z-[5]"
                    style={{
                      position: 'absolute',
                      top,
                      height,
                      left: `calc(${left}% + 4px)`,
                      width: `max(1px, calc(${width}% - 8px))`,
                      zIndex: isSelected ? 6 : undefined,
                      boxSizing: 'border-box',
                    }}
                  >
                    <ShiftBlockCard
                      block={block}
                      selected={isSelected}
                      staffById={staffById}
                      onSelect={() => {
                        setQuickCreate(null)
                        onSelectBlock(block)
                      }}
                    />
                  </div>
                )
              })}
              {dayLayout.map(({ block, lane, lanes }) => {
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

      {/* Popup chi tiết ca — nổi cạnh khối được chọn, bám theo cuộn */}
      {selectedKey && detailPos && (() => {
        const detailBlock = blocks.find((item) => item.key === selectedKey)
        if (!detailBlock) return null
        return createPortal(
          <div
            data-detail-popover
            style={{ position: 'fixed', zIndex: 1041, left: detailPos.x, top: detailPos.y, width: 330 }}
          >
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid var(--brand-border-soft)', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', maxHeight: `calc(100dvh - ${detailPos.y + 12}px)`, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              {renderBlockDetail?.(detailBlock)}
            </div>
          </div>,
          document.body,
        )
      })()}
      </div>
    </>
  )
}
