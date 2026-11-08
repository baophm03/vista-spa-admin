import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import dayjs, { type Dayjs } from 'dayjs'
import { Alert, Button, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Tooltip, message } from 'antd'
import { DeleteOutlined, EditOutlined, LeftOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons'
import { errorMessage, pickData } from '@/api/helpers'
import TableEmpty from '@/components/base/TableEmpty'
import ToolbarRow from '@/components/base/ToolbarRow'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import type { StaffScheduleDate as StaffScheduleDateRow, ShiftTemplate as ShiftTemplateRow } from './types'
import {
  deleteStaffScheduleDatesId,
  getGetBranchDateNotesQueryKey,
  getGetShiftTemplatesQueryKey,
  getGetStaffScheduleDatesQueryKey,
  postBranchDateNotes,
  postStaffScheduleDates,
  putStaffScheduleDatesId,
  useGetBranchDateNotes,
  useGetShiftTemplates,
  useGetStaffScheduleDates,
} from '@/api/endpoints/staff'
import type { SchedulePageData, ScheduleStaff } from './types'
import { staffLabel } from './types'
import DateScheduleFormModal, { toFormDates } from './components/DateScheduleFormModal'

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
  const [weekStart, setWeekStart] = useState<Dayjs>(() => mondayOf(dayjs()))
  const [branchFilter, setBranchFilter] = useState<string>()
  const [staffFilter, setStaffFilter] = useState<string>()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<StaffScheduleDateWithStaff | null>(null)
  const [form] = Form.useForm()
  const selectedBranch = Form.useWatch('branch_id', form)
  const canManage = access.isAdmin
  const today = dayjs().format('YYYY-MM-DD')
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => weekStart.add(index, 'day')), [weekStart])
  const staffForBranchFilter = useMemo(
    () => staff.filter((person) => !!person.branch_id && (!branchFilter || person.branch_id === branchFilter)),
    [staff, branchFilter],
  )
  const staffForSelectedBranch = useMemo(
    () => staff.filter((person) => !!selectedBranch && person.branch_id === selectedBranch),
    [staff, selectedBranch],
  )

  const dateParams: Record<string, unknown> = {
    from_date: weekStart.format('YYYY-MM-DD'),
    to_date: weekStart.add(6, 'day').format('YYYY-MM-DD'),
  }
  if (canManage && branchFilter) dateParams.branch_id = branchFilter
  if (staffFilter) dateParams.staff_id = staffFilter
  const dateSchedulesQuery = useGetStaffScheduleDates(dateParams as never)
  const templatesQuery = useGetShiftTemplates(branchFilter ? { branch_id: branchFilter } : {})
  // Ghi chú theo ngày của cơ sở (lễ, sự kiện, họp...) — hiển thị ở tiêu đề cột ngày
  const noteParams: Record<string, unknown> = {
    from_date: weekStart.format('YYYY-MM-DD'),
    to_date: weekStart.add(6, 'day').format('YYYY-MM-DD'),
  }
  if (canManage && branchFilter) noteParams.branch_id = branchFilter
  const notesQuery = useGetBranchDateNotes(noteParams as never)
  const [noteEditing, setNoteEditing] = useState<NoteEditTarget | null>(null)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteForm] = Form.useForm()

  const dateRows = (pickData<StaffScheduleDateWithStaff[] | undefined>(dateSchedulesQuery.data) ?? []) as StaffScheduleDateWithStaff[]
  const templates = (pickData<ShiftTemplateRow[] | undefined>(templatesQuery.data) ?? []) as ShiftTemplateRow[]
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

  const visibleStaff = useMemo(() => {
    const filtered = staff.filter((person) => !canManage || !branchFilter || person.branch_id === branchFilter)
    const all = new Map(filtered.map((person) => [person.id, person]))
    for (const row of dateRows) {
      if (!all.has(row.staff_id)) all.set(row.staff_id, { id: row.staff_id, branch_id: row.branch_id })
    }
    return [...all.values()].filter((person) => !staffFilter || person.id === staffFilter)
  }, [staff, dateRows, canManage, branchFilter, staffFilter])

  const shiftsForCell = (personId: string, date: Dayjs): DateCellShift[] => {
    const iso = date.format('YYYY-MM-DD')
    return dateRows
      .filter((row) => row.staff_id === personId && row.work_date?.slice(0, 10) === iso && row.is_active !== false)
      .map((row): DateCellShift => ({
        key: `date-${row.id}`,
        row,
        template: templates.find((item) => item.id === row.shift_template_id) ?? row.shift_template,
        note: row.note,
      }))
  }

  const openForm = (row?: StaffScheduleDateWithStaff) => {
    setEditing(row ?? null)
    const rowStaff = row ? staff.find((person) => person.id === row.staff_id) : undefined
    const branchId = row?.branch_id || branchFilter || rowStaff?.branch_id || staff.find((person) => person.id === staffFilter)?.branch_id || branches[0]?.id
    const staffId = row
      ? (rowStaff?.branch_id === branchId ? row.staff_id : undefined)
      : (staff.find((person) => person.id === staffFilter)?.branch_id === branchId ? staffFilter : undefined)
    form.setFieldsValue(row ? {
      staff_id: staffId,
      branch_id: branchId,
      work_dates: toFormDates(row.work_date),
      shift_template_id: row.shift_template_id,
      note: row.note ?? undefined,
    } : {
      staff_id: staffId,
      branch_id: branchId,
      work_dates: undefined,
      shift_template_id: undefined,
      note: undefined,
    })
    setOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
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
        await putStaffScheduleDatesId(editing.id, {
          work_date: dates[0],
          shift_template_id: values.shift_template_id,
          note: values.note || undefined,
        } as never)
        message.success('Đã cập nhật lịch theo ngày')
      } else {
        const result = await postStaffScheduleDates({
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
      void queryClient.invalidateQueries({ queryKey: getGetStaffScheduleDatesQueryKey() })
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: StaffScheduleDateWithStaff, confirmed = false) => {
    try {
      await deleteStaffScheduleDatesId(
        row.id,
        confirmed ? { confirm_future_appointments: 'true' } : undefined,
      )
      message.success('Đã xóa lịch theo ngày. Các lịch hẹn đã đặt được giữ nguyên.')
      void queryClient.invalidateQueries({ queryKey: getGetStaffScheduleDatesQueryKey() })
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

  const refreshShared = () => {
    void dateSchedulesQuery.refetch()
    void queryClient.invalidateQueries({ queryKey: getGetShiftTemplatesQueryKey() })
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
      await postBranchDateNotes({
        branch_id: values.branch_id,
        note_date: noteEditing.date.format('YYYY-MM-DD'),
        note: String(values.note ?? '').trim(),
      } as never)
      message.success(String(values.note ?? '').trim() ? 'Đã lưu ghi chú ngày' : 'Đã xoá ghi chú ngày')
      void queryClient.invalidateQueries({ queryKey: getGetBranchDateNotesQueryKey() })
      setNoteEditing(null)
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setNoteSaving(false)
    }
  }

  const renderShiftTags = (shifts: DateCellShift[], compact: boolean) => (
    <Space direction="vertical" size={4} style={{ display: 'flex' }}>
      {shifts.map((item) => (
        <Space key={item.key} size={2} style={{ display: 'flex' }}>
          <Tooltip title={item.note ? `Ghi chú: ${item.note}` : undefined}>
            <Tag color="geekblue" style={{ margin: 0, whiteSpace: 'normal', textAlign: 'left', cursor: canManage ? 'pointer' : undefined }} onClick={() => canManage && openForm(item.row)}>
              {shiftLabel(item.template)}{item.note ? ' •' : ''}
            </Tag>
          </Tooltip>
          {canManage && <Popconfirm title="Xóa lịch ngày này?" okText="Kiểm tra và xóa" cancelText="Hủy" onConfirm={() => remove(item.row)}>
            <Button aria-label="Xóa lịch theo ngày" type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>}
        </Space>
      ))}
      {!shifts.length && !compact && <span style={{ color: '#aaa' }}>—</span>}
    </Space>
  )

  const columns = [
    { title: 'KTV', dataIndex: 'id', key: 'staff', width: 160, fixed: 'left' as const, render: (id: string) => <strong>{staffLabel(visibleStaff.find((person) => person.id === id))}</strong> },
    ...weekDates.map((date) => {
      const iso = date.format('YYYY-MM-DD')
      const noteText = (notesByDate.get(iso) ?? []).join(' · ')
      return {
        title: (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={iso === today ? { color: '#71005C', fontWeight: 700 } : undefined}>
                {WEEKDAY_LABELS[date.day()]} {date.format('DD/MM')}
              </span>
              {canManage && (
                <Button aria-label={`Sửa ghi chú ngày ${date.format('DD/MM')}`} type="text" size="small" icon={<EditOutlined />} onClick={() => openNoteForm(date, notesByDate.get(iso) ?? [])} />
              )}
            </div>
            {noteText && (
              <Tooltip title={noteText}>
                <div
                  role={canManage ? 'button' : undefined}
                  onClick={() => canManage && openNoteForm(date, notesByDate.get(iso) ?? [])}
                  style={{ fontSize: 11, lineHeight: 1.3, color: '#71005C', whiteSpace: 'normal', textAlign: 'center', cursor: canManage ? 'pointer' : 'default' }}
                >
                  📝 {noteText.length > 46 ? `${noteText.slice(0, 46)}…` : noteText}
                </div>
              </Tooltip>
            )}
          </div>
        ),
        key: `date-${iso}`,
        render: (_: unknown, person: ScheduleStaff) => renderShiftTags(shiftsForCell(person.id, date), false),
      }
    }),
  ]

  return <div>
    {canManage && <ToolbarRow>
      <Select allowClear placeholder="Tất cả cơ sở" style={{ width: 190 }} value={branchFilter} onChange={(value) => {
        setBranchFilter(value)
        const selectedStaff = staff.find((person) => person.id === staffFilter)
        if (value && selectedStaff?.branch_id !== value) setStaffFilter(undefined)
      }} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
      <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả KTV" style={{ width: 220 }} value={staffFilter} onChange={setStaffFilter} options={staffForBranchFilter.map((person) => ({ value: person.id, label: staffLabel(person) }))} />
      <Space.Compact>
        <Button icon={<LeftOutlined />} aria-label="Tuần trước" onClick={() => setWeekStart((week) => week.subtract(1, 'week'))} />
        <Button onClick={() => setWeekStart(mondayOf(dayjs()))}>Tuần này</Button>
        <Button icon={<RightOutlined />} aria-label="Tuần sau" onClick={() => setWeekStart((week) => week.add(1, 'week'))} />
      </Space.Compact>
      <DatePicker picker="week" allowClear={false} format="DD/MM" value={weekStart} onChange={(value) => value && setWeekStart(mondayOf(value))} />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>Đăng ký theo ngày</Button>
    </ToolbarRow>}
    {!!error && <Alert type="error" showIcon message="Không tải được lịch theo ngày" description={error} action={<Button size="small" onClick={refreshShared}>Thử lại</Button>} style={{ marginBottom: 16 }} />}
    <Table<ScheduleStaff>
      className="desktop-only"
      rowKey="id" size="middle" pagination={false} tableLayout="fixed" scroll={{ x: 1120 }}
      loading={loading} dataSource={visibleStaff} columns={columns}
      locale={{ emptyText: <TableEmpty description={staff.length ? 'Không có KTV trong bộ lọc này' : 'Chưa có danh sách KTV'} /> }}
    />
    {dateNotes.length > 0 && (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        className="mobile-only"
        message={<Space direction="vertical" size={2} style={{ display: 'flex' }}>
          {dateNotes.map((item, index) => (
            <span key={`${item.branch_id}-${item.note_date}-${index}`}>
              📝 {WEEKDAY_LABELS[dayjs(item.note_date).day()]} {dayjs(item.note_date).format('DD/MM')}: {item.note}
            </span>
          ))}
        </Space>}
      />
    )}
    <MobileCards<MobileDateRow>
      rows={visibleStaff.flatMap((person) => {
        const dayRows: MobileDateRow[] = weekDates.map((date) => ({
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
              <div className="mobile-card-title">{staffLabel(visibleStaff.find((entry) => entry.id === item.person.id))}</div>
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
    <p style={{ color: '#849197', fontSize: 12, marginTop: 8 }}>
      Giờ trống khi đặt lịch hẹn được tính từ các ca xếp theo ngày này (trừ ngày nghỉ đã duyệt). Muốn KTV nghỉ, thêm đăng ký ở tab Ngày nghỉ.
    </p>

    <DateScheduleFormModal
      open={open}
      form={form}
      editing={editing ? { id: editing.id, work_date: editing.work_date, shift_template_id: editing.shift_template_id, note: editing.note } : null}
      staff={staff}
      branches={branches}
      branchFilter={branchFilter}
      selectedBranch={selectedBranch}
      staffForSelectedBranch={staffForSelectedBranch}
      templates={templates}
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
