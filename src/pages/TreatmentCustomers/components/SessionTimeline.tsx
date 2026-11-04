import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Col, DatePicker, Divider, Empty, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Spin, Tooltip, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, RollbackOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { errorMessage, pickData } from '@/api/helpers'
import { customInstance } from '@/api/mutator/custom-instance'
import CustomFieldFormItems, { normalizeCustomFieldValues, type CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import {
  deleteSessionsId,
  getCustomerTreatmentsIdAvailableSlots,
  getCustomerTreatmentsIdSessions,
  getSessionsIdPhotos,
  putSessionsId,
  putSessionsIdComplete,
  putSessionsIdDone,
  putSessionsIdStart,
} from '@/api/endpoints/customer-treatments'
import { useBrandDateTime } from '@/themeRuntime'
import useSessionStatusConfig from '@/hooks/useSessionStatusConfig'
import { useAbility } from '@casl/react'
import type { Slot, SessionRow } from './constants'
import { sessionScheduledTimestamp } from './constants'
import { customFieldValueText } from './constants'
import type { SessionPhoto } from '@/api/models/sessionPhoto'
import SessionPhotos from './SessionPhotos'
import { CellVal, SubHead, TRow } from './shared'
/** Timeline các buổi điều trị của 1 lượt — hiển thị trong modal chi tiết */
export default function SessionTimeline({
  ctId,
  ctStatus,
  treatmentTotalAmount = 0,
  formatMoney,
  currencySymbol,
  staffOptions,
  customFieldDefinitions,
  isAdmin,
  onChanged,
  refreshKey,
  focusSessionId,
  onFocusSessionHandled,
}: {
  ctId: string
  ctStatus?: string
  treatmentTotalAmount?: number
  formatMoney: (value: unknown) => string
  currencySymbol: string
  staffOptions: { value: string; label: string }[]
  customFieldDefinitions: CustomFieldDefWithOptions[]
  isAdmin?: boolean
  onChanged?: () => void
  refreshKey?: number
  focusSessionId?: string
  onFocusSessionHandled?: () => void
}) {
  const { formatDateTime, getDateTimeParts } = useBrandDateTime()
  const ability = useAbility()
  const canEditSession = ability.can('UPDATE', 'SESSION')
  const canManageSessionSchedule = ability.can('UPDATE', 'CUSTOMER')
  const canStartSession = ability.can('START' as never, 'SESSION')
  const canFinishSessionWork = ability.can('DONE' as never, 'SESSION')
  const canCompleteSession = ability.can('COMPLETE' as never, 'SESSION')
  const canDeleteSession = ability.can('DELETE', 'SESSION')
  const sessionStatusConfig = useSessionStatusConfig()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [photos, setPhotos] = useState<Record<string, SessionPhoto[]>>({})
  const [loading, setLoading] = useState(true)
  const hasLoadedSessions = useRef(false)
  const loadSequence = useRef(0)
  const sessionSlotSequence = useRef(0)
  const [sessionSlots, setSessionSlots] = useState<Slot[]>([])
  const [sessionSlotsLoading, setSessionSlotsLoading] = useState(false)
  const [editOpen, setEditOpen] = useState<SessionRow | null>(null)
  const scheduleEditTouchedRef = useRef(false)
  const [editForm] = Form.useForm()
  const focusSessionIdRef = useRef(focusSessionId)
  const onFocusSessionHandledRef = useRef(onFocusSessionHandled)
  const maxSessionValue = Math.max(0, Number(treatmentTotalAmount) || 0)
  const selectedSessionTime = Form.useWatch('scheduled_time', editForm)
  const selectedSessionDate = Form.useWatch('scheduled_date', editForm)

  const loadSessionSlots = useCallback(async (session: SessionRow, date: Dayjs) => {
    const sequence = ++sessionSlotSequence.current
    setSessionSlotsLoading(true)
    try {
      const response = await getCustomerTreatmentsIdAvailableSlots(ctId, {
        date: date.format('YYYY-MM-DD'),
        exclude_session_id: session.id,
      })
      if (sequence !== sessionSlotSequence.current) return
      const now = dayjs()
      const slots = ((pickData<Slot[] | undefined>(response) ?? []) as Slot[]).filter((slot) => {
        const slotTime = date.hour(Number(slot.start_time.slice(0, 2))).minute(Number(slot.start_time.slice(3, 5))).second(0).millisecond(0)
        return !slotTime.isBefore(now)
      })
      setSessionSlots(slots)
      const selectedTime = editForm.getFieldValue('scheduled_time')
      const selectedStaff = editForm.getFieldValue('staff_id')
      const matchingSlot = slots.find((slot) => slot.start_time.slice(0, 5) === selectedTime)
      if (selectedTime && !matchingSlot) editForm.setFieldsValue({ scheduled_time: undefined, staff_id: undefined })
      else if (selectedStaff && !matchingSlot?.staff_ids.includes(selectedStaff)) editForm.setFieldsValue({ staff_id: undefined })
    } catch (err) {
      if (sequence === sessionSlotSequence.current) {
        setSessionSlots([])
        message.warning(errorMessage(err))
      }
    } finally {
      if (sequence === sessionSlotSequence.current) setSessionSlotsLoading(false)
    }
  }, [ctId, editForm])

  const openEdit = useCallback((s: SessionRow) => {
    setEditOpen(s)
    scheduleEditTouchedRef.current = false
    sessionSlotSequence.current += 1
    setSessionSlots([])
    const scheduledParts = getDateTimeParts(s.scheduled_at)
    editForm.setFieldsValue({
      scheduled_date: s.scheduled_at
        ? scheduledParts ? dayjs(scheduledParts.date) : null
        : s.appointment?.appt_date ? dayjs(s.appointment.appt_date) : null,
      scheduled_time: s.scheduled_at
        ? scheduledParts?.time
        : s.appointment?.start_time?.slice(0, 5),
      staff_id: s.staff_id,
      session_value: s.session_value == null ? undefined : Number(s.session_value),
      product_amount: Number(s.product_amount ?? 0),
      skin_note: s.skin_note,
      concern: s.concern,
      diary: s.diary,
      products_used: s.products_used,
      result: s.result,
      custom_fields: s.custom_fields ?? {},
    })
    if (!s.appointment_id && s.status === 'scheduled' && scheduledParts) {
      void loadSessionSlots(s, dayjs(scheduledParts.date))
    }
  }, [editForm, getDateTimeParts, loadSessionSlots])

  const staffName = (id?: string) => staffOptions.find((o) => o.value === id)?.label

  useEffect(() => {
    focusSessionIdRef.current = focusSessionId
    onFocusSessionHandledRef.current = onFocusSessionHandled
  }, [focusSessionId, onFocusSessionHandled])

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current
    if (!hasLoadedSessions.current) setLoading(true)
    try {
      const response = await getCustomerTreatmentsIdSessions(ctId)
      if (sequence !== loadSequence.current) return
      const rows = (pickData<SessionRow[] | undefined>(response) ?? []) as SessionRow[]
      setSessions(rows)
      const focusId = focusSessionIdRef.current
      const sessionToEdit = focusId ? rows.find((session) => session.id === focusId) : undefined
      if (sessionToEdit) {
        openEdit(sessionToEdit)
        onFocusSessionHandledRef.current?.()
      }
      hasLoadedSessions.current = true
      setLoading(false)

      // Ảnh tải nền để việc làm mới buổi không giữ cả danh sách ở trạng thái spinner.
      const entries = await Promise.all(rows.map(async (s) => {
        try {
          return [s.id, (pickData<SessionPhoto[] | undefined>(await getSessionsIdPhotos(s.id)) ?? []) as SessionPhoto[]] as const
        } catch {
          return [s.id, [] as SessionPhoto[]] as const
        }
      }))
      if (sequence === loadSequence.current) setPhotos(Object.fromEntries(entries))
    } catch (err) {
      if (sequence === loadSequence.current) message.error(errorMessage(err))
    } finally {
      if (sequence === loadSequence.current) {
        hasLoadedSessions.current = true
        setLoading(false)
      }
    }
  }, [ctId, openEdit])

  useEffect(() => {
    loadSequence.current += 1
    sessionSlotSequence.current += 1
    hasLoadedSessions.current = false
    setSessions([])
    setPhotos({})
    setEditOpen(null)
    setSessionSlots([])
    setLoading(true)
  }, [ctId])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    try {
      await fn()
      message.success(okText)
      load()
      onChanged?.()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  // CT-05b — mở lại buổi đã hoàn tất (chỉ admin): completed → done để bổ sung nội dung/ảnh
  const reopenSession = async (s: SessionRow) => {
    try {
      await customInstance({ url: `/sessions/${s.id}/reopen`, method: 'PUT' })
      message.success('Đã mở lại buổi — bổ sung xong hãy bấm Hoàn tất lại')
      await load()
      onChanged?.()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const submitEdit = async () => {
    const values = await editForm.validateFields()
    const { scheduled_date, scheduled_time, staff_id, ...sessionValues } = values
    const hasAnyScheduleValue = !!scheduled_date || !!scheduled_time || !!staff_id
    if (
      canManageSessionSchedule &&
      !editOpen?.appointment_id &&
      editOpen?.status === 'scheduled' &&
      scheduleEditTouchedRef.current &&
      hasAnyScheduleValue &&
      (!scheduled_date || !scheduled_time || !staff_id)
    ) {
      message.error('Để xếp lịch buổi, cần chọn đủ ngày hẹn, giờ hẹn và KTV phụ trách')
      return
    }
    const hasCompleteSchedule = !!scheduled_date && !!scheduled_time && !!staff_id
    const scheduleIsFuture = hasCompleteSchedule
      && scheduled_date.hour(Number(scheduled_time.slice(0, 2))).minute(Number(scheduled_time.slice(3, 5))).valueOf() >= Date.now()
    const shouldSubmitSchedule = canManageSessionSchedule
      && !editOpen?.appointment_id
      && editOpen?.status === 'scheduled'
      && (scheduleEditTouchedRef.current || scheduleIsFuture)
    const scheduleValues = shouldSubmitSchedule
      ? {
        scheduled_at: scheduled_date && scheduled_time
          ? scheduled_date.hour(Number(scheduled_time.slice(0, 2))).minute(Number(scheduled_time.slice(3, 5))).second(0).millisecond(0).toISOString()
          : null,
        staff_id: staff_id || null,
      }
      : {}
    if (scheduleValues.scheduled_at) {
      const candidateTimestamp = new Date(scheduleValues.scheduled_at).getTime()
      if (!Number.isFinite(candidateTimestamp) || candidateTimestamp < Date.now()) {
        message.error('Không thể xếp buổi vào ngày giờ đã qua')
        return
      }
      const candidateDate = dayjs(scheduleValues.scheduled_at).format('YYYY-MM-DD')
      for (const sibling of sessions) {
        if (sibling.id === editOpen?.id) continue
        const siblingTimestamp = sessionScheduledTimestamp(sibling)
        if (siblingTimestamp == null) continue
        const siblingDate = dayjs(siblingTimestamp).format('YYYY-MM-DD')
        if (sibling.session_no < (editOpen?.session_no ?? 0) && candidateDate <= siblingDate) {
          message.error(`Buổi #${editOpen?.session_no} phải được xếp sau buổi #${sibling.session_no}`)
          return
        }
        if (sibling.session_no > (editOpen?.session_no ?? 0) && candidateDate >= siblingDate) {
          message.error(`Buổi #${editOpen?.session_no} phải được xếp trước buổi #${sibling.session_no}`)
          return
        }
      }
    }
    // Buổi chưa bắt đầu: gửi lịch hẹn + thông tin đầu buổi — phần diễn ra trong buổi khóa theo vòng đời
    const isScheduledSession = editOpen?.status === 'scheduled'
    const contentValues = isScheduledSession
      ? { skin_note: sessionValues.skin_note, concern: sessionValues.concern }
      : {
        diary: sessionValues.diary,
        skin_note: sessionValues.skin_note,
        concern: sessionValues.concern,
        products_used: sessionValues.products_used,
        result: sessionValues.result,
        custom_fields: sessionValues.custom_fields,
      }
    const editableValues = canManageSessionSchedule
      ? (isScheduledSession ? contentValues : sessionValues)
      : contentValues
    try {
      await putSessionsId(editOpen!.id, {
        ...editableValues,
        custom_fields: normalizeCustomFieldValues(customFieldDefinitions, sessionValues.custom_fields ?? {}, editOpen?.custom_fields ?? {}),
        ...(canManageSessionSchedule ? scheduleValues : {}),
      } as never)
      message.success('Đã cập nhật buổi')
      setEditOpen(null)
      await load()
      onChanged?.()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  if (loading) return <Spin className="mx-auto my-8 block!" />
  if (!sessions.length) return <Empty description="Chưa có buổi nào — bấm +1 buổi ở ngoài bảng để tạo" className="py-6" />

  /** Admin toàn quyền; user thường chỉ bắt đầu buổi N khi mọi buổi thường < N đã hoàn tất (bảo hành ngoại lệ) */
  const canStart = (s: SessionRow) =>
    !!isAdmin || !!s.is_warranty || sessions.every((o) => o.is_warranty || o.session_no >= s.session_no || o.status === 'completed')
  /** Tuần tự buổi: buổi trước chưa completed thì buổi sau chưa được ghi nội dung/ảnh (bảo hành ngoại lệ, admin bỏ qua) */
  const sequenceBlocked = (s: SessionRow) =>
    !isAdmin && !s.is_warranty && sessions.some((o) => !o.is_warranty && o.session_no < s.session_no && o.status !== 'completed')
  const sessionStartAllowedToday = (s: SessionRow) => {
    if (s.appointment_id) {
      const date = s.appointment?.appt_date
      const time = s.appointment?.start_time
      if (!date || !time) return false
      const scheduledAt = dayjs(`${String(date).slice(0, 10)}T${String(time).slice(0, 5)}`)
      return scheduledAt.isValid() && scheduledAt.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD') && !scheduledAt.isAfter(dayjs())
    }
    if (!s.scheduled_at) return true
    const scheduledAt = dayjs(s.scheduled_at)
    return scheduledAt.isValid() && scheduledAt.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD') && !scheduledAt.isAfter(dayjs())
  }

  return (
    <>
      {/* Mỗi buổi = 1 bảng liền mạch: header tint + dòng subheader pha + dòng dữ liệu */}
      <div className="flex flex-col gap-3.5">
        {sessions.map((s) => {
          const st = sessionStatusConfig[s.status as keyof typeof sessionStatusConfig] ?? { label: s.status ?? '—', color: '#BFBFBF' }
          // Ảnh quá trình = kind 'process' + ảnh cũ chưa phân loại
          const midPhotos = (photos[s.id] ?? []).filter((p) => p.kind === 'process' || !p.kind)
          return (
            <div
              key={s.id}
              className="overflow-hidden rounded-xl border border-[var(--brand-border)] bg-white"
            >
              {/* Header bảng buổi */}
              <div className="flex flex-wrap items-center gap-3 bg-[var(--brand-bg)] px-4 py-[13px]">
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 17,
                    background: `${st.color}14`,
                    color: st.color,
                    border: `1px solid ${st.color}33`,
                  }}
                >
                  {String(s.session_no).padStart(2, '0')}
                </div>
                <Space size={8} align="center" wrap>
                  <span className="text-[15.5px] font-extrabold text-[#26211F]">
                    {s.scheduled_at
                      ? formatDateTime(s.scheduled_at)
                      : s.appointment?.appt_date
                        ? `${dayjs(s.appointment.appt_date).format('DD/MM/YYYY')} · ${s.appointment.start_time?.slice(0, 5) ?? ''}`
                        : s.started_at || s.done_at || s.completed_at
                          ? `Thực hiện ${formatDateTime(s.started_at || s.done_at || s.completed_at)}`
                          : 'Chưa xếp lịch'}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      padding: '3px 12px',
                      borderRadius: 999,
                      background: `${st.color}1A`,
                      color: st.color,
                    }}
                  >
                    {st.label}
                  </span>
                  {!!s.is_warranty && (
                    <span className="rounded-full bg-[#F59E0B1A] px-3 py-[3px] text-[13px] font-bold text-[#B45309]">
                      Bảo hành
                    </span>
                  )}
                </Space>
                {(ctStatus === 'ACTIVE' || s.is_warranty) && (
                    <Space size={6} wrap className="ml-auto">
                      {canStartSession && s.status === 'scheduled' && !s.is_warranty && (
                        <Tooltip title={!s.staff_id
                          ? 'Buổi chưa có KTV phụ trách — gán KTV trước khi bắt đầu'
                          : !sessionStartAllowedToday(s)
                            ? 'Chỉ bắt đầu được trong ngày hẹn, sau giờ hẹn'
                            : canStart(s) ? undefined : 'Hoàn tất các buổi trước theo đúng thứ tự'}>
                          <Button
                            type="primary"
                            ghost
                            disabled={!s.staff_id || !canStart(s) || !sessionStartAllowedToday(s)}
                            onClick={() => act(() => putSessionsIdStart(s.id), 'Đã bắt đầu buổi')}
                          >
                            Bắt đầu
                          </Button>
                        </Tooltip>
                      )}
                      {canFinishSessionWork && s.status === 'in_progress' && (
                        <Button onClick={() => act(() => putSessionsIdDone(s.id, {} as never), 'Đã thực hiện xong')}>
                          Đã làm
                        </Button>
                      )}
                      {canCompleteSession && s.status === 'done' && (
                        <Button type="primary" onClick={() => act(() => putSessionsIdComplete(s.id), 'Đã hoàn tất buổi')}>
                          Hoàn tất
                        </Button>
                      )}
                      {canEditSession && s.status !== 'completed' && (
                        <Button icon={<EditOutlined />} onClick={() => openEdit(s)}>
                          Sửa
                        </Button>
                      )}
                      {isAdmin && s.status === 'completed' && (
                        <Tooltip title="Mở lại buổi để bổ sung nội dung/ảnh, sau đó hoàn tất lại">
                          <Button icon={<RollbackOutlined />} onClick={() => {
                            Modal.confirm({
                              title: `Mở lại buổi #${s.session_no}?`,
                              content: 'Buổi sẽ quay về trạng thái Đã làm để bổ sung nội dung/ảnh; quota của buổi được tạm hoàn lại và hoa hồng liên quan bị thu hồi (sẽ tạo lại khi hoàn tất lần sau). Hành động được ghi vào nhật ký truy cập.',
                              okText: 'Mở lại buổi',
                              cancelText: 'Hủy',
                              onOk: () => void reopenSession(s),
                            })
                          }}>
                            Mở lại
                          </Button>
                        </Tooltip>
                      )}
                      {canDeleteSession && s.status === 'scheduled' && (
                        <Popconfirm title="Xóa buổi này?" okText="Xóa" cancelText="Hủy" onConfirm={() => act(() => deleteSessionsId(s.id), 'Đã xóa buổi')}>
                          <Button danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </Space>
                )}
              </div>

              {/* Thân bảng — các dòng thông tin */}
              <TRow label="KTV">
                {s.staff_id ? <span className="font-semibold">{staffName(s.staff_id)}</span> : <CellVal v={null} />}
              </TRow>
              {s.session_value != null && <TRow label="Giá trị buổi">{formatMoney(s.session_value)}</TRow>}
              {(s.started_at || s.done_at || s.completed_at) && (
                <TRow label="Thời gian">
                  <span className="text-[13px] font-semibold text-[#5A5C60]">
                    {[
                      s.started_at && `Bắt đầu ${formatDateTime(s.started_at)}`,
                      s.done_at && `Xong ${formatDateTime(s.done_at)}`,
                      s.completed_at && `Hoàn tất ${formatDateTime(s.completed_at)}`,
                    ].filter(Boolean).join('  →  ')}
                  </span>
                </TRow>
              )}

              <SubHead>Đầu buổi</SubHead>
              <TRow label="Tình trạng da"><CellVal v={s.skin_note} /></TRow>
              <TRow label="Cần cải thiện"><CellVal v={s.concern} /></TRow>
              <TRow label="Ảnh trước">
                <SessionPhotos
                  sessionId={s.id}
                  photos={(photos[s.id] ?? []).filter((p) => p.kind === 'before')}
                  kind="before"
                  sessionStatus={s.status}
                  canUpload={canEditSession && (ctStatus === 'ACTIVE' || !!s.is_warranty) && !sequenceBlocked(s)}
                  canDelete={!!isAdmin && (ctStatus === 'ACTIVE' || !!s.is_warranty)}
                  onPhotoAdded={(photo) => setPhotos((current) => ({ ...current, [s.id]: [photo, ...(current[s.id] ?? []).filter((item) => item.id !== photo.id)] }))}
                  onChanged={load}
                />
              </TRow>

              <SubHead>Thực hiện</SubHead>
              <TRow label="Nhật ký"><CellVal v={s.diary} /></TRow>
              <TRow label="Sản phẩm"><CellVal v={s.products_used} /></TRow>
              {(s.is_warranty || Number(s.product_amount || 0) > 0) && (
                <TRow label="Tiền sản phẩm phát sinh">{formatMoney(s.product_amount || 0)}</TRow>
              )}
              <TRow label="Ảnh quá trình">
                <SessionPhotos
                  sessionId={s.id}
                  photos={midPhotos}
                  kind="process"
                  sessionStatus={s.status}
                  canUpload={canEditSession && (ctStatus === 'ACTIVE' || !!s.is_warranty) && !sequenceBlocked(s)}
                  canDelete={!!isAdmin && (ctStatus === 'ACTIVE' || !!s.is_warranty)}
                  onPhotoAdded={(photo) => setPhotos((current) => ({ ...current, [s.id]: [photo, ...(current[s.id] ?? []).filter((item) => item.id !== photo.id)] }))}
                  onChanged={load}
                />
              </TRow>

              <SubHead>Kết quả cuối buổi</SubHead>
              <TRow label="Kết quả"><CellVal v={s.result} /></TRow>
              {customFieldDefinitions.map((definition) => {
                const value = customFieldValueText(s.custom_fields?.[definition.key])
                return value ? <TRow key={definition.id} label={definition.label}><CellVal v={value} /></TRow> : null
              })}
              <TRow label="Ảnh sau">
                <SessionPhotos
                  sessionId={s.id}
                  photos={(photos[s.id] ?? []).filter((p) => p.kind === 'after')}
                  kind="after"
                  sessionStatus={s.status}
                  canUpload={canEditSession && (ctStatus === 'ACTIVE' || !!s.is_warranty) && !sequenceBlocked(s)}
                  canDelete={!!isAdmin && (ctStatus === 'ACTIVE' || !!s.is_warranty)}
                  onPhotoAdded={(photo) => setPhotos((current) => ({ ...current, [s.id]: [photo, ...(current[s.id] ?? []).filter((item) => item.id !== photo.id)] }))}
                  onChanged={load}
                />
              </TRow>
            </div>
          )
        })}
      </div>

      <Modal
        title={`Sửa buổi #${editOpen?.session_no}`}
        open={!!editOpen}
        onCancel={() => setEditOpen(null)}
        onOk={submitEdit}
        okText="Lưu"
        cancelText="Hủy"
        width={560}
      >
        <Form form={editForm} layout="vertical" className="mt-3">
          {editOpen?.appointment_id && (
            <Typography.Text type="secondary" className="mb-3 block">
              Buổi này đã gắn với lịch hẹn; KTV và giờ lấy theo lịch hẹn. Muốn đổi, hãy sửa ở tab Lịch hẹn.
            </Typography.Text>
          )}
          {canManageSessionSchedule && <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="scheduled_date" label="Ngày hẹn">
                <DatePicker
                  format="DD/MM/YYYY"
                  className="w-full!"
                  disabledDate={(date) => date.isBefore(dayjs().startOf('day'), 'day')}
                  disabled={!!editOpen?.appointment_id || editOpen?.status !== 'scheduled'}
                  onChange={(date) => {
                    scheduleEditTouchedRef.current = true
                    editForm.setFieldsValue({ scheduled_time: undefined, staff_id: undefined })
                    setSessionSlots([])
                    if (date && editOpen && !editOpen.appointment_id && editOpen.status === 'scheduled') {
                      void loadSessionSlots(editOpen, date)
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scheduled_time" label="Giờ hẹn">
                <Select
                  disabled={!!editOpen?.appointment_id || editOpen?.status !== 'scheduled' || !selectedSessionDate || sessionSlotsLoading}
                  loading={sessionSlotsLoading}
                  placeholder={selectedSessionDate ? 'Chọn giờ còn trống' : 'Chọn ngày trước'}
                  options={sessionSlots.map((slot) => ({ value: slot.start_time.slice(0, 5), label: slot.start_time.slice(0, 5) }))}
                  onChange={(time) => {
                    scheduleEditTouchedRef.current = true
                    const slot = sessionSlots.find((candidate) => candidate.start_time.slice(0, 5) === time)
                    if (!slot?.staff_ids.includes(editForm.getFieldValue('staff_id'))) editForm.setFieldsValue({ staff_id: undefined })
                  }}
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="staff_id" label="KTV phụ trách">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  disabled={!!editOpen?.appointment_id || editOpen?.status !== 'scheduled' || !selectedSessionTime || sessionSlotsLoading}
                  onChange={() => { scheduleEditTouchedRef.current = true }}
                  placeholder={selectedSessionTime ? 'Chọn KTV rảnh' : 'Chọn ngày và giờ trước'}
                  options={sessionSlots
                    .find((slot) => slot.start_time.slice(0, 5) === selectedSessionTime)
                    ?.staff_ids.map((id) => staffOptions.find((option) => option.value === id))
                    .filter((option): option is { value: string; label: string } => !!option)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              {!editOpen?.is_warranty && (
                <Form.Item
                  name="session_value"
                  label="Giá trị buổi"
                  tooltip="Dùng cho gói định mức tiền — không được vượt quá số tiền còn lại trong gói."
                  help={`Tối đa ${formatMoney(maxSessionValue)}`}
                  rules={[{
                    type: 'number',
                    max: maxSessionValue,
                    message: `Giá trị một buổi không được vượt quá tổng tiền liệu trình (${formatMoney(maxSessionValue)})`,
                  }]}
                >
                  <InputNumber min={0} max={maxSessionValue} step={50000} suffix={currencySymbol} className="w-full!" disabled={editOpen?.status === 'scheduled'} />
                </Form.Item>
              )}
            </Col>
          </Row>}
          {canManageSessionSchedule && editOpen?.is_warranty && (
            <Alert type="info" showIcon message="Buổi bảo hành miễn phí tiền công và không trừ quota. Phí sản phẩm phát sinh được ghi riêng bên dưới." />
          )}
          {editOpen?.status === 'scheduled' && (
            <Alert
              type="info"
              showIcon
              message="Buổi chưa bắt đầu — lưu ngày giờ và KTV sẽ tự tạo lịch ở mục Lịch hẹn. Có thể ghi thông tin đầu buổi; nhật ký, sản phẩm và kết quả ghi khi buổi diễn ra."
            />
          )}
          {editOpen && sequenceBlocked(editOpen) && (
            <Alert
              type="warning"
              showIcon
              message="Buổi trước chưa hoàn thành — phải hoàn tất các buổi theo đúng thứ tự trước khi ghi thông tin hoặc thêm ảnh cho buổi này."
            />
          )}
          <Divider plain className="mb-3.5! mt-1! tracking-[1px] text-[11px] text-[#A9ADB2]!">
            ĐẦU BUỔI
          </Divider>
          <Form.Item name="skin_note" label="Tình trạng da">
            <Input.TextArea rows={2} placeholder="VD: da khô, hơi đỏ vùng má..." disabled={!!editOpen && sequenceBlocked(editOpen)} />
          </Form.Item>
          <Form.Item name="concern" label="Điều cần cải thiện">
            <Input.TextArea rows={2} placeholder="VD: nám vùng gò má, lỗ chân lông to..." disabled={!!editOpen && sequenceBlocked(editOpen)} />
          </Form.Item>
          <Divider plain className="mb-3.5! mt-1! tracking-[1px] text-[11px] text-[#A9ADB2]!">
            THỰC HIỆN
          </Divider>
          <Form.Item name="diary" label="Nhật ký buổi làm">
            <Input.TextArea rows={2} disabled={editOpen?.status === 'scheduled' || (!!editOpen && sequenceBlocked(editOpen))} />
          </Form.Item>
          <Form.Item name="products_used" label="Sản phẩm đã dùng">
            <Input.TextArea rows={2} disabled={editOpen?.status === 'scheduled' || (!!editOpen && sequenceBlocked(editOpen))} />
          </Form.Item>
          {canManageSessionSchedule && <Form.Item
            name="product_amount"
            label="Tiền sản phẩm phát sinh"
            help={editOpen?.is_warranty ? 'Chỉ ghi nhận tiền sản phẩm thêm; không trừ quota và không tính tiền công kỹ thuật.' : 'Số tiền sản phẩm thêm, tách biệt với giá trị buổi và quota liệu trình.'}
            rules={[{ type: 'number', min: 0, message: 'Số tiền không được âm' }]}
          >
            <InputNumber min={0} step={10000} suffix={currencySymbol} className="w-full!" disabled={editOpen?.status === 'scheduled' || (!!editOpen && sequenceBlocked(editOpen))} />
          </Form.Item>}
          <Divider plain className="mb-3.5! mt-1! tracking-[1px] text-[11px] text-[#A9ADB2]!">
            KẾT QUẢ CUỐI BUỔI
          </Divider>
          <Form.Item name="result" label="Kết quả">
            <Input.TextArea rows={2} placeholder="VD: da sáng hơn, khách hài lòng..." disabled={editOpen?.status === 'scheduled' || (!!editOpen && sequenceBlocked(editOpen))} />
          </Form.Item>
          <Divider plain className="mb-3.5! mt-1! tracking-[1px] text-[11px] text-[#A9ADB2]!">
            TRƯỜNG TÙY CHỈNH
          </Divider>
          <CustomFieldFormItems definitions={customFieldDefinitions} disabled={!!editOpen && sequenceBlocked(editOpen)} />
        </Form>
      </Modal>
    </>
  )
}

