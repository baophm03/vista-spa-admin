import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { displayName } from '@/utils/displayName'
import { createPortal } from 'react-dom'
import { useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { Alert, Button, Drawer, Dropdown, Form, Input, Modal, Popover, Select, Space, Table, Tag, message } from 'antd'
import type { MenuProps } from 'antd'
import { CalendarOutlined, DeleteOutlined, DownOutlined, EditOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import ResponsiveTable from '@/components/base/ResponsiveTable'
import type { StaffDayOff, StaffScheduleDate as StaffScheduleDateRow, ShiftTemplate as ShiftTemplateRow } from './types'
import { getGetBranchDateNotesAdminQueryKey, getGetShiftTemplatesAdminQueryKey, getGetStaffScheduleDatesAdminQueryKey, postBranchDateNotesAdmin, postStaffScheduleDatesAdmin, putStaffScheduleDatesIdAdmin, useGetBranchDateNotesAdmin, useGetStaffDaysOffAdmin, useGetShiftTemplatesAdmin, useGetStaffScheduleDatesAdmin } from '@/api/endpoints/staff'
import { customInstance } from '@/api/mutator/custom-instance'
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
import { shiftStyle } from './calendar/shiftStyles'
import QuickCreatePopover from './calendar/QuickCreatePopover'

interface Props extends SchedulePageData { loadingShared: boolean }
interface ConflictAppointment { id: string; appt_date: string; start_time: string; user?: { full_name?: string; zalo_name?: string }; service?: { title?: string } }
type StaffScheduleDateWithStaff = StaffScheduleDateRow & { shift_template?: ShiftTemplateRow | null; onLeave?: boolean }
type ShiftTemplateWithDeletion = ShiftTemplateRow & { is_deleted?: boolean; deleted_at?: string | null }
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
  const isTechSelf = access.isTechnician && !access.isAdmin
  // KTV chỉ được tự đăng ký/sửa/xóa ca của TUẦN KẾ TIẾP — mở mặc định ở tuần kế tiếp
  const nextWeekStart = mondayOf(dayjs()).add(1, 'week')
  // Hạn đăng ký: 23:59 Chủ nhật của tuần hiện tại — sau mốc này KTV không tự sửa lịch tuần kế nữa
  const registrationDeadline = mondayOf(dayjs()).add(6, 'day').endOf('day')
  const registrationOpen = dayjs().isBefore(registrationDeadline)
  const deadlineText = registrationDeadline.format('HH:mm [ngày] DD/MM/YYYY')

  const canManage = access.isAdmin
  const [view, setView] = useState<CalendarView>('week')
  const [showRoster, setShowRoster] = useState(false)
  const [anchor, setAnchor] = useState<Dayjs>(() => (isTechSelf ? nextWeekStart : dayjs()))
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
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

  const weekStart = useMemo(() => mondayOf(anchor), [anchor])
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
  const templatesQuery = useGetShiftTemplatesAdmin({
    ...(branchFilter ? { branch_id: branchFilter } : {}),
    active: 'true',
  })
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

  const daysOffQuery = useGetStaffDaysOffAdmin({
    from_date: range[0].isBefore(weekStart) ? range[0].format('YYYY-MM-DD') : weekStart.format('YYYY-MM-DD'),
    to_date: range[1].isAfter(weekStart.add(6, 'day')) ? range[1].format('YYYY-MM-DD') : weekStart.add(6, 'day').format('YYYY-MM-DD'),
    branch_id: canManage ? branchFilter : undefined,
  })
  const dateRows = useMemo(() => {
    const rows = pickData<StaffScheduleDateWithStaff[] | undefined>(dateSchedulesQuery.data) ?? []
    const payload = pickData<StaffDayOff[] | undefined>(daysOffQuery.data)
    const daysOff = Array.isArray(payload) ? payload : []
    const leaveKeys = new Set(daysOff
      .filter((item) => item.status === 'pending' || item.status === 'approved')
      .map((item) => [item.staff_id, item.off_date.slice(0, 10), item.shift_template_id ?? ''].join('|')))
    return rows.map((row) => {
      const key = [row.staff_id, String(row.work_date).slice(0, 10)].join('|')
      return { ...row, onLeave: leaveKeys.has(key + '|') || leaveKeys.has(key + '|' + row.shift_template_id) }
    })
  }, [dateSchedulesQuery.data, daysOffQuery.data])
  const rawTemplates = (pickData<ShiftTemplateWithDeletion[] | undefined>(templatesQuery.data) ?? []) as ShiftTemplateWithDeletion[]
  const templates = rawTemplates.filter((template) =>
    template.is_active !== false && !template.is_deleted && !template.deleted_at,
  )
  const liveTemplateIds = useMemo(() => new Set(templates.map((template) => template.id)), [templates])
  const liveStaffIds = useMemo(() => new Set(staff.map((person) => person.id)), [staff])

  // Bỏ lịch mồ côi của nhân viên đã khóa/xóa và lịch còn tham chiếu tới ca đã xóa.
  // Khi danh mục ca đang lỗi/chưa tải xong, giữ dữ liệu lịch để tránh làm trống màn hình tạm thời.
  const visibleDateRows = useMemo(() => dateRows.filter((row) => {
    if (row.is_active === false || !liveStaffIds.has(row.staff_id)) return false
    const template = row.shift_template as ShiftTemplateWithDeletion | null | undefined
    if (template?.is_deleted || template?.deleted_at) return false
    const templateId = String(row.shift_template_id ?? template?.id ?? '')
    if (!templateId) return false
    return !templatesQuery.isSuccess || liveTemplateIds.has(templateId)
  }), [dateRows, liveStaffIds, liveTemplateIds, templatesQuery.isSuccess])

  // Các ngày có ca làm — dùng cho chấm nhỏ trên mini calendar
  const eventDates = useMemo(() => {
    const dates = new Set<string>()
    for (const row of visibleDateRows) {
      dates.add(String(row.work_date).slice(0, 10))
    }
    return dates
  }, [visibleDateRows])
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

  // Chỉ lấy nhân sự còn tồn tại trong danh sách KTV; không bổ sung lại nhân viên từ lịch cũ.
  const filterStaff = useMemo(() => {
    return staff.filter((person) => !canManage || !branchFilter || person.branch_id === branchFilter)
  }, [staff, canManage, branchFilter])

  // Map id → thông tin KTV (dùng cho avatar/tên trên khối ca & panel)
  const staffById = useMemo(() => {
    return new Map(staff.map((person) => [person.id, person]))
  }, [staff])

  // Ẩn/hiện KTV hoặc ca bằng checkbox → lọc dòng trước khi group thành khối ca
  const filteredRows = useMemo(
    () => visibleDateRows.filter((row) => {
      if (hiddenStaff.has(row.staff_id)) return false
      const templateId = String(row.shift_template_id ?? row.shift_template?.id ?? '')
      return !hiddenShifts.has(templateId)
    }),
    [visibleDateRows, hiddenStaff, hiddenShifts],
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
    return filteredRows
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
    !row.onLeave && (canManage || (isTechSelf && row.staff_id === access.currentUserId && registrationOpen && rowInNextWeek(row)))

  const openForm = (
    row?: StaffScheduleDateWithStaff,
    preset?: { date?: Dayjs; staffId?: string; templateId?: string; branchId?: string },
  ) => {
    if (row && !canEditRow(row)) return
    setEditing(row ?? null)
    const rowStaff = row ? staff.find((person) => person.id === row.staff_id) : undefined
    const presetStaff = staff.find((person) => person.id === preset?.staffId)
    const branchId = isTechSelf
      ? ownBranchId
      : row?.branch_id || branchFilter || preset?.branchId || rowStaff?.branch_id || presetStaff?.branch_id || branches[0]?.id
    const presetTemplate = templates.find((template) =>
      template.id === preset?.templateId && (!template.branch_id || template.branch_id === branchId),
    )
    const presetShiftIds = presetTemplate ? [presetTemplate.id] : undefined
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
        shift_template_id: presetShiftIds,
        note: undefined,
      })
      setOpen(true)
      return
    }
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
      shift_template_id: presetShiftIds,
      note: undefined,
    })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    if (isTechSelf) values.staff_id = access.currentUserId
    const selectedStaff = staff.find((person) => person.id === values.staff_id)
    if (!selectedStaff?.branch_id || selectedStaff.branch_id !== values.branch_id) {
      message.error('Nhân viên chưa được gán vào cơ sở đã chọn. Hãy kiểm tra lại nhân sự trước khi xếp lịch.')
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

  const deleteSchedule = (id: string, reason: string, confirmed = false) =>
    customInstance({
      url: `/staff-schedule-dates/${encodeURIComponent(id)}/admin`,
      method: 'DELETE',
      data: { reason, confirm_future_appointments: confirmed },
    })

  const confirmDeleteReason = (title: string, onConfirm: (reason: string) => Promise<void>) => {
    let reason = ''
    const dialog = Modal.confirm({
      title,
      width: 440,
      centered: true,
      icon: <DeleteOutlined style={{ color: '#cf1322' }} />,
      content: (
        <label style={{ display: 'block', padding: '8px 0 20px' }}>
          <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Lý do xóa <span style={{ color: '#cf1322' }}>*</span></span>
          <Input.TextArea
          aria-label="Lý do xóa"
          placeholder="Nhập lý do để xác nhận"
          rows={3}
          maxLength={500}
          showCount
          style={{ resize: 'none' }}
          onChange={(event) => {
            reason = event.target.value.trim()
            dialog.update({ okButtonProps: { danger: true, disabled: !reason } })
          }}
          />
        </label>
      ),
      okText: title.startsWith('Gỡ') ? 'Gỡ nhân viên' : 'Xóa ca',
      cancelText: 'Hủy',
      okButtonProps: { danger: true, disabled: true },
      onOk: () => reason ? onConfirm(reason) : Promise.reject(),
    })
  }

  const remove = async (row: StaffScheduleDateWithStaff, reason: string, confirmed = false) => {
    try {
      await deleteSchedule(row.id, reason, confirmed)
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
            <ResponsiveTable<ConflictAppointment>
              rowKey="id" size="small" pagination={false} scroll={{ y: 240 }} dataSource={affected}
              columns={[
                { title: 'Ngày', dataIndex: 'appt_date', render: (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString('vi-VN') },
                { title: 'Giờ', dataIndex: 'start_time', render: (v: string) => v?.slice(0, 5) },
                { title: 'Khách', dataIndex: ['user', 'full_name'], render: (_: unknown, row: ConflictAppointment) => displayName(row.user) },
                { title: 'Dịch vụ', dataIndex: ['service', 'title'], render: (v) => v || '—' },
              ]}
            />
          </div>,
          okText: 'Xác nhận xóa lịch', cancelText: 'Quay lại',
          onOk: () => remove(row, reason, true),
        })
      } else message.error(errorMessage(err))
    }
  }

  /** Xóa cả khối ca (mọi KTV của 1 ca trong 1 ngày). 409 gom chung 1 modal xác nhận. */
  const removeBlock = async (block: ScheduleBlock, reason: string) => {
    if (block.rows.some((row) => row.onLeave)) return
    const affected: ConflictAppointment[] = []
    const blockedRows: StaffScheduleDateWithStaff[] = []
    for (const row of block.rows) {
      try {
        await deleteSchedule(row.id, reason)
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
          await deleteSchedule(row.id, reason, true)
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
          <ResponsiveTable<ConflictAppointment>
            rowKey="id" size="small" pagination={false} scroll={{ y: 240 }} dataSource={affected}
            columns={[
              { title: 'Ngày', dataIndex: 'appt_date', render: (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString('vi-VN') },
              { title: 'Giờ', dataIndex: 'start_time', render: (v: string) => v?.slice(0, 5) },
              { title: 'Khách', dataIndex: ['user', 'full_name'], render: (_: unknown, row: ConflictAppointment) => displayName(row.user) },
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
    void daysOffQuery.refetch()
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
        onRemoveRow={(row: StaffScheduleDateWithStaff) => confirmDeleteReason('Gỡ nhân viên khỏi ca?', (reason) => remove(row, reason))}
        onDuplicate={(duplicated: ScheduleBlock) => {
          const first = duplicated.rows.find((row) => !row.onLeave)
          if (!first) return
          openForm(undefined, { staffId: first?.staff_id, branchId: first?.branch_id, templateId: duplicated.template?.id ?? first?.shift_template_id })
          setSelectedBlockKey(null)
        }}
        onDeleteBlock={(target: ScheduleBlock) => confirmDeleteReason('Xóa ca làm việc?', (reason) => removeBlock(target, reason))}
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
      message.error('Nhân viên chưa được gán vào cơ sở đã chọn. Hãy kiểm tra lại nhân sự trước khi xếp lịch.')
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
      branches={[]}
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
  const calendarViewportRef = useRef<HTMLDivElement>(null)
  const [calendarViewportHeight, setCalendarViewportHeight] = useState(0)
  useEffect(() => {
    setToolbarSlot(toolbarSlotRef?.current ?? null)
  }, [toolbarSlotRef])

  useLayoutEffect(() => {
    const measureViewport = () => {
      const viewport = calendarViewportRef.current
      if (!viewport || window.innerWidth < 768) return
      const top = viewport.getBoundingClientRect().top
      const nextHeight = Math.max(320, window.innerHeight - top - 12)
      setCalendarViewportHeight((current) => Math.abs(current - nextHeight) < 1 ? current : nextHeight)
    }

    measureViewport()
    const observer = new ResizeObserver(measureViewport)
    if (calendarViewportRef.current?.parentElement) observer.observe(calendarViewportRef.current.parentElement)
    window.addEventListener('resize', measureViewport)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measureViewport)
    }
  })

  const showCreate = canManage || isTechSelf
  const createDisabled = isTechSelf && !registrationOpen
  const createLabel = 'Đăng ký ca'
  const createMenuItems: MenuProps['items'] = [
    {
      key: 'selected-day',
      icon: <CalendarOutlined />,
      label: `Đăng ký cho ngày ${anchor.format('DD/MM/YYYY')}`,
    },
  ]

  return <div className="flex h-full min-h-0 flex-col">
    {toolbarSlot && createPortal(
      <CalendarToolbar
        compact
        roster={{ selected: showRoster, onSelect: () => { setShowRoster(true); setView('week'); setSelectedBlockKey(null) } }}
        extra={showCreate && (
          <Space.Compact className="shrink-0">
            <Button type="primary" className="h-9! rounded-s-lg! rounded-e-none! px-3.5! text-[13px]! font-semibold! shadow-none!" icon={<PlusOutlined />} disabled={createDisabled} onClick={() => openForm()}>
              {createLabel}
            </Button>
            <Dropdown trigger={['click']} menu={{
              items: createMenuItems,
              onClick: ({ key }) => {
                if (key === 'selected-day') openForm(undefined, { date: anchor })
              },
            }}>
              <Button type="primary" className="h-9! rounded-s-none! rounded-e-lg! shadow-none!" aria-label="Tùy chọn đăng ký ca" disabled={createDisabled} icon={<DownOutlined />} />
            </Dropdown>
          </Space.Compact>
        )}
        activeFilterCount={Number(Boolean(branchFilter)) + Number(hiddenShifts.size > 0) + Number(hiddenStaff.size > 0)}
        panelLabel="Ngày và bộ lọc lịch làm việc"
        refreshing={dateSchedulesQuery.isFetching || templatesQuery.isFetching}
        periodLabel={view === 'week'
          ? ['Tuần', range[0].format(range[0].isSame(range[1], 'year') ? 'DD/MM' : 'DD/MM/YYYY'), '–', range[1].format('DD/MM/YYYY')].join(' ')
          : anchor.format(view === 'day' ? 'DD/MM/YYYY' : '[Tháng] M/YYYY')}
        anchor={anchor}
        onAnchorChange={(date) => { setAnchor(date); setSelectedBlockKey(null) }}
        view={view}
        onViewChange={(nextView) => { setShowRoster(false); setView(nextView); setSelectedBlockKey(null) }}
        branches={[]}
        branchFilter={branchFilter}
        onBranchChange={(value) => { setBranchFilter(value); setSelectedBlockKey(null) }}
        onRefresh={refreshShared}
        leftPanelOpen={filterDrawerOpen}
        onToggleLeftPanel={() => setFilterDrawerOpen((current) => !current)}
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

    <Drawer title="Ngày và bộ lọc" placement="right" size="min(344px, 100vw)" open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}>
      <div className="flex flex-col gap-4">
        <MiniMonthCalendar
          value={anchor}
          view={view}
          onMonthChange={(date) => { setAnchor(date); setSelectedBlockKey(null) }}
          onSelect={(date) => { setAnchor(date); setSelectedBlockKey(null); setFilterDrawerOpen(false) }}
          eventDates={eventDates}
        />
        {canManage && branches.length > 0 && (
          <label className="grid gap-1.5 border-t border-[var(--brand-border-soft)] pt-3 text-xs font-semibold">
            Cơ sở
            <Select
              aria-label="Cơ sở"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tất cả cơ sở"
              value={branchFilter}
              options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
              onChange={(value) => { setBranchFilter(value); setSelectedBlockKey(null) }}
            />
          </label>
        )}
        <div className="border-t border-[var(--brand-border-soft)] pt-3">
          <ShiftFilterPanel templates={templates} hidden={hiddenShifts} onToggle={toggleShift} onToggleAll={toggleAllShifts} />
        </div>
        <div className="border-t border-[var(--brand-border-soft)] pt-3">
          <StaffFilterPanel staff={filterStaff} hidden={hiddenStaff} onToggle={toggleStaff} />
        </div>
      </div>
    </Drawer>

    {showRoster && (
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--brand-border-soft)] bg-white">
        <Table<ScheduleStaff>
          className="[&_.ant-table-thead_th]:bg-white! [&_.ant-table-thead_th]:text-[#49324e]! [&_.ant-table-thead_th]:border-[#ebdfee]!"
          size="small"
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1040 }}
          dataSource={filterStaff.filter((person) => !hiddenStaff.has(person.id))}
          locale={{ emptyText: 'Không có nhân viên phù hợp bộ lọc' }}
          columns={[
            { title: 'Nhân viên', key: 'staff', fixed: 'left', width: 176, render: (_, person) => staffLabel(person) },
            ...days.map((date) => {
              const dateKey = date.format('YYYY-MM-DD')
              const notes = notesByDate.get(dateKey) ?? []
              return ({
              title: <div className="flex items-center justify-between gap-1">
                <span className={date.isSame(dayjs(), 'day') ? 'rounded bg-[#eee0f1] px-1.5 py-0.5 font-semibold text-[#702877]' : undefined}>
                  {WEEKDAY_LABELS[date.day()]} · {date.format('DD/MM')}
                </span>
                {(notes.length > 0 || canManage) && (
                  <Popover
                    trigger={canManage ? ['hover', 'focus'] : ['hover', 'focus', 'click']}
                    title="Ghi chú cả ngày"
                    content={<div className="max-w-64 whitespace-pre-wrap break-words">{notes.join('\n') || 'Thêm ghi chú'}</div>}
                  >
                    <Button type="text" size="small" className="h-6! w-6! shrink-0 rounded! border-0! bg-transparent! p-0! text-[#65476b]! shadow-none! hover:bg-[#eee0f1]!"
                      aria-label={canManage ? (notes.length ? 'Chỉnh ghi chú cả ngày' : 'Thêm ghi chú cả ngày') : 'Xem ghi chú cả ngày'}
                      onClick={canManage ? () => openNoteForm(date, notes) : undefined}>
                      {notes.length > 0 ? <FileTextOutlined aria-hidden /> : <EditOutlined aria-hidden className="opacity-60" />}
                    </Button>
                  </Popover>
                )}
              </div>,
              key: dateKey,
              width: 124,
              render: (_: unknown, person: ScheduleStaff) => {
                const shifts = shiftsForCell(person.id, date).sort((a, b) =>
                  (a.template?.start_time ?? '').localeCompare(b.template?.start_time ?? ''),
                )
                if (!shifts.length) return <span className="text-slate-400">—</span>
                return <div className="grid gap-1.5">
                  {shifts.map(({ key, row, template, note }) => {
                    const style = shiftStyle(template, templates.findIndex((item) => item.id === template?.id))
                    const hasNote = Boolean(note?.trim())
                    const name = template?.name ?? 'Ca làm việc'
                    const time = template ? [template.start_time.slice(0, 5), template.end_time.slice(0, 5)].join(' – ') : 'Chưa rõ giờ'
                    return (
                      <Popover
                        key={key}
                        trigger={['hover', 'focus', 'click']}
                        placement="top"
                        title={name}
                        content={<div className="grid w-60 max-w-[75vw] gap-2 text-sm">
                          <div className="font-medium">{staffLabel(person)}</div>
                          <div className="text-slate-600">{date.format('DD/MM/YYYY')} · {time}</div>
                          {row?.onLeave && <div className="font-medium text-amber-800">(P) Nghỉ phép</div>}
                          {hasNote && <div className="whitespace-pre-wrap break-words border-t border-slate-200 pt-2">
                            <div className="mb-1 font-semibold">Ghi chú</div>
                            {note}
                          </div>}
                        </div>}
                      >
                        <button
                          type="button"
                          aria-label={[name, time, row?.onLeave && 'Nghỉ phép', hasNote && 'Có ghi chú'].filter(Boolean).join(', ')}
                          className="grid w-full min-w-0 cursor-pointer gap-0.5 rounded-none border px-2 py-1.5 text-left hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1"
                          style={{ backgroundColor: `color-mix(in srgb, ${style.bg} 55%, white)`, borderColor: `color-mix(in srgb, ${style.border} 24%, white)`, color: style.text }}
                        >
                          <span className="flex min-w-0 items-center gap-1 text-xs font-semibold">
                            <span className="min-w-0 flex-1 truncate">{name}</span>
                            {row?.onLeave && <span className="shrink-0 text-amber-900">(P)</span>}
                            {hasNote && <FileTextOutlined aria-hidden className="shrink-0" />}
                          </span>
                          <span className="text-[11px] leading-4 tabular-nums">{time}</span>
                        </button>
                      </Popover>
                    )
                  })}
                </div>
              },
              })
            }),
          ]}
        />
      </div>
    )}

    {!showRoster && <>
    {/* Calendar kiểu Google — desktop trở lên. Lưới giờ, danh sách ca và KTV cuộn trong vùng riêng. */}
    <div
      ref={calendarViewportRef}
      className="desktop-only min-h-0! overflow-hidden!"
      style={{ height: calendarViewportHeight || undefined, flexShrink: 0 }}
    >
      <div style={{ display: 'flex', gap: 8, height: '100%', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ position: 'relative', display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden' }}>
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
        emptyText={staff.length ? 'Không có nhân viên trong bộ lọc này' : 'Chưa có danh sách nhân viên'}
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
                  value={shiftLabel(shiftItem.template) + (shiftItem.row?.onLeave ? ' (P)' : '') + (shiftItem.note ? ` — ${shiftItem.note}` : '')}
                />
              ))}
            </div>
          </>
        )}
      />
    </div>

    </>}

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
