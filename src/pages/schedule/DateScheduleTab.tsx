import { useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { Alert, Button, Form, Grid, Input, Modal, Select, Table, Tag, Tooltip, message } from 'antd'
import { DeleteOutlined, MenuFoldOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import type { StaffScheduleDate as StaffScheduleDateRow, ShiftTemplate as ShiftTemplateRow } from './types'
import { deleteStaffScheduleDatesIdAdmin, getGetBranchDateNotesAdminQueryKey, getGetShiftTemplatesAdminQueryKey, getGetStaffScheduleDatesAdminQueryKey, postBranchDateNotesAdmin, postStaffScheduleDatesAdmin, putStaffScheduleDatesIdAdmin, useGetBranchDateNotesAdmin, useGetShiftTemplatesAdmin, useGetStaffScheduleDatesAdmin } from '@/api/endpoints/staff'
import type { SchedulePageData, ScheduleStaff } from './types'
import { staffLabel } from './types'
import DateScheduleFormModal, { toFormDates } from './components/DateScheduleFormModal'
import CalendarToolbar, { type CalendarView } from './calendar/CalendarToolbar'
import { ToolbarSlotContext } from './ToolbarSlotContext'
import MiniMonthCalendar from './calendar/MiniMonthCalendar'
import ShiftFilterPanel from './calendar/ShiftFilterPanel'
import StaffFilterPanel from './calendar/StaffFilterPanel'
import ScheduleTimeGrid, { type ScheduleBlock } from './calendar/ScheduleTimeGrid'
import { ShiftDetailContent } from './calendar/ShiftDetailPanel'
import QuickCreatePopover from './calendar/QuickCreatePopover'

interface Props extends SchedulePageData { loadingShared: boolean }
interface ConflictAppointment { id: string; appt_date: string; start_time: string; customer_profile?: { full_name?: string }; service?: { title?: string } }
type StaffScheduleDateWithStaff = StaffScheduleDateRow & { shift_template?: ShiftTemplateRow | null }
interface DateCellShift {
  key: string
  row: StaffScheduleDateWithStaff
  template?: ShiftTemplateRow | null
  note?: string | null
}
/** 1 card mobile = lịch của 1 KTV trong 1 ngày cụ thể (hoặc dòng "Chưa có lịch" khi trống) */
interface MobileDateRow {
  key: string
  person: ScheduleStaff
  date: Dayjs | null
  shifts: DateCellShift[]
}
/** Ngày đang sửa ghi chú (note theo ngày của cơ sở) */
interface NoteEditTarget {
  date: Dayjs
  branchId?: string
  note: string
}

function mondayOf(date: dayjs.Dayjs) {
  return date.startOf('day').subtract((date.day() + 6) % 7, 'day')
}

const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const shiftLabel = (template?: ShiftTemplateRow | null) =>
  `${template?.name ?? 'Ca'} ${template ? `${template.start_time.slice(0, 5)}–${template.end_time.slice(0, 5)}` : ''}`

export default function DateScheduleTab({ branches, staff, access, loadingShared }: Props) {
  const queryClient = useQueryClient()
  const isMobile = !Grid.useBreakpoint().md
  const isTechSelf = access.isTechnician && !access.isAdmin
  // KTV chỉ được tự đăng ký/sửa/xóa ca của TUẦN KẾ TIẾP — mở mặc định ở tuần kế tiếp
  const nextWeekStart = mondayOf(dayjs()).add(1, 'week')
  // Hạn đăng ký: 23:59 Chủ nhật của tuần hiện tại — sau mốc này KTV không tự sửa lịch tuần kế nữa
  const registrationDeadline = mondayOf(dayjs()).add(6, 'day').endOf('day')
  const registrationOpen = dayjs().isBefore(registrationDeadline)
  const deadlineText = registrationDeadline.format('HH:mm [ngày] DD/MM/YYYY')

  const canManage = access.isAdmin
  const [view, setView] = useState<CalendarView>('week')
  const [anchor, setAnchor] = useState<Dayjs>(() => (isTechSelf ? nextWeekStart : dayjs()))
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [branchFilter, setBranchFilter] = useState<string>()
  const [hiddenStaff, setHiddenStaff] = useState<Set<string>>(() => new Set())
  const [hiddenShifts, setHiddenShifts] = useState<Set<string>>(() => new Set())
  const [selectedBlockKey, setSelectedBlockKey] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<StaffScheduleDateWithStaff | null>(null)
  const [form] = Form.useForm()
  const selectedBranch = Form.useWatch('branch_id', form)
  const ownBranchId = staff.find((person) => person.id === access.currentUserId)?.branch_id

  const weekStart = mondayOf(anchor)
  const viewingNextWeek = weekStart.isSame(nextWeekStart, 'day')
  /** Phạm vi ngày hiển thị theo view hiện tại (đồng thời là phạm vi fetch). */
  const range = useMemo((): [Dayjs, Dayjs] => {
    if (view === 'day') return [anchor.startOf('day'), anchor.startOf('day')]
    if (view === 'month') return [anchor.startOf('month'), anchor.endOf('month')]
    return [weekStart, weekStart.add(6, 'day')]
  }, [view, anchor, weekStart])
  const days = useMemo(() => {
    if (view === 'day') return [range[0]]
    return Array.from({ length: 7 }, (_, index) => range[0].add(index, 'day'))
  }, [view, range])

  const dateParams: Record<string, unknown> = {
    from_date: range[0].format('YYYY-MM-DD'),
    to_date: range[1].format('YYYY-MM-DD'),
  }
  if (canManage && branchFilter) dateParams.branch_id = branchFilter
  const dateSchedulesQuery = useGetStaffScheduleDatesAdmin(dateParams as never)
  const templatesQuery = useGetShiftTemplatesAdmin(branchFilter ? { branch_id: branchFilter } : {})
  // Ghi chú theo ngày của cơ sở (lễ, sự kiện, họp...) — hiển thị ở tiêu đề cột ngày
  const noteParams: Record<string, unknown> = {
    from_date: range[0].format('YYYY-MM-DD'),
    to_date: range[1].format('YYYY-MM-DD'),
  }
  if (canManage && branchFilter) noteParams.branch_id = branchFilter
  const notesQuery = useGetBranchDateNotesAdmin(noteParams as never)
  const [noteEditing, setNoteEditing] = useState<NoteEditTarget | null>(null)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteForm] = Form.useForm()

  const dateRows = (pickData<StaffScheduleDateWithStaff[] | undefined>(dateSchedulesQuery.data) ?? []) as StaffScheduleDateWithStaff[]
  const templates = (pickData<ShiftTemplateRow[] | undefined>(templatesQuery.data) ?? []) as ShiftTemplateRow[]

  // Các ngày có ca làm — dùng cho chấm nhỏ trên mini calendar
  const eventDates = useMemo(() => {
    const dates = new Set<string>()
    for (const row of dateRows) {
      if (row.is_active === false) continue
      dates.add(String(row.work_date).slice(0, 10))
    }
    return dates
  }, [dateRows])
  const dateNotes = (pickData<{ branch_id: string; note_date: string; note: string }[] | undefined>(notesQuery.data) ?? [])
  const notesByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const item of dateNotes) {
      const iso = String(item.note_date).slice(0, 10)
      if (!item.note) continue
      map.set(iso, [...(map.get(iso) ?? []), item.note])
    }
    return map
  }, [dateNotes])
  const error = [
    dateSchedulesQuery.isError ? errorMessage(dateSchedulesQuery.error) : '',
    templatesQuery.isError ? `Danh mục ca: ${errorMessage(templatesQuery.error)}` : '',
    notesQuery.isError ? `Ghi chú ngày: ${errorMessage(notesQuery.error)}` : '',
  ].filter(Boolean).join(' · ')
  const loading = loadingShared || dateSchedulesQuery.isLoading || templatesQuery.isLoading

  // Danh sách KTV hiển thị trong panel lọc: nhân sự theo cơ sở + bất kỳ ai có lịch trong phạm vi
  const filterStaff = useMemo(() => {
    const filtered = staff.filter((person) => !canManage || !branchFilter || person.branch_id === branchFilter)
    const all = new Map(filtered.map((person) => [person.id, person]))
    for (const row of dateRows) {
      if (!all.has(row.staff_id)) all.set(row.staff_id, { id: row.staff_id, branch_id: row.branch_id })
    }
    return [...all.values()]
  }, [staff, dateRows, canManage, branchFilter])

  // Map id → thông tin KTV (dùng cho avatar/tên trên khối ca & panel)
  const staffById = useMemo(() => {
    const map = new Map(staff.map((person) => [person.id, person]))
    for (const row of dateRows) {
      if (!map.has(row.staff_id)) map.set(row.staff_id, { id: row.staff_id, branch_id: row.branch_id })
    }
    return map
  }, [staff, dateRows])

  // Ẩn/hiện KTV hoặc ca bằng checkbox → lọc dòng trước khi group thành khối ca
  const filteredRows = useMemo(
    () => dateRows.filter((row) => {
      if (row.is_active === false) return false
      if (hiddenStaff.has(row.staff_id)) return false
      const templateId = String(row.shift_template_id ?? row.shift_template?.id ?? '')
      return !hiddenShifts.has(templateId)
    }),
    [dateRows, hiddenStaff, hiddenShifts],
  )

  /** Group dòng lịch thành "khối ca" theo (ngày + ca): 1 khối = 1 ca làm với N KTV. */
  const blocks = useMemo<ScheduleBlock[]>(() => {
    const map = new Map<string, ScheduleBlock>()
    for (const row of filteredRows) {
      const iso = String(row.work_date).slice(0, 10)
      const templateId = row.shift_template_id ?? row.shift_template?.id ?? 'none'
      const key = `${iso}|${templateId}`
      const existing = map.get(key)
      if (existing) existing.rows.push(row)
      else {
        map.set(key, {
          key,
          date: dayjs(iso),
          template: templates.find((item) => item.id === templateId) ?? row.shift_template ?? null,
          rows: [row],
          templateIndex: templates.findIndex((item) => item.id === templateId),
        })
      }
    }
    return [...map.values()].sort((a, b) => a.date.valueOf() - b.date.valueOf())
  }, [filteredRows, templates])


  const shiftsForCell = (personId: string, date: Dayjs): DateCellShift[] => {
    const iso = date.format('YYYY-MM-DD')
    return dateRows
      .filter((row) => row.staff_id === personId && String(row.work_date).slice(0, 10) === iso && row.is_active !== false)
      .map((row): DateCellShift => ({
        key: `date-${row.id}`,
        row,
        template: templates.find((item) => item.id === row.shift_template_id) ?? row.shift_template,
        note: row.note,
      }))
  }

  const rowInNextWeek = (row: StaffScheduleDateWithStaff) => {
    const iso = String(row.work_date).slice(0, 10)
    return iso >= nextWeekStart.format('YYYY-MM-DD') && iso <= nextWeekStart.add(6, 'day').format('YYYY-MM-DD')
  }
  const canEditRow = (row: StaffScheduleDateWithStaff) =>
    canManage || (isTechSelf && row.staff_id === access.currentUserId && registrationOpen && rowInNextWeek(row))

  const openForm = (
    row?: StaffScheduleDateWithStaff,
    preset?: { date?: Dayjs; staffId?: string; templateId?: string },
  ) => {
    setEditing(row ?? null)
    const rowStaff = row ? staff.find((person) => person.id === row.staff_id) : undefined
    if (isTechSelf) {
      // KTV tự đăng ký: khóa staff + cơ sở theo hồ sơ của mình
      const staffId = row && row.staff_id === access.currentUserId ? row.staff_id : access.currentUserId
      form.setFieldsValue(row ? {
        staff_id: staffId,
        branch_id: row.branch_id || ownBranchId,
        work_dates: toFormDates(row.work_date),
        shift_template_id: row.shift_template_id,
        note: row.note ?? undefined,
      } : {
        staff_id: staffId,
        branch_id: ownBranchId,
        work_dates: preset?.date ? [preset.date] : undefined,
        shift_template_id: preset?.templateId ? [preset.templateId] : undefined,
        note: undefined,
      })
      setOpen(true)
      return
    }
    const branchId = row?.branch_id || branchFilter || rowStaff?.branch_id || branches[0]?.id
    const staffId = row
      ? (rowStaff?.branch_id === branchId ? row.staff_id : undefined)
      : (preset?.staffId && staff.find((person) => person.id === preset.staffId)?.branch_id === branchId ? preset.staffId : undefined)
    form.setFieldsValue(row ? {
      staff_id: staffId,
      branch_id: branchId,
      work_dates: toFormDates(row.work_date),
      shift_template_id: row.shift_template_id,
      note: row.note ?? undefined,
    } : {
      staff_id: staffId,
      branch_id: branchId,
      work_dates: preset?.date ? [preset.date] : undefined,
      shift_template_id: preset?.templateId ? [preset.templateId] : undefined,
      note: undefined,
    })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (isTechSelf) values.staff_id = access.currentUserId
    const selectedStaff = staff.find((person) => person.id === values.staff_id)
    if (!selectedStaff?.branch_id || selectedStaff.branch_id !== values.branch_id) {
      message.error('KTV chưa được gán vào cơ sở đã chọn. Hãy kiểm tra lại nhân sự trước khi xếp lịch.')
      return
    }
    const dates: string[] = Array.isArray(values.work_dates)
      ? values.work_dates.map((date: Dayjs) => date.format('YYYY-MM-DD'))
      : values.work_dates
        ? [dayjs(values.work_dates).format('YYYY-MM-DD')]
        : []
    setSaving(true)
    try {
      if (editing) {
        await putStaffScheduleDatesIdAdmin(editing.id, {
          work_date: dates[0],
          shift_template_id: values.shift_template_id,
          note: values.note || undefined,
        } as never)
        message.success('Đã cập nhật lịch theo ngày')
      } else {
        const result = await postStaffScheduleDatesAdmin({
          staff_id: values.staff_id,
          branch_id: values.branch_id,
          dates,
          shift_template_ids: values.shift_template_id as string[],
          note: values.note || undefined,
        } as never)
        const counts = (result as { meta?: { created_count?: number; skipped_count?: number } })?.meta
        const created = counts?.created_count ?? 0
        const skipped = counts?.skipped_count ?? 0
        if (!created) message.info('Không có ca mới nào được đăng ký — các ca đã chọn đều có sẵn trong lịch')
        else message.success(`Đã đăng ký ${created} ca theo ngày${skipped ? ` (bỏ qua ${skipped} ca đã có sẵn)` : ''}`)
      }
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: getGetStaffScheduleDatesAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: StaffScheduleDateWithStaff, confirmed = false) => {
    try {
      await deleteStaffScheduleDatesIdAdmin(
        row.id,
        confirmed ? { confirm_future_appointments: 'true' } : undefined,
      )
      message.success('Đã xóa lịch theo ngày. Các lịch hẹn đã đặt được giữ nguyên.')
      void queryClient.invalidateQueries({ queryKey: getGetStaffScheduleDatesAdminQueryKey() })
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { code?: string; details?: Record<string, unknown> } } })?.response?.data
      if (!confirmed && response?.code === 'FUTURE_APPOINTMENTS_EXIST') {
        const affected = (response.details?.affected_appointments ?? []) as ConflictAppointment[]
        Modal.confirm({
          title: `Có ${affected.length} lịch hẹn bị ảnh hưởng`,
          width: 680,
          content: <div>
            <p>Xóa lịch ngày cụ thể chỉ ngừng sinh ca cho ngày này. Các lịch hẹn bên dưới vẫn được giữ nguyên để Admin xử lý riêng.</p>
            <Table<ConflictAppointment>
              rowKey="id" size="small" pagination={false} scroll={{ y: 240 }} dataSource={affected}
              columns={[
                { title: 'Ngày', dataIndex: 'appt_date', render: (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString('vi-VN') },
                { title: 'Giờ', dataIndex: 'start_time', render: (v: string) => v?.slice(0, 5) },
                { title: 'Khách', dataIndex: ['customer_profile', 'full_name'], render: (v) => v || '—' },
                { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (v) => v || '—' },
              ]}
            />
          </div>,
          okText: 'Xác nhận xóa lịch', cancelText: 'Quay lại',
          onOk: () => remove(row, true),
        })
      } else message.error(errorMessage(err))
    }
  }

  /** Xóa cả khối ca (mọi KTV của 1 ca trong 1 ngày). 409 gom chung 1 modal xác nhận. */
  const removeBlock = async (block: ScheduleBlock) => {
    const affected: ConflictAppointment[] = []
    const blockedRows: StaffScheduleDateWithStaff[] = []
    for (const row of block.rows) {
      try {
        await deleteStaffScheduleDatesIdAdmin(row.id)
      } catch (err: unknown) {
        const response = (err as { response?: { data?: { code?: string; details?: Record<string, unknown> } } })?.response?.data
        if (response?.code === 'FUTURE_APPOINTMENTS_EXIST') {
          blockedRows.push(row)
          affected.push(...((response.details?.affected_appointments ?? []) as ConflictAppointment[]))
        } else message.error(errorMessage(err))
      }
    }
    const finish = async () => {
      for (const row of blockedRows) {
        try {
          await deleteStaffScheduleDatesIdAdmin(row.id, { confirm_future_appointments: 'true' })
        } catch (err) {
          message.error(errorMessage(err))
        }
      }
      message.success('Đã xóa ca làm việc. Các lịch hẹn đã đặt được giữ nguyên.')
      void queryClient.invalidateQueries({ queryKey: getGetStaffScheduleDatesAdminQueryKey() })
      setSelectedBlockKey(null)
    }
    if (affected.length) {
      Modal.confirm({
        title: `Có ${affected.length} lịch hẹn bị ảnh hưởng`,
        width: 680,
        content: <div>
          <p>Xóa ca chỉ ngừng sinh ca cho ngày này. Các lịch hẹn bên dưới vẫn được giữ nguyên để Admin xử lý riêng.</p>
          <Table<ConflictAppointment>
            rowKey="id" size="small" pagination={false} scroll={{ y: 240 }} dataSource={affected}
            columns={[
              { title: 'Ngày', dataIndex: 'appt_date', render: (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString('vi-VN') },
              { title: 'Giờ', dataIndex: 'start_time', render: (v: string) => v?.slice(0, 5) },
              { title: 'Khách', dataIndex: ['customer_profile', 'full_name'], render: (v) => v || '—' },
              { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (v) => v || '—' },
            ]}
          />
        </div>,
        okText: 'Xác nhận xóa lịch', cancelText: 'Quay lại',
        onOk: () => finish(),
      })
    } else if (block.rows.length > blockedRows.length) {
      message.success('Đã xóa ca làm việc. Các lịch hẹn đã đặt được giữ nguyên.')
       void queryClient.invalidateQueries({ queryKey: getGetStaffScheduleDatesAdminQueryKey() })
      setSelectedBlockKey(null)
    }
  }

  const refreshShared = () => {
    void dateSchedulesQuery.refetch()
    void queryClient.invalidateQueries({ queryKey: getGetShiftTemplatesAdminQueryKey() })
    void notesQuery.refetch()
  }

  const openNoteForm = (date: Dayjs, currentNotes: string[] = []) => {
    const note = currentNotes.join(' · ')
    setNoteEditing({ date, branchId: branchFilter ?? branches[0]?.id, note })
    noteForm.setFieldsValue({ branch_id: branchFilter ?? branches[0]?.id, note })
  }

  const submitNote = async (noteOverride?: string) => {
    if (!noteEditing) return
    const values = noteOverride !== undefined
      ? { branch_id: noteForm.getFieldValue('branch_id'), note: noteOverride }
      : await noteForm.validateFields()
    if (!values.branch_id) {
      message.error('Chọn cơ sở cho ghi chú')
      return
    }
    setNoteSaving(true)
    try {
      await postBranchDateNotesAdmin({
        branch_id: values.branch_id,
        note_date: noteEditing.date.format('YYYY-MM-DD'),
        note: String(values.note ?? '').trim(),
      } as never)
      message.success(String(values.note ?? '').trim() ? 'Đã lưu ghi chú ngày' : 'Đã xoá ghi chú ngày')
      void queryClient.invalidateQueries({ queryKey: getGetBranchDateNotesAdminQueryKey() })
      setNoteEditing(null)
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setNoteSaving(false)
    }
  }

  const selectBlock = (block: ScheduleBlock) => setSelectedBlockKey(block.key)
  const selectDay = (date: Dayjs) => {
    setAnchor(date)
    setView('day')
    setSelectedBlockKey(null)
  }
  const toggleStaff = (staffId: string) => {
    setHiddenStaff((current) => {
      const next = new Set(current)
      if (next.has(staffId)) next.delete(staffId)
      else next.add(staffId)
      return next
    })
  }
  const toggleShift = (templateId: string) => {
    setHiddenShifts((current) => {
      const next = new Set(current)
      if (next.has(templateId)) next.delete(templateId)
      else next.add(templateId)
      return next
    })
  }
  const toggleAllShifts = (visible: boolean) => setHiddenShifts(visible ? new Set() : new Set(templates.map((t) => t.id)))

  // Nội dung popup chi tiết khi bấm vào khối ca (Popover bám theo khối)
  const renderBlockDetail = (block: ScheduleBlock) => (
    <div style={{ padding: 14 }}>
      <ShiftDetailContent
        block={block}
        staffById={staffById}
        branches={branches}
        canManage={canManage}
        canEditRow={canEditRow}
        onEditRow={(row: StaffScheduleDateWithStaff) => openForm(row)}
        onRemoveRow={(row: StaffScheduleDateWithStaff) => void remove(row)}
        onDuplicate={(duplicated: ScheduleBlock) => {
          const first = duplicated.rows[0]
          openForm(undefined, { staffId: first?.staff_id, templateId: String(duplicated.template?.id ?? first?.shift_template_id ?? '') })
          setSelectedBlockKey(null)
        }}
        onDeleteBlock={(target: ScheduleBlock) => void removeBlock(target)}
        onClose={() => setSelectedBlockKey(null)}
      />
    </div>
  )

  /** Tạo nhanh từ popup: validate cơ sở rồi POST — giữ nguyên luật KTV thuộc cơ sở. */
  const quickSubmit = async (payload: { staffId: string; branchId?: string; templateIds: string[]; note?: string; date: Dayjs }) => {
    const finalStaffId = isTechSelf ? String(access.currentUserId) : payload.staffId
    const person = staff.find((candidate) => candidate.id === finalStaffId)
    const finalBranchId = isTechSelf
      ? (person?.branch_id ?? ownBranchId)
      : (payload.branchId ?? person?.branch_id ?? branchFilter ?? branches[0]?.id)
    if (!finalBranchId) {
      message.error('Chọn cơ sở trước khi tạo ca')
      throw new Error('missing branch')
    }
    if (!person?.branch_id || person.branch_id !== finalBranchId) {
      message.error('KTV chưa được gán vào cơ sở đã chọn. Hãy kiểm tra lại nhân sự trước khi xếp lịch.')
      throw new Error('staff branch mismatch')
    }
    try {
      const result = await postStaffScheduleDatesAdmin({
        staff_id: finalStaffId,
        branch_id: finalBranchId,
        dates: [payload.date.format('YYYY-MM-DD')],
        shift_template_ids: payload.templateIds,
        note: payload.note || undefined,
      } as never)
      const counts = (result as { meta?: { created_count?: number; skipped_count?: number } })?.meta
      const created = counts?.created_count ?? 0
      const skipped = counts?.skipped_count ?? 0
      if (!created) message.info('Không có ca mới nào được đăng ký — các ca đã chọn đều có sẵn trong lịch')
      else message.success(`Đã đăng ký ${created} ca theo ngày${skipped ? ` (bỏ qua ${skipped} ca đã có sẵn)` : ''}`)
      void queryClient.invalidateQueries({ queryKey: getGetStaffScheduleDatesAdminQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
      throw err
    }
  }

  const renderQuickCreate = ({ date, close }: { date: Dayjs; close: () => void }) => (
    <QuickCreatePopover
      date={date}
      staff={staff}
      branches={canManage ? branches : []}
      branchFilter={branchFilter}
      templates={templates}
      isTechSelf={isTechSelf}
      currentUserId={access.currentUserId}
      canManage={canManage}
      onSubmit={(payload) => quickSubmit({ ...payload, date })}
      onMoreOptions={(preset) => {
        close()
        openForm(undefined, { date, ...preset })
      }}
      onClose={close}
    />
  )

  // Toolbar portal lên slot giữa header trang (giữa title và tabs) — 1 hàng như mockup.
  // Slot ref gắn sau commit đầu tiên nên đợi 1 effect để lấy node.
  const toolbarSlotRef = useContext(ToolbarSlotContext)
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    setToolbarSlot(toolbarSlotRef?.current ?? null)
  }, [toolbarSlotRef])

  const showCreate = canManage || isTechSelf
  const createDisabled = isTechSelf && !registrationOpen
  const createLabel = canManage ? 'Tạo ca làm' : 'Đăng ký ca'

  return <div className="flex h-full min-h-0 flex-col">
    {toolbarSlot && createPortal(
      <CalendarToolbar
        view={view}
        onViewChange={(nextView) => { setView(nextView); setSelectedBlockKey(null) }}
        branches={canManage ? branches : []}
        branchFilter={branchFilter}
        onBranchChange={(value) => { setBranchFilter(value); setSelectedBlockKey(null) }}
        onRefresh={refreshShared}
        leftPanelOpen={leftPanelOpen && !isMobile}
        onToggleLeftPanel={() => setLeftPanelOpen((current) => !current)}
      />,
      toolbarSlot,
    )}
    {isTechSelf && viewingNextWeek && !registrationOpen && (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={`Đã hết hạn đăng ký lịch tuần kế tiếp (hạn ${deadlineText}). Liên hệ Admin để thay đổi.`}
      />
    )}
    {isTechSelf && !viewingNextWeek && (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Bạn chỉ được tự đăng ký/sửa/xóa ca cho TUẦN KẾ TIẾP. Ca trong tuần đã bắt đầu muốn thay đổi: dùng tab Xin nghỉ hoặc liên hệ Admin."
      />
    )}
    {!!error && <Alert type="error" showIcon message="Không tải được lịch theo ngày" description={error} action={<Button size="small" onClick={refreshShared}>Thử lại</Button>} style={{ marginBottom: 16 }} />}

    {/* Calendar kiểu Google — desktop trở lên. Chỉ lưới giờ cuộn trong khung, panel trái tự cuộn riêng. */}
    <div className="desktop-only min-h-0! flex-1!">
      <div style={{ display: 'flex', gap: 8, height: '100%' }}>
        {leftPanelOpen && !isMobile && (
          <div style={{
            width: 265,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            border: '1px solid var(--brand-border-soft)',
            borderRadius: 12,
            background: '#fff',
            padding: 12,
            boxSizing: 'border-box',
            minHeight: 0,
            overflowY: 'auto',
          }}>
            {/* Nút tạo ca kiểu Google Calendar — đầu panel trái */}
            {showCreate && (
              <Button
                icon={<PlusOutlined style={{ fontSize: 18, color: '#3B3C3D' }} />}
                disabled={createDisabled}
                onClick={() => openForm()}
                style={{
                  height: 44,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 10,
                  borderRadius: 16,
                  border: '1px solid var(--brand-border-soft)',
                  background: '#fff',
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#3B3C3D',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
                  paddingInline: 16,
                }}
              >
                {createLabel}
              </Button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Tooltip title="Thu bảng điều khiển trái">
                <Button
                  aria-label="Thu bảng điều khiển trái"
                  type="text"
                  size="small"
                  icon={<MenuFoldOutlined style={{ fontSize: 14, color: '#6F7071' }} />}
                  onClick={() => setLeftPanelOpen(false)}
                />
              </Tooltip>
            </div>
            <MiniMonthCalendar
              value={anchor}
              onSelect={(date) => { setAnchor(date); setSelectedBlockKey(null) }}
              eventDates={eventDates}
            />
            <div style={{ borderTop: '1px solid var(--brand-border-soft, #EFE7EC)' }} />
            <ShiftFilterPanel
              templates={templates}
              hidden={hiddenShifts}
              onToggle={toggleShift}
              onToggleAll={toggleAllShifts}
            />
            <div style={{ borderTop: '1px solid var(--brand-border-soft, #EFE7EC)' }} />
            <StaffFilterPanel
              staff={filterStaff}
              hidden={hiddenStaff}
              onToggle={toggleStaff}
            />
          </div>
        )}
        {!leftPanelOpen && !isMobile && (
          // Đã thu gọn: rail dọc với FAB tạo ca + nút mở panel (kiểu Google Calendar)
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {showCreate && (
              <Tooltip title={createDisabled ? `Đã hết hạn đăng ký (hạn ${deadlineText})` : createLabel} placement="right">
                <Button
                  aria-label={createLabel}
                  disabled={createDisabled}
                  onClick={() => openForm()}
                  icon={<PlusOutlined style={{ fontSize: 18, color: '#3B3C3D' }} />}
                  style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: '#fff', border: '1px solid var(--brand-border-soft)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                />
              </Tooltip>
            )}
            <Tooltip title="Mở bảng điều khiển trái (mini calendar + lọc KTV)" placement="right">
              <Button
                aria-label="Mở bảng điều khiển trái"
                type="text"
                icon={<TeamOutlined style={{ fontSize: 16 }} />}
                onClick={() => setLeftPanelOpen(true)}
                style={{ width: 32, height: 40, border: '1px solid var(--brand-border-soft)', borderRadius: 10, background: '#fff', flexShrink: 0 }}
              />
            </Tooltip>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <ScheduleTimeGrid
            view={view}
            days={days}
            blocks={blocks}
            loading={loading}
            notesByDate={notesByDate}
            canManage={canManage}
            staffById={staffById}
            selectedKey={selectedBlockKey}
            onSelectBlock={selectBlock}
            renderBlockDetail={renderBlockDetail}
            onCloseBlockDetail={() => setSelectedBlockKey(null)}
            renderQuickCreate={renderQuickCreate}
            onSelectDay={selectDay}
            onEditNote={openNoteForm}
          />
        </div>
      </div>
    </div>

    {/* Mobile: giữ danh sách card, panel chi tiết chuyển thành Drawer */}
    {dateNotes.length > 0 && (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        className="mobile-only"
        message={<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dateNotes.map((item, index) => (
            <span key={`${item.branch_id}-${item.note_date}-${index}`}>
              {WEEKDAY_LABELS[dayjs(item.note_date).day()]} {dayjs(item.note_date).format('DD/MM')}: {item.note}
            </span>
          ))}
        </div>}
      />
    )}
    <div className="mobile-only">
      <MobileCards<MobileDateRow>
        rows={filterStaff.flatMap((person) => {
          // Mobile luôn hiển thị tuần của anchor bất kể view (day/week/month)
          const mobileDays = Array.from({ length: 7 }, (_, index) => weekStart.add(index, 'day'))
          const dayRows: MobileDateRow[] = mobileDays.map((date) => ({
            key: `${person.id}-${date.format('YYYY-MM-DD')}`,
            person,
            date,
            shifts: shiftsForCell(person.id, date),
          })).filter((item) => item.shifts.length > 0)
          return dayRows.length ? dayRows : [{ key: `${person.id}-empty`, person, date: null, shifts: [] }]
        })}
        rowKey={(item) => item.key}
        loading={loading}
        emptyText={staff.length ? 'Không có KTV trong bộ lọc này' : 'Chưa có danh sách KTV'}
        renderCard={(item) => (
          <>
            <div className="mobile-card-head">
              <div>
                <div className="mobile-card-title">{staffLabel(filterStaff.find((entry) => entry.id === item.person.id))}</div>
                <div className="mobile-card-sub">{item.date ? `Lịch ${WEEKDAY_LABELS[item.date.day()]} ${item.date.format('DD/MM')}` : 'Lịch tuần này'}</div>
              </div>
              {item.shifts.length
                ? <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>{item.shifts.length} ca</Tag>
                : <Tag style={{ marginInlineEnd: 0 }}>Chưa có lịch</Tag>}
            </div>
            <div className="mobile-card-rows">
              {item.shifts.map((shiftItem) => (
                <MobileCardRow
                  key={shiftItem.key}
                  label="Ca"
                  value={shiftLabel(shiftItem.template) + (shiftItem.note ? ` — ${shiftItem.note}` : '')}
                />
              ))}
            </div>
          </>
        )}
      />
    </div>

    <DateScheduleFormModal
      open={open}
      form={form}
      editing={editing ? { id: editing.id, work_date: editing.work_date, shift_template_id: editing.shift_template_id, note: editing.note } : null}
      staff={staff}
      branches={branches}
      branchFilter={branchFilter}
      selectedBranch={selectedBranch}
      staffForSelectedBranch={staff.filter((person) => !!selectedBranch && person.branch_id === selectedBranch)}
      templates={templates}
      lockStaffAndBranch={isTechSelf}
      saving={saving}
      onCancel={() => setOpen(false)}
      onSubmit={() => void submit()}
    />

    <Modal
      title={`Ghi chú ngày ${noteEditing ? `${WEEKDAY_LABELS[noteEditing.date.day()]} ${noteEditing.date.format('DD/MM/YYYY')}` : ''}`}
      open={!!noteEditing}
      onCancel={() => setNoteEditing(null)}
      okText="Lưu ghi chú"
      cancelText="Đóng"
      confirmLoading={noteSaving}
      onOk={() => void submitNote()}
      destroyOnHidden
    >
      <Form form={noteForm} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
          <Select
            disabled={!!branchFilter || branches.length <= 1}
            options={(branchFilter ? branches.filter((branch) => branch.id === branchFilter) : branches).map((branch) => ({ value: branch.id, label: branch.name }))}
          />
        </Form.Item>
        <Form.Item name="note" label="Nội dung ghi chú (để trống = xoá ghi chú)">
          <Input.TextArea rows={3} placeholder="Ví dụ: Lễ 30/4, kho bảo trì, họp đầu tuần 8h…" />
        </Form.Item>
      </Form>
      {noteEditing?.note && (
        <Button danger block icon={<DeleteOutlined />} loading={noteSaving} onClick={() => void submitNote('')}>
          Xoá ghi chú ngày này
        </Button>
      )}
    </Modal>
  </div>
}
