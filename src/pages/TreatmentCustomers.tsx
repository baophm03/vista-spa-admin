import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Alert, Button, Card, Col, DatePicker, Divider, Empty, Form, Image, Input, InputNumber, Modal, Popconfirm, Progress, Row, Select, Space, Spin, Statistic, Table, Tabs, Tag, Tooltip, Typography, Upload, message } from 'antd'
import type { MenuProps } from 'antd'
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlayCircleOutlined, PlusOutlined, ReloadOutlined, RollbackOutlined, SearchOutlined, TeamOutlined, WalletOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import StatCards, { type StatItem } from '@/components/base/StatCards'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import RowActionsMenu, { type RowActionItem } from '@/components/base/RowActionsMenu'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { paginateRows } from '@/utils/listTable'
import CustomFieldFormItems, { normalizeCustomFieldValues, type CustomFieldDefWithOptions } from '@/components/CustomFieldFormItems'
import { errorMessage, openHtmlPrint, pickData } from '@/api/helpers'
import { customInstance } from '@/api/mutator/custom-instance'
import type { CustomerTreatment } from '@/api/models/customerTreatment'
import type { SessionPhoto } from '@/api/models/sessionPhoto'
import type { TreatmentPackage } from '@/api/models/treatmentPackage'
import type { LookupItem } from '@/api/models/lookupItem'
import type { MembershipTransaction } from '@/api/models/membershipTransaction'
import type { RewardRedemption } from '@/api/models/rewardRedemption'
import type { GetCustomerProfilesParams } from '@/api/models/getCustomerProfilesParams'
import { getCustomerProfiles, useGetCustomerProfiles, useGetCustomerProfilesIdPoints } from '@/api/endpoints/customer-profiles'
import { getGetRewardRedemptionsQueryKey, getRewardRedemptions } from '@/api/endpoints/rewards'
import {
  deletePhotosId,
  deleteSessionsId,
  getCustomerTreatmentsIdAvailableSlots,
  getCustomerTreatmentsIdPayments,
  getCustomerTreatmentsIdSessions,
  getCustomerTreatmentsId,
  getGetCustomerTreatmentsQueryKey,
  getSessionsIdPhotos,
  postCustomerTreatmentsIdSessions,
  postSessionsIdPhotos,
  putSessionsId,
  putSessionsIdComplete,
  putSessionsIdDone,
  putSessionsIdStart,
  useGetCustomerTreatments,
  useGetCustomerTreatmentsIdAdjustments,
  usePostCustomerTreatments,
  usePostCustomerTreatmentsIdConvert,
  usePostCustomerTreatmentsIdPayments,
  usePutCustomerTreatmentsIdAdjustments,
  usePutCustomerTreatmentsIdCancel,
  usePutCustomerTreatmentsIdFinish,
} from '@/api/endpoints/customer-treatments'
import { useGetService } from '@/api/endpoints/services'
import { useGetTreatmentPackages } from '@/api/endpoints/services'
import { postFiles } from '@/api/endpoints/files'
import { useGetLookupLists } from '@/api/endpoints/lookup-lists'
import {
  useGetCustomerProfilesIdAvailableDiscounts,
  usePostCustomerTreatmentsIdApplyDiscount,
} from '@/api/endpoints/discounts'
import type { DiscountRule } from '@/api/models'
import { usePostCustomerTreatmentsIdRedeemPoints } from '@/api/endpoints/customer-treatments'
import { useGetUsers } from '@/api/endpoints/users'
import { useBrandCurrency, useBrandDateTime } from '@/themeRuntime'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'
import useCustomFieldDefinitions from '@/hooks/useCustomFieldDefinitions'
import useSessionStatusConfig from '@/hooks/useSessionStatusConfig'
import { Can, useAbility } from '@casl/react'
import StandaloneServiceHistory from '@/components/StandaloneServiceHistory'

interface Slot {
  date?: string
  start_time: string
  end_time?: string
  staff_ids: string[]
}

interface ProfileRow {
  id: string
  full_name?: string
  phone?: string
}

interface LookupListRow {
  id: string
  key: string
  name: string
  is_active?: boolean
  lookup_items?: LookupItem[]
}

const QUOTA_LABEL: Record<string, string> = {
  SESSIONS: 'Theo số buổi',
  VALUE: 'Theo định mức tiền',
  UNLIMITED: 'Trọn gói',
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang làm' },
  { value: 'FINISHED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'EXPIRED', label: 'Hết hạn' },
]
interface TreatmentAdjustmentRow {
  id: string
  type: string
  reason: string
  amount?: number | null
  before_json?: Record<string, unknown> | null
  after_json?: Record<string, unknown> | null
  created_at?: string
  created_by?: string
}

type RewardRedemptionRow = RewardRedemption & {
  reward?: {
    name?: string
    type?: string
    benefit_amount?: number | null
    service_id?: string | null
  } | null
}

type CustomerTreatmentColumnKey = 'customer' | 'package_code' | 'progress' | 'payment' | 'expiry' | 'status'
const CUSTOMER_TREATMENT_COLUMN_OPTIONS: { label: string; value: CustomerTreatmentColumnKey }[] = [
  { label: 'Khách hàng', value: 'customer' },
  { label: 'Mã gói', value: 'package_code' },
  { label: 'Tiến độ', value: 'progress' },
  { label: 'Thanh toán', value: 'payment' },
  { label: 'Hạn sử dụng', value: 'expiry' },
  { label: 'Trạng thái', value: 'status' },
]
const DEFAULT_VISIBLE_COLUMNS = CUSTOMER_TREATMENT_COLUMN_OPTIONS.map((column) => column.value)

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang làm', color: 'var(--brand-primary)' },
  FINISHED: { label: 'Hoàn tất', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
  EXPIRED: { label: 'Hết hạn', color: 'orange' },
}

const PAY_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'POS',
  OTHER: 'Khác',
}

const sessionUsage = (treatment: CustomerTreatment) => {
  const rawTotal = Number(treatment.sessions_total ?? 0)
  const rawUsed = Number(treatment.sessions_used ?? 0)
  const bonus = Number(treatment.sessions_bonus ?? 0)
  const total = Number.isFinite(rawTotal) ? Math.max(0, rawTotal + bonus) : bonus
  const used = Number.isFinite(rawUsed) ? Math.max(0, rawUsed) : 0
  return {
    total,
    used,
    remaining: Math.max(0, total - used),
    percent: total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0,
  }
}

const ADJUST_TYPE_OPTIONS = [
  { value: 'ADJUST_BONUS', label: 'Số buổi tặng' },
  { value: 'ADJUST_SESSIONS', label: 'Số buổi đã dùng' },
  { value: 'ADJUST_VALUE_TOTAL', label: 'Định mức tiền được dùng' },
  { value: 'ADJUST_VALUE', label: 'Giá trị đã tiêu' },
  { value: 'EXTEND_EXPIRY', label: 'Hạn dùng của gói' },
]
const ADJUST_TYPE_LABEL: Record<string, string> = {
  ADJUST_SESSIONS: 'Sửa số buổi đã dùng',
  ADJUST_BONUS: 'Sửa buổi tặng',
  ADJUST_VALUE_TOTAL: 'Sửa định mức tiền được dùng',
  ADJUST_VALUE: 'Sửa giá trị đã tiêu',
  EXTEND_EXPIRY: 'Gia hạn hạn dùng',
  CONVERT: 'Chuyển đổi buổi tặng',
  DISCOUNT: 'Giảm giá',
}
const bonusRemainingOf = (row: CustomerTreatment) =>
  Math.max(0, Number(row.sessions_bonus ?? 0) - Math.max(0, Number(row.sessions_used ?? 0) - Number(row.sessions_total ?? 0)))

/** Đổi 1 giá trị trường lịch sử điều chỉnh thành chữ dễ đọc. */
const formatAdjustValue = (field: string, value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (field === 'status') return STATUS_META[String(value)]?.label ?? String(value)
  if (field === 'expires_at') return dayjs(String(value)).format('DD/MM/YYYY')
  if (field === 'value_used' || field === 'value_total') return Number(value).toLocaleString('vi-VN') + ' ₫'
  return String(value)
}

/** So sánh before/after thành các dòng "Tên trường: cũ → mới" (chỉ hiện field thay đổi). */
const adjustmentDiffLines = (row: TreatmentAdjustmentRow): { label: string; before: string; after: string }[] => {
  const before = (row.before_json ?? {}) as Record<string, unknown>
  const after = (row.after_json ?? {}) as Record<string, unknown>
  const lines: { label: string; before: string; after: string }[] = []
  const fields: [string, string][] = [
    ['sessions_bonus', 'Buổi tặng'],
    ['sessions_used', 'Buổi đã dùng'],
    ['value_total', 'Định mức tiền'],
    ['value_used', 'Giá trị đã tiêu'],
    ['expires_at', 'Hạn dùng'],
    ['status', 'Trạng thái'],
  ]
  for (const [field, label] of fields) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      lines.push({ label, before: formatAdjustValue(field, before[field]), after: formatAdjustValue(field, after[field]) })
    }
  }
  if (after.target_service) lines.push({ label: 'Dịch vụ đích', before: '—', after: String(after.target_service) })
  if (!lines.length) {
    lines.push({ label: 'Ghi nhận', before: '—', after: JSON.stringify(after).slice(0, 80) })
  }
  return lines
}

const treatmentProgress = (treatment: CustomerTreatment): number | null => {
  if (treatment.quota_type === 'SESSIONS') return sessionUsage(treatment).percent
  if (treatment.quota_type === 'VALUE') {
    const total = Number(treatment.value_total ?? 0)
    const used = Number(treatment.value_used ?? 0)
    return total > 0 && Number.isFinite(total) && Number.isFinite(used)
      ? Math.min(100, Math.max(0, Math.round((used / total) * 100)))
      : 0
  }
  return null
}

interface SessionRow {
  id: string
  session_no: number
  status?: string
  staff_id?: string
  appointment_id?: string
  scheduled_at?: string
  appointment?: { appt_date?: string; start_time?: string }
  started_at?: string
  done_at?: string
  completed_at?: string
  diary?: string
  skin_note?: string
  concern?: string
  products_used?: string
  result?: string
  session_value?: number
  product_amount?: number
  is_warranty?: boolean
  custom_fields?: Record<string, unknown>
}

function sessionScheduledTimestamp(session: SessionRow): number | null {
  if (session.appointment_id && session.appointment?.appt_date && session.appointment.start_time) {
    const appointmentTime = dayjs(`${session.appointment.appt_date.slice(0, 10)}T${session.appointment.start_time}`)
    return appointmentTime.isValid() ? appointmentTime.valueOf() : null
  }
  if (!session.scheduled_at) return null
  const scheduledTime = dayjs(session.scheduled_at)
  return scheduledTime.isValid() ? scheduledTime.valueOf() : null
}

interface PaymentRow {
  id: string
  amount?: number
  method?: string
  note?: string
  paid_at?: string
  created_at?: string
}

/** Số thumb hiển thị chồng lên nhau trước khi gộp vào badge "+N" */
const PHOTO_VISIBLE_COUNT = 3

/** Ảnh của 1 buổi: tối đa 3 thumb xếp chồng + badge "+N" mở gallery xem tất cả; upload/xóa theo loại (trước/quá trình/sau) */
function SessionPhotos({
  sessionId,
  photos,
  kind,
  sessionStatus,
  canUpload,
  canDelete,
  onPhotoAdded,
  onChanged,
}: {
  sessionId: string
  photos: SessionPhoto[]
  kind?: string
  sessionStatus?: string
  canUpload?: boolean
  canDelete?: boolean
  onPhotoAdded: (photo: SessionPhoto) => void
  onChanged: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  // Vòng đời buổi: hoàn tất = khóa hồ sơ; chưa bắt đầu chỉ chụp "ảnh trước" (khách khám sớm)
  const uploadAllowed = !!canUpload && (!sessionStatus
    || sessionStatus === 'in_progress'
    || sessionStatus === 'done'
    || (sessionStatus === 'scheduled' && (kind ?? 'process') === 'before'))
  const deleteAllowed = !!canDelete && sessionStatus !== 'completed'
  const visiblePhotos = photos.slice(0, PHOTO_VISIBLE_COUNT)
  const hiddenCount = photos.length - visiblePhotos.length
  const badgePhoto = photos[PHOTO_VISIBLE_COUNT]
  const thumbRing = '0 0 0 2px #fff, 0 1px 6px rgba(0,0,0,0.18)'

  const deletePhoto = async (id?: string) => {
    if (!id) return
    setDeleting(true)
    try {
      await deletePhotosId(id)
      message.success('Đã xóa ảnh')
      onChanged()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const deleteButton = (photoId?: string) => (
    <Popconfirm
      title="Xóa ảnh này?"
      okText="Xóa"
      cancelText="Hủy"
      getPopupContainer={(trigger) => trigger.closest('.ant-image-preview') ?? document.body}
      onConfirm={() => {
        void deletePhoto(photoId)
        setPreviewOpen(false)
      }}
    >
      <Button
        size="small"
        danger
        type="text"
        loading={deleting}
        icon={<DeleteOutlined />}
        style={{ position: 'absolute', top: 0, right: 0 }}
        aria-label="Xóa ảnh"
      />
    </Popconfirm>
  )

  return (
    // Ảnh và nút upload phải là item trực tiếp của flex thì mới xếp ngang:
    // bọc chung trong Space thì mỗi div ảnh thành block con của 1 .ant-space-item → xếp dọc
    <div className="session-photo-stack" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {/* items = toàn bộ ảnh để gallery điều hướng được cả list, dù chỉ render vài thumb đầu */}
      <Image.PreviewGroup
        items={photos.map((p) => p.url ?? '').filter(Boolean)}
        preview={
          deleteAllowed
            ? {
                open: previewOpen,
                onOpenChange: setPreviewOpen,
                actionsRender: (node, info) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {node}
                    {deleteButton(photos[info.current]?.id)}
                  </div>
                ),
              }
            : undefined
        }
      >
        {visiblePhotos.map((p, i) => (
          <div key={p.id} style={{ position: 'relative', flexShrink: 0, marginLeft: i === 0 ? 0 : -36 }}>
            <Image
              width={92}
              height={92}
              style={{ objectFit: 'cover', borderRadius: 12, boxShadow: thumbRing }}
              src={p.url ?? undefined}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            />
            {deleteAllowed && deleteButton(p.id)}
          </div>
        ))}
        {badgePhoto && (
          <div style={{ position: 'relative', flexShrink: 0, marginLeft: -36 }}>
            {/* Badge "+N" là chính ảnh thứ 4: bấm vào mở gallery ngay từ ảnh chưa hiện */}
            <Image
              width={92}
              height={92}
              style={{ objectFit: 'cover', borderRadius: 12, boxShadow: thumbRing }}
              src={badgePhoto.url ?? undefined}
              fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 12,
                background: 'rgba(0, 0, 0, 0.45)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
                pointerEvents: 'none',
              }}
            >
              +{hiddenCount}
            </div>
          </div>
        )}
      </Image.PreviewGroup>
      {uploadAllowed && (
        <Upload
          accept="image/*"
          multiple
          showUploadList={false}
          beforeUpload={async (file) => {
            try {
              const uploaded = pickData<{ original?: string }>(await postFiles({ file }))
              if (!uploaded?.original) throw new Error('Máy chủ không trả về đường dẫn ảnh')
              const saved = pickData<SessionPhoto>(await postSessionsIdPhotos(sessionId, { url: uploaded.original, kind }))
              if (!saved?.id) throw new Error('Máy chủ chưa xác nhận ảnh của buổi')
              onPhotoAdded({ ...saved, url: saved.url ?? uploaded.original, kind: saved.kind ?? kind })
              message.success('Đã thêm ảnh')
            } catch (err) {
              message.error(errorMessage(err))
            }
            return false
          }}
        >
          <Button icon={<PlusOutlined />}>Ảnh</Button>
        </Upload>
      )}
    </div>
  )
}

/** Giá trị ô bảng — trống thì gạch mờ */
const CellVal = ({ v }: { v?: string | null }) =>
  v ? <>{v}</> : <span style={{ color: '#C4C6C9' }}>—</span>

function customFieldValueText(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (Array.isArray(value)) return value.map((item) => String(item)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const HIDDEN_TREATMENT_SYSTEM_FIELDS = new Set(['target_service_id', 'converted_from_treatment_id'])
const TREATMENT_SYSTEM_FIELD_LABELS: Record<string, string> = {
  target_service_name: 'Dịch vụ áp dụng',
}

function readableCustomFieldLabel(key: string, definitions: CustomFieldDefWithOptions[]): string {
  const definedLabel = definitions.find((field) => field.key === key)?.label
  if (definedLabel) return definedLabel
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

/** Dòng subheader pha nằm trong bảng buổi (tint nhạt, full-width) */
const SubHead = ({ children }: { children: string }) => (
  <div
    style={{
      padding: '9px 16px',
      background: 'var(--brand-bg)',
      borderTop: '1px solid var(--brand-border-soft)',
      fontSize: 12.5,
      fontWeight: 800,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: 'var(--brand-dark)',
    }}
  >
    {children}
  </div>
)

/** 1 dòng nhãn | giá trị trong bảng buổi */
const TRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div style={{ display: 'flex', padding: '11px 16px', borderTop: '1px solid var(--brand-border-soft)' }}>
    <span style={{ width: 150, flexShrink: 0, fontSize: 13.5, fontWeight: 700, color: '#3F4145', paddingTop: 1, paddingRight: 12 }}>{label}</span>
    <span
      style={{
        flex: 1,
        fontSize: 14.5,
        fontWeight: 600,
        color: '#26211F',
        lineHeight: 1.6,
        minWidth: 0,
        borderLeft: '1px solid var(--brand-border-soft)',
        paddingLeft: 16,
        margin: '-11px 0',
        paddingTop: 11,
        paddingBottom: 11,
      }}
    >
      {children}
    </span>
  </div>
)

/** Timeline các buổi điều trị của 1 lượt — hiển thị trong modal chi tiết */
function SessionTimeline({
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

  if (loading) return <Spin style={{ display: 'block', margin: '32px auto' }} />
  if (!sessions.length) return <Empty description="Chưa có buổi nào — bấm +1 buổi ở ngoài bảng để tạo" style={{ padding: '24px 0' }} />

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sessions.map((s) => {
          const st = sessionStatusConfig[s.status as keyof typeof sessionStatusConfig] ?? { label: s.status ?? '—', color: '#BFBFBF' }
          // Ảnh quá trình = kind 'process' + ảnh cũ chưa phân loại
          const midPhotos = (photos[s.id] ?? []).filter((p) => p.kind === 'process' || !p.kind)
          return (
            <div
              key={s.id}
              style={{
                border: '1px solid var(--brand-border)',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#FFFFFF',
              }}
            >
              {/* Header bảng buổi */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '13px 16px',
                  background: 'var(--brand-bg)',
                }}
              >
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
                  <span style={{ fontWeight: 800, fontSize: 15.5, color: '#26211F' }}>
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
                    <span style={{ fontSize: 13, fontWeight: 700, padding: '3px 12px', borderRadius: 999, background: '#F59E0B1A', color: '#B45309' }}>
                      Bảo hành
                    </span>
                  )}
                </Space>
                {(ctStatus === 'ACTIVE' || s.is_warranty) && (
                    <Space size={6} wrap style={{ marginLeft: 'auto' }}>
                      {canStartSession && s.status === 'scheduled' && !s.is_warranty && (
                        <Tooltip title={!sessionStartAllowedToday(s)
                          ? 'Chỉ bắt đầu được trong ngày hẹn, sau giờ hẹn'
                          : canStart(s) ? undefined : 'Hoàn tất các buổi trước theo đúng thứ tự'}>
                          <Button
                            type="primary"
                            ghost
                            disabled={!canStart(s) || !sessionStartAllowedToday(s)}
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
                {s.staff_id ? <span style={{ fontWeight: 600 }}>{staffName(s.staff_id)}</span> : <CellVal v={null} />}
              </TRow>
              {s.session_value != null && <TRow label="Giá trị buổi">{formatMoney(s.session_value)}</TRow>}
              {(s.started_at || s.done_at || s.completed_at) && (
                <TRow label="Thời gian">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#5A5C60' }}>
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
        <Form form={editForm} layout="vertical" style={{ marginTop: 12 }}>
          {editOpen?.appointment_id && (
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Buổi này đã gắn với lịch hẹn; KTV và giờ lấy theo lịch hẹn. Muốn đổi, hãy sửa ở tab Lịch hẹn.
            </Typography.Text>
          )}
          {canManageSessionSchedule && <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="scheduled_date" label="Ngày hẹn">
                <DatePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
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
                  <InputNumber min={0} max={maxSessionValue} step={50000} suffix={currencySymbol} style={{ width: '100%' }} disabled={editOpen?.status === 'scheduled'} />
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
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>
            ĐẦU BUỔI
          </Divider>
          <Form.Item name="skin_note" label="Tình trạng da">
            <Input.TextArea rows={2} placeholder="VD: da khô, hơi đỏ vùng má..." disabled={!!editOpen && sequenceBlocked(editOpen)} />
          </Form.Item>
          <Form.Item name="concern" label="Điều cần cải thiện">
            <Input.TextArea rows={2} placeholder="VD: nám vùng gò má, lỗ chân lông to..." disabled={!!editOpen && sequenceBlocked(editOpen)} />
          </Form.Item>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>
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
            <InputNumber min={0} step={10000} suffix={currencySymbol} style={{ width: '100%' }} disabled={editOpen?.status === 'scheduled' || (!!editOpen && sequenceBlocked(editOpen))} />
          </Form.Item>}
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>
            KẾT QUẢ CUỐI BUỔI
          </Divider>
          <Form.Item name="result" label="Kết quả">
            <Input.TextArea rows={2} placeholder="VD: da sáng hơn, khách hài lòng..." disabled={editOpen?.status === 'scheduled' || (!!editOpen && sequenceBlocked(editOpen))} />
          </Form.Item>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>
            TRƯỜNG TÙY CHỈNH
          </Divider>
          <CustomFieldFormItems definitions={customFieldDefinitions} disabled={!!editOpen && sequenceBlocked(editOpen)} />
        </Form>
      </Modal>
    </>
  )
}

export default function TreatmentCustomers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeMainTab, setActiveMainTab] = useState<'packages' | 'services'>(() => searchParams.get('tab') === 'services' ? 'services' : 'packages')
  const focusStandaloneAppointmentId = searchParams.get('appointment_id')
  useEffect(() => {
    setActiveMainTab(searchParams.get('tab') === 'services' ? 'services' : 'packages')
  }, [searchParams])
  const consumeFocusAppointment = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('appointment_id')
    setSearchParams(next, { replace: true })
  }
  const changeMainTab = (key: string) => {
    setActiveMainTab(key as 'packages' | 'services')
    const next = new URLSearchParams(searchParams)
    if (key === 'services') next.set('tab', 'services')
    else {
      next.delete('tab')
      next.delete('appointment_id')
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }
  const { format: formatMoney, symbol: currencySymbol } = useBrandCurrency()
  const { formatDateTime } = useBrandDateTime()
  const queryClient = useQueryClient()
  const { isAdmin, isReceptionist } = useCustomerProfileAccess()
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'CUSTOMER')
  const canApplyReward = ability.can('REDEEM_ADMIN', 'REWARD') && ability.can('READ', 'DISCOUNT')
  const canCreateSessions = ability.can('CREATE', 'SESSION')
  const canReadPayments = ability.can('READ', 'PAYMENT')
  const canSeeDebtSummary = (!isReceptionist || isAdmin)
    && (ability.can('READ' as never, 'REPORT') || ability.can('DEBT.READ' as never, 'REPORT'))
  const customerTreatmentCustomFields = useCustomFieldDefinitions('CUSTOMER_TREATMENT')
  const sessionCustomFields = useCustomFieldDefinitions('SESSION')
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [filter, setFilter] = useState<string>('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [pkgFilter, setPkgFilter] = useState<string>()
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CustomerTreatmentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CustomerTreatmentColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  // Modal chi tiết
  const [detail, setDetail] = useState<CustomerTreatment | null>(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const [sessionToEdit, setSessionToEdit] = useState<{ treatmentId: string; sessionId: string } | null>(null)
  const [addSessionFor, setAddSessionFor] = useState<CustomerTreatment | null>(null)
  const [addSessionForm] = Form.useForm()
  const handleSessionFocusHandled = useCallback(() => setSessionToEdit(null), [])
  const [addingSessionId, setAddingSessionId] = useState<string | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  // Gói đang thu tiền — tách khỏi `detail` để thu tiền từ danh sách không bật drawer chi tiết
  const [payTargetId, setPayTargetId] = useState<string | null>(null)
  const [payForm] = Form.useForm()
  // Modal ưu đãi & điểm (DC-06/07 + LY-02)
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoRow, setPromoRow] = useState<CustomerTreatment | null>(null)
  const [applyingRewardId, setApplyingRewardId] = useState<string | null>(null)
  const [promoForm] = Form.useForm()
  const [redeemForm] = Form.useForm()
  const [paymentLookupError, setPaymentLookupError] = useState('')

  const treatmentsQuery = useGetCustomerTreatments({ page: 1, limit: 500 })
  const rows = (pickData<CustomerTreatment[] | undefined>(treatmentsQuery.data) ?? []) as CustomerTreatment[]

  const profilesQuery = useGetCustomerProfiles({ page: 1, limit: 200 })
  const profiles = (pickData<ProfileRow[] | undefined>(profilesQuery.data) ?? []) as ProfileRow[]
  const packagesQuery = useGetTreatmentPackages({ page: 1, limit: 200 })
  const packages = (pickData<TreatmentPackage[] | undefined>(packagesQuery.data) ?? []) as TreatmentPackage[]
  const selectedSalePackageId = Form.useWatch('package_id', form)
  const selectedSalePackage = packages.find((pkg) => pkg.id === selectedSalePackageId)
  const staffsQuery = useGetUsers({ currentPage: 1, pageSize: 200, has_role: true })
  const staffOptions = useMemo(
    () =>
      (((pickData<{ rows?: Array<{ id: string; zalo_name?: string; email?: string }> }>(staffsQuery.data)?.rows ?? [])) as Array<{ id: string; zalo_name?: string; email?: string }>)
        .map((u) => ({ value: u.id, label: `${u.zalo_name || 'Nhân viên'} · ${u.email || u.id.slice(0, 8)}` })),
    [staffsQuery.data],
  )

  const lookupQuery = useGetLookupLists({ key: 'payment.methods', items_is_active: 'true' })
  const paymentLookup = (pickData<LookupListRow[] | undefined>(lookupQuery.data) ?? [])[0] ?? null
  const activePaymentMethods = (paymentLookup?.lookup_items ?? []).filter((item) => item.is_active !== false)
  const paymentMethodLabels = Object.fromEntries((paymentLookup?.lookup_items ?? []).map((item) => [item.code, item.label]))
  const paymentLookupLoading = lookupQuery.isLoading

  useEffect(() => {
    if (lookupQuery.isError) {
      setPaymentLookupError('Không tải được danh mục payment.methods: ' + errorMessage(lookupQuery.error))
      return
    }
    if (lookupQuery.isLoading) return
    const catalog = paymentLookup
    if (!catalog || !catalog.is_active || !catalog.lookup_items?.some((item) => item.is_active !== false)) {
      setPaymentLookupError('Chưa có phương thức thanh toán đang hoạt động trong danh mục payment.methods.')
    } else setPaymentLookupError('')
  }, [lookupQuery.isLoading, lookupQuery.isError, lookupQuery.error, paymentLookup])

  const createMutation = usePostCustomerTreatments()
  const createInFlightRef = useRef(false)
  const createPaymentMutation = usePostCustomerTreatmentsIdPayments()
  const cancelMutation = usePutCustomerTreatmentsIdCancel()
  const finishMutation = usePutCustomerTreatmentsIdFinish()

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetCustomerTreatmentsQueryKey() })
  }, [queryClient])

  const profileOf = (id: string) => profiles.find((p) => p.id === id)
  const profileName = (row: CustomerTreatment) =>
    (row as CustomerTreatment & { customer_profile?: { full_name?: string } }).customer_profile?.full_name
    ?? profileOf(row.customer_profile_id)?.full_name
    ?? 'Khách hàng'
  const profilePhone = (row: CustomerTreatment) =>
    (row as CustomerTreatment & { customer_profile?: { phone?: string } }).customer_profile?.phone ?? profileOf(row.customer_profile_id)?.phone
  const treatmentCode = (row: CustomerTreatment) => row.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const packageName = (row: CustomerTreatment) => {
    const snapshotName = (row.package_snapshot as Record<string, unknown> | undefined)?.name
    const packageTypeName = (row as CustomerTreatment & { package_type?: { name?: string } }).package_type?.name
    return (typeof snapshotName === 'string' && snapshotName.trim() ? snapshotName : undefined)
      ?? packages.find((p) => p.id === row.package_id)?.name
      ?? packageTypeName
      ?? '—'
  }

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (pkgFilter && r.package_id !== pkgFilter) return false
      if (q) {
        const p = profileOf(r.customer_profile_id)
        const shortCode = treatmentCode(r)
        const hay = `${p?.full_name ?? ''} ${p?.phone ?? ''} ${packageName(r)} G-${shortCode} ${shortCode} ${r.id}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filter, pkgFilter, search, profiles, packages])

  const activeFilterCount = Number(filter !== 'all') + Number(!!pkgFilter) + (search ? 1 : 0)
  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue({ package_id: pkgFilter, status: filter })
    setDraftVisibleColumns(visibleColumns)
  }
  const applySearch = (nextKeyword: string) => {
    setSearchInput(nextKeyword)
    setSearch(nextKeyword.trim())
    setPage(1)
  }
  const applyFilters = (values: Record<string, unknown>) => {
    if (!draftVisibleColumns.length) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }
    setPkgFilter(typeof values.package_id === 'string' ? values.package_id : undefined)
    setFilter(typeof values.status === 'string' ? values.status : 'all')
    setVisibleColumns(draftVisibleColumns)
    setFilterOpen(false)
    setPage(1)
  }
  const clearFilters = () => {
    filterForm.resetFields()
    setPkgFilter(undefined)
    setFilter('all')
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const stats = useMemo(() => ({
    total: rows.length,
    ongoing: rows.filter((r) => r.status === 'ACTIVE').length,
    done: rows.filter((r) => r.status === 'FINISHED').length,
    debt: rows
      .filter((r) => r.status !== 'CANCELLED')
      .reduce((s, r) => s + Number(r.debt_amount ?? 0), 0),
  }), [rows])

  const openDetail = (row: CustomerTreatment) => {
    setDetail(row)
    if (!canReadPayments) {
      setPayments([])
      setPayLoading(false)
      return
    }
    setPayLoading(true)
    getCustomerTreatmentsIdPayments(row.id)
      .then((response) => setPayments((pickData<PaymentRow[] | undefined>(response) ?? []) as PaymentRow[]))
      .catch(() => setPayments([]))
      .finally(() => setPayLoading(false))
  }

  const [customerOptions, setCustomerOptions] = useState<ProfileRow[]>([])
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Search khách phía server (BE hỗ trợ ?q=) — debounce 300ms */
  const fetchCustomerOptions = useCallback((q: string) => {
    if (custTimer.current) clearTimeout(custTimer.current)
    custTimer.current = setTimeout(() => {
      getCustomerProfiles({ page: 1, limit: 50, ...(q ? { q } : {}) } as GetCustomerProfilesParams)
        .then((response) => setCustomerOptions((pickData<ProfileRow[] | undefined>(response) ?? []) as ProfileRow[]))
        .catch(() => undefined)
    }, 300)
  }, [])

  const openModal = () => {
    form.setFieldsValue({ customer_profile_id: undefined, package_id: undefined, total_amount: undefined, custom_fields: {} })
    setOpen(true)
    fetchCustomerOptions('')
  }

  const onPackageChange = (id: string) => {
    const pkg = packages.find((p) => p.id === id)
    if (pkg) form.setFieldsValue({ total_amount: pkg.list_price ?? undefined })
  }

  const submit = async () => {
    if (createInFlightRef.current || createMutation.isPending) return
    createInFlightRef.current = true
    try {
      const values = await form.validateFields()
      const dto = {
        ...values,
        sessions_bonus: values.sessions_bonus != null ? Number(values.sessions_bonus) : undefined,
        expires_at: values.expires_at ? (values.expires_at as Dayjs).format('YYYY-MM-DD') : undefined,
        custom_fields: normalizeCustomFieldValues(customerTreatmentCustomFields, values.custom_fields ?? {}),
      }
      await createMutation.mutateAsync({ data: dto as never })
      message.success('Đã thêm khách vào liệu trình')
      setOpen(false)
      refresh()
    } catch (err) {
      if (!(err as { errorFields?: unknown })?.errorFields) message.error(errorMessage(err))
    } finally {
      createInFlightRef.current = false
    }
  }

  const addSession = (row: CustomerTreatment) => {
    if (addingSessionId !== null) return
    addSessionForm.resetFields()
    addSessionForm.setFieldsValue({ custom_fields: {} })
    setAddSessionFor(row)
  }

  const submitNewSession = async () => {
    if (!addSessionFor || addingSessionId !== null) return
    let values: Record<string, unknown>
    try {
      values = await addSessionForm.validateFields()
    } catch (error) {
      if (!(error as { errorFields?: unknown })?.errorFields) message.error(errorMessage(error))
      return
    }
    setAddingSessionId(addSessionFor.id)
    try {
      const created = pickData<SessionRow>(await postCustomerTreatmentsIdSessions(addSessionFor.id, {
        custom_fields: normalizeCustomFieldValues(
          sessionCustomFields,
          (values.custom_fields ?? {}) as Record<string, unknown>,
        ) ?? {},
      } as never))
      setSessionToEdit({ treatmentId: addSessionFor.id, sessionId: created?.id ?? '' })
      openDetail(addSessionFor)
      setSessionsRefreshKey((key) => key + 1)
      message.success('Đã tạo buổi mới')
      setAddSessionFor(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setAddingSessionId(null)
    }
  }

  const cancelTreatment = async (row: CustomerTreatment) => {
    try {
      await cancelMutation.mutateAsync({ id: row.id })
      message.success('Đã hủy liệu trình')
      if (detail?.id === row.id) setDetail(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const refreshSelectedDetail = async () => {
    if (!detail) return
    try {
      const fresh = pickData<CustomerTreatment>(await getCustomerTreatmentsId(detail.id))
      if (fresh) setDetail(fresh)
    } catch { /* bỏ qua — drawer giữ dữ liệu cũ */ }
  }

  const finishTreatment = async (row: CustomerTreatment) => {
    if ((row.debt_amount ?? 0) > 0) {
      message.error('Gói còn nợ — phải thu đủ trước khi hoàn tất liệu trình')
      return
    }
    try {
      // CT-05 — trả da sớm là hợp lệ, nhưng cảnh báo khi sổ chưa ghi buổi hoàn thành nào
      const sessionsRes = await getCustomerTreatmentsIdSessions(row.id)
      const completedCount = (pickData<{ status?: string }[]>(sessionsRes) ?? []).filter((s) => s.status === 'completed').length
      if (completedCount === 0) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: 'Gói chưa có buổi nào hoàn thành',
            content: 'Sổ liệu trình chưa ghi nhận buổi hoàn thành nào. Bạn có chắc muốn trả da / hoàn tất ngay từ bây giờ?',
            okText: 'Vẫn hoàn tất',
            cancelText: 'Hủy',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          })
        })
        if (!confirmed) return
      }
      await finishMutation.mutateAsync({ id: row.id })
      message.success('Đã hoàn tất liệu trình — bắt đầu thời gian bảo hành')
      if (detail?.id === row.id) setDetail(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  // TA — điều chỉnh / chuyển đổi buổi tặng / lịch sử
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustRow, setAdjustRow] = useState<CustomerTreatment | null>(null)
  const [adjustForm] = Form.useForm()
  const adjustType = Form.useWatch('type', adjustForm)
  const adjustAmount = Form.useWatch('amount', adjustForm)
  const adjustMutation = usePutCustomerTreatmentsIdAdjustments()
  // TA-01 — đếm buổi "completed" trong sổ liệu trình để đối chiếu khi sửa số buổi đã dùng
  const adjustSessionsQuery = useQuery({
    queryKey: ['adjust-sessions', adjustRow?.id],
    queryFn: ({ signal }) => getCustomerTreatmentsIdSessions(adjustRow!.id, signal),
    enabled: adjustOpen && adjustType === 'ADJUST_SESSIONS' && !!adjustRow,
    retry: 1,
  })
  const adjustCompletedCount = (pickData<{ status?: string }[]>(adjustSessionsQuery.data) ?? []).filter(
    (s) => s.status === 'completed',
  ).length
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertRow, setConvertRow] = useState<CustomerTreatment | null>(null)
  const [convertForm] = Form.useForm()
  const convertMutation = usePostCustomerTreatmentsIdConvert()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRow, setHistoryRow] = useState<CustomerTreatment | null>(null)
  const [adjustHistoryPage, setAdjustHistoryPage] = useState(1)
  const historyQuery = useGetCustomerTreatmentsIdAdjustments(historyRow?.id ?? 'none', {
    query: { enabled: historyOpen && !!historyRow },
  })
  const servicesQuery = useGetService({ is_active: true, limit: 200 })
  const serviceOptions = (pickData<{ services?: { id: string; title?: string }[] }>(servicesQuery.data)?.services ?? [])
    .map((service) => ({ value: service.id, label: service.title || service.id }))

  const openAdjust = (row: CustomerTreatment) => {
    setAdjustRow(row)
    adjustForm.resetFields()
    setAdjustOpen(true)
  }

  const submitAdjust = async () => {
    if (!adjustRow) return
    const values = await adjustForm.validateFields()
    // TA-01 — cảnh báo khi số buổi đã dùng mới lệch với sổ liệu trình (bộ đếm sẽ lệch sổ)
    if (values.type === 'ADJUST_SESSIONS' && !adjustSessionsQuery.isLoading && Number(values.amount) !== adjustCompletedCount) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: 'Số buổi nhập lệch với sổ liệu trình',
          content: `Sổ ghi nhận ${adjustCompletedCount} buổi đã hoàn thành nhưng bạn nhập ${values.amount}. Bộ đếm gói sẽ lệch sổ cho đến khi đối chiếu lại. Tiếp tục?`,
          okText: 'Vẫn ghi điều chỉnh',
          cancelText: 'Hủy',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!confirmed) return
    }
    try {
      await adjustMutation.mutateAsync({
        id: adjustRow.id,
        data: {
          type: values.type,
          reason: values.reason,
          ...(values.type === 'EXTEND_EXPIRY' ? { expires_at: values.expires_at.format('YYYY-MM-DD') } : { amount: values.amount }),
        } as never,
      })
      message.success('Đã ghi điều chỉnh và cập nhật gói')
      setAdjustOpen(false)
      if (detail?.id === adjustRow.id) setDetail(null)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openConvert = (row: CustomerTreatment) => {
    setConvertRow(row)
    convertForm.resetFields()
    setConvertOpen(true)
  }

  const submitConvert = async () => {
    if (!convertRow) return
    const values = await convertForm.validateFields()
    try {
      await convertMutation.mutateAsync({
        id: convertRow.id,
        data: { service_id: values.service_id, from_sessions: values.from_sessions, reason: values.reason } as never,
      })
      message.success('Đã chuyển buổi tặng sang gói con mới')
      setConvertOpen(false)
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openHistory = (row: CustomerTreatment) => {
    setHistoryRow(row)
    setHistoryOpen(true)
    setAdjustHistoryPage(1)
  }

  const submitPayment = async () => {
    const treatmentId = payTargetId ?? detail?.id
    if (!treatmentId) return
    if (paymentLookupLoading || paymentLookupError || activePaymentMethods.length === 0) {
      message.error(paymentLookupError || 'Danh mục phương thức thanh toán chưa sẵn sàng')
      return
    }
    const values = await payForm.validateFields()
    if (!activePaymentMethods.some((item) => item.code === values.method)) {
      message.error('Chọn phương thức thanh toán đang hoạt động')
      return
    }
    try {
      await createPaymentMutation.mutateAsync({ id: treatmentId, data: values as never })
      message.success('Đã ghi nhận thanh toán')
      setPayOpen(false)
      setPayTargetId(null)
      payForm.resetFields()
      await refreshSelectedDetail()
      if (canReadPayments) {
        setPayLoading(true)
        try {
          const response = await getCustomerTreatmentsIdPayments(treatmentId)
          setPayments((pickData<PaymentRow[] | undefined>(response) ?? []) as PaymentRow[])
        } catch {
          setPayments([])
        } finally {
          setPayLoading(false)
        }
      }
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  // ===== Ưu đãi & đổi điểm (DC-06/07/08, LY-02) =====
  const promoCustomerProfileId = promoRow?.customer_profile_id
  const availableDiscountsQuery = useGetCustomerProfilesIdAvailableDiscounts(promoCustomerProfileId ?? '', {
    query: { enabled: promoOpen && !!promoCustomerProfileId },
  })
  const availableDiscounts: DiscountRule[] = useMemo(
    () => availableDiscountsQuery.data?.responseData ?? [],
    [availableDiscountsQuery.data],
  )
  const rewardRedemptionsParams = {
    page: 1,
    limit: 100,
    status: 'ISSUED',
    ...(promoCustomerProfileId ? { customer_profile_id: promoCustomerProfileId } : {}),
  }
  const rewardRedemptionsQuery = useQuery({
    queryKey: getGetRewardRedemptionsQueryKey(rewardRedemptionsParams),
    queryFn: async () => getRewardRedemptions(rewardRedemptionsParams),
    enabled: promoOpen && !!promoCustomerProfileId,
  })
  const availableRewardRedemptions = (pickData<RewardRedemptionRow[]>(rewardRedemptionsQuery.data) ?? []) as RewardRedemptionRow[]
  const promoServiceIds = new Set(
    ((promoRow as (CustomerTreatment & { allowed_service_ids?: string[] }) | null)?.allowed_service_ids ?? []).map(String),
  )
  const applicableRewardRedemptions = availableRewardRedemptions.filter((redemption) => {
    const reward = redemption.reward
    if (redemption.status !== 'ISSUED' || reward?.type !== 'BENEFIT' || Number(reward.benefit_amount ?? 0) <= 0) return false
    return !reward.service_id || promoServiceIds.has(String(reward.service_id))
  })
  const applyDiscountMutation = usePostCustomerTreatmentsIdApplyDiscount()
  const redeemPointsMutation = usePostCustomerTreatmentsIdRedeemPoints()
  const promoPointsQuery = useGetCustomerProfilesIdPoints(promoCustomerProfileId ?? '', {
    query: { enabled: promoOpen && Boolean(promoCustomerProfileId) },
  })
  const promoPointsData = pickData<{
    points?: number
    redemption?: { enabled?: boolean | string; point_value?: number | null; min_percent?: number | null; max_percent?: number | null }
  }>(promoPointsQuery.data)
  const redeemPointsValue = Number(Form.useWatch('points', redeemForm) ?? 0)
  const redeemBalance = Number(promoPointsData?.points ?? 0)
  const redeemDebt = Number(promoRow?.debt_amount ?? 0)
  const pointValue = Number(promoPointsData?.redemption?.point_value)
  const minRedeemPercent = Number(promoPointsData?.redemption?.min_percent)
  const maxRedeemPercent = Number(promoPointsData?.redemption?.max_percent)
  const isPointsEnabled = promoPointsData?.redemption?.enabled === true || promoPointsData?.redemption?.enabled === 'true'
  const redemptionConfigReady = Number.isFinite(pointValue) && pointValue > 0
    && Number.isFinite(minRedeemPercent) && Number.isFinite(maxRedeemPercent)
    && minRedeemPercent <= maxRedeemPercent
  const redeemMoney = redeemPointsValue * pointValue
  const minRedeemMoney = redeemDebt * minRedeemPercent / 100
  const maxRedeemMoney = redeemDebt * maxRedeemPercent / 100
  let redeemValidationMessage = ''
  if (redeemPointsValue > 0 && redeemDebt <= 0) redeemValidationMessage = 'Gói không còn công nợ để đổi điểm.'
  else if (redeemPointsValue > redeemBalance) redeemValidationMessage = `Khách chỉ còn ${redeemBalance.toLocaleString('vi-VN')} điểm.`
  else if (redeemPointsValue > 0 && redemptionConfigReady && redeemMoney < minRedeemMoney) {
    redeemValidationMessage = `Giá trị đổi thấp hơn mức tối thiểu ${formatMoney(minRedeemMoney)}.`
  } else if (redeemPointsValue > 0 && redemptionConfigReady && redeemMoney > maxRedeemMoney) {
    redeemValidationMessage = `Giá trị đổi vượt mức tối đa ${formatMoney(maxRedeemMoney)}.`
  }
  const canSubmitRedeem = promoPointsQuery.isSuccess && isPointsEnabled && redemptionConfigReady
    && redeemPointsValue > 0 && Number.isInteger(redeemPointsValue)
    && redeemPointsValue <= redeemBalance && redeemDebt > 0
    && redeemMoney >= minRedeemMoney && redeemMoney <= maxRedeemMoney

  const openPromo = (row: CustomerTreatment) => {
    setPromoRow(row)
    setPromoOpen(true)
    promoForm.resetFields()
    redeemForm.resetFields()
  }

  const submitApplyDiscount = async () => {
    const target = promoRow
    if (!target) return
    try {
      const values = await promoForm.validateFields()
      await applyDiscountMutation.mutateAsync({ id: target.id, data: { rule_id: values.rule_id, percent: values.percent } })
      message.success('Đã áp dụng giảm giá vào gói')
      promoForm.resetFields()
      refresh()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const confirmApplyReward = (redemption: RewardRedemptionRow) => {
    const target = promoRow
    const reward = redemption.reward
    if (!target || !reward?.benefit_amount || applyingRewardId) return
    Modal.confirm({
      title: 'Áp dụng quà vào gói liệu trình?',
      content: `Giảm ${formatMoney(reward.benefit_amount)} vào công nợ gói “${packageName(target)}” và đánh dấu lượt đổi đã dùng. Thao tác này không thể hoàn tác.`,
      okText: 'Áp dụng quà',
      cancelText: 'Hủy',
      onOk: async () => {
        setApplyingRewardId(redemption.id)
        try {
          await customInstance({
            url: `/customerTreatments/${target.id}/apply-reward`,
            method: 'POST',
            data: { redemption_id: redemption.id },
          })
          message.success(`Đã trừ ${formatMoney(reward.benefit_amount)} khỏi công nợ và ghi nhận quà đã dùng`)
          const fresh = pickData<CustomerTreatment>(await getCustomerTreatmentsId(target.id))
          if (fresh) setPromoRow(fresh)
          refresh()
          await refreshSelectedDetail()
          await queryClient.invalidateQueries({ queryKey: ['/reward-redemptions'] })
          await rewardRedemptionsQuery.refetch()
        } catch (err) {
          message.error(errorMessage(err))
        } finally {
          setApplyingRewardId(null)
        }
      },
    })
  }

  const submitRedeemPoints = async () => {
    const target = promoRow
    if (!target || !canSubmitRedeem || redeemPointsMutation.isPending) return
    try {
      const values = await redeemForm.validateFields()
      await redeemPointsMutation.mutateAsync({ id: target.id, data: { points: values.points } })
      message.success('Đã trừ điểm vào gói')
      redeemForm.resetFields()
      refresh()
      await promoPointsQuery.refetch()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng lượt đăng ký', value: stats.total.toLocaleString('vi-VN'), icon: <TeamOutlined />, tone: 'primary' },
    { key: 'ongoing', label: 'Đang thực hiện', value: stats.ongoing.toLocaleString('vi-VN'), icon: <PlayCircleOutlined />, tone: 'secondary' },
    { key: 'done', label: 'Đã hoàn tất', value: stats.done.toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'neutral' },
    ...(canSeeDebtSummary ? [{ key: 'debt', label: 'Tổng công nợ', value: formatMoney(stats.debt), icon: <WalletOutlined />, tone: 'tertiary' as const }] : []),
  ]
  const detailSupplementalInfo = Object.entries(detail?.custom_fields ?? {})
    .filter(([key, value]) => !HIDDEN_TREATMENT_SYSTEM_FIELDS.has(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: TREATMENT_SYSTEM_FIELD_LABELS[key] ?? readableCustomFieldLabel(key, customerTreatmentCustomFields),
      value: customFieldValueText(value),
    }))

  return (
    <>
      <Tabs
        activeKey={activeMainTab}
        onChange={changeMainTab}
        items={[
          { key: 'packages', label: 'Gói liệu trình' },
          { key: 'services', label: 'Dịch vụ lẻ' },
        ]}
        style={{ marginBottom: 12 }}
      />
      {activeMainTab === 'services' ? (
        <>
          <PageTitle subtitle="Hồ sơ các lần khách dùng dịch vụ riêng, không trừ buổi gói">Dịch vụ lẻ</PageTitle>
          <StandaloneServiceHistory focusAppointmentId={focusStandaloneAppointmentId} onFocusConsumed={consumeFocusAppointment} />
        </>
      ) : (
        <>
      {/* Thống kê đầu trang — cùng số liệu với rows đã tải (limit 500), thay hàng Card/Statistic cũ */}
      <StatCards items={statItems} />

      <PageTitle
        subtitle="Khách hàng đang thực hiện liệu trình"
        extra={
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--brand-text-inactive, #A9ADB2)' }} />}
              placeholder="Tìm tên hoặc SĐT khách hàng"
              style={{ width: 260 }}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value)
                if (!event.target.value) applySearch('')
              }}
              onPressEnter={() => applySearch(searchInput)}
            />
            <Button icon={<ReloadOutlined />} onClick={refresh} />
            <ListFilterPopover
              open={filterOpen}
              onOpenChange={openFilters}
              activeFilterCount={activeFilterCount}
              form={filterForm}
              onApply={applyFilters}
              onClear={clearFilters}
              columnOptions={CUSTOMER_TREATMENT_COLUMN_OPTIONS}
              draftVisibleColumns={draftVisibleColumns}
              onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CustomerTreatmentColumnKey[])}
              filterItems={(
                <>
                  <Form.Item name="package_id" label="Liệu trình" style={{ marginBottom: 10 }}>
                    <Select allowClear showSearch optionFilterProp="label" placeholder="Tất cả liệu trình" options={packages.map((pkg) => ({ value: pkg.id, label: pkg.name }))} />
                  </Form.Item>
                  <Form.Item name="status" label="Trạng thái" style={{ marginBottom: 0 }}>
                    <Select options={FILTERS} />
                  </Form.Item>
                </>
              )}
            />
            <Can I="UPDATE" a="CUSTOMER">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Thêm khách vào liệu trình
              </Button>
            </Can>
          </Space>
        }
      >
        Khách dùng liệu trình
      </PageTitle>

      <Table<CustomerTreatment>
        rowKey="id"
        loading={treatmentsQuery.isLoading}
        dataSource={paginateRows(list, page, limit)}
        pagination={false}
        onRow={(row) => ({ onClick: () => openDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Khách hàng',
            key: 'customer',
            render: (_: unknown, row: CustomerTreatment) => {
              return (
                <div>
                  <div style={{ fontWeight: 500 }}>{profileName(row)}</div>
                  <div style={{ fontSize: 12, color: '#6F7071' }}>
                    {packageName(row)}{(profilePhone(row)) ? ` · ${profilePhone(row)}` : ''}
                  </div>
                </div>
              )
            },
          },
          {
            title: 'Mã gói',
            key: 'package_code',
            width: 140,
            render: (_: unknown, row: CustomerTreatment) => (
              <div>
                <Tag color="purple">G-{treatmentCode(row)}</Tag>
                <div style={{ fontSize: 11, color: '#8A8790', marginTop: 2 }}>
                  Mua ngày {row.created_at ? dayjs(row.created_at).format('DD/MM/YYYY') : '—'}
                </div>
              </div>
            ),
          },
          {
            title: 'Tiến độ',
            key: 'progress',
            width: 220,
            render: (_: unknown, row: CustomerTreatment) => {
              if (row.quota_type === 'SESSIONS') {
                const { total, used, remaining, percent } = sessionUsage(row)
                if (!total) return <Tag>Chưa cấu hình số buổi</Tag>
                return (
                  <div>
                    <Progress percent={percent} size="small" showInfo={false} strokeColor="var(--brand-primary)" style={{ margin: '0 0 4px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
                      <span>Đã dùng {used}/{total} buổi</span>
                      <span style={{ fontWeight: 600 }}>Còn lại {remaining} buổi</span>
                    </div>
                  </div>
                )
              }
              if (row.quota_type === 'VALUE') {
                return <Tag color="gold">Định mức {formatMoney(row.value_used)} / {formatMoney(row.value_total)}</Tag>
              }
              return <Tag color="gold">Trọn gói</Tag>
            },
          },
          {
            title: 'Thanh toán',
            key: 'payment',
            width: 200,
            render: (_: unknown, row: CustomerTreatment) => (
              <div>
                {canReadPayments && <div style={{ fontSize: 13 }}>
                  {formatMoney(row.paid_amount)} / {formatMoney(row.total_amount)}
                </div>}
                <Tag color={(row.debt_amount ?? 0) > 0 ? 'orange' : 'green'} style={{ marginTop: 4 }}>
                  {(row.debt_amount ?? 0) > 0 ? `Còn nợ ${formatMoney(row.debt_amount)}` : 'Đã trả đủ'}
                </Tag>
              </div>
            ),
          },
          {
            title: 'Hạn sử dụng',
            key: 'expiry',
            width: 120,
            render: (_: unknown, row: CustomerTreatment) =>
              row.expires_at ? dayjs(row.expires_at).format('DD/MM/YYYY') : 'Không hạn',
          },
          {
            title: 'Trạng thái',
            key: 'status',
            dataIndex: 'status',
            width: 110,
            render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
          {
            title: 'Hành động',
            key: 'actions',
            width: 90,
            fixed: 'right' as const,
            render: (_: unknown, row: CustomerTreatment) => {
              const items: MenuProps['items'] = [
                ...(row.status === 'ACTIVE' ? [{ key: 'add_session', icon: <PlusOutlined />, label: '+1 buổi', disabled: addingSessionId !== null }] : []),
                {
                  key: 'pay',
                  label: 'Thu tiền',
                  disabled: !((row.debt_amount ?? 0) > 0 && row.status !== 'CANCELLED'),
                },
                { key: 'adjust', label: 'Điều chỉnh gói', disabled: !(row.status === 'ACTIVE' || row.status === 'EXPIRED') },
                {
                  key: 'convert',
                  label: `Đổi buổi tặng (${bonusRemainingOf(row)})`,
                  disabled: !(row.status === 'ACTIVE' && bonusRemainingOf(row) > 0),
                },
                { key: 'history', label: 'Lịch sử điều chỉnh' },
                { type: 'divider' as const },
                {
                  key: 'finish',
                  label:
                    row.status === 'ACTIVE' && row.quota_type === 'UNLIMITED' && (row.debt_amount ?? 0) > 0 ? (
                      <Tooltip title="Phải thu đủ tiền trước khi hoàn tất liệu trình">Hoàn tất liệu trình (trả da)</Tooltip>
                    ) : (
                      'Hoàn tất liệu trình (trả da)'
                    ),
                  disabled: !(row.status === 'ACTIVE' && row.quota_type === 'UNLIMITED' && (row.debt_amount ?? 0) === 0),
                },
                // CT-06: chỉ Admin được hủy gói liệu trình
                ...(isAdmin ? [{ key: 'cancel', label: 'Hủy liệu trình', danger: true, disabled: row.status !== 'ACTIVE' }] : []),
                ...(row.status === 'ACTIVE' ? [{ key: 'promo', label: 'Ưu đãi & điểm' }] : []),
              ]
              return (
                <RowActionsMenu
                  items={items as RowActionItem[]}
                  onSelect={(key) => {
                    if (key === 'add_session') addSession(row)
                    else if (key === 'pay') {
                      setPayTargetId(row.id)
                      payForm.setFieldsValue({ amount: row.debt_amount, method: activePaymentMethods.find((item) => item.code === 'CASH')?.code ?? activePaymentMethods[0]?.code })
                      setPayOpen(true)
                    } else if (key === 'adjust') {
                      openAdjust(row)
                    } else if (key === 'convert') {
                      openConvert(row)
                    } else if (key === 'history') {
                      openHistory(row)
                    } else if (key === 'finish') {
                      if (row.status !== 'ACTIVE' || row.quota_type !== 'UNLIMITED') {
                        message.error('Chỉ có thể hoàn tất thủ công gói không giới hạn')
                        return
                      }
                      if ((row.debt_amount ?? 0) > 0) {
                        message.error(`Gói còn nợ ${formatMoney(row.debt_amount)} — phải thu đủ trước khi hoàn tất liệu trình`)
                        return
                      }
                      Modal.confirm({
                        title: 'Hoàn tất liệu trình (trả da)?',
                        content: 'Gói sẽ chuyển sang Hoàn tất và bắt đầu tính thời gian bảo hành trọn đời.',
                        okText: 'Hoàn tất',
                        cancelText: 'Không',
                        onOk: () => finishTreatment(row),
                      })
                    } else if (key === 'cancel') {
                      Modal.confirm({
                        title: 'Hủy liệu trình này?',
                        content: 'Chỉ được hủy khi chưa có buổi hoàn tất. Các giao dịch thanh toán được giữ nguyên.',
                        okText: 'Hủy LT',
                        okButtonProps: { danger: true },
                        cancelText: 'Không',
                        onOk: () => cancelTreatment(row),
                      })
                    } else if (key === 'promo') {
                      openPromo(row)
                    }
                  }}
                />
              )
            },
        },
        ].filter((column) =>
          (column.key !== 'actions' || canUpdate) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as CustomerTreatmentColumnKey)),
        )}
      />
      <ListPagination page={page} limit={limit} total={list.length} onChange={setPage} noun="khách điều trị" />
        </>
      )}

      <Modal
        title="Thêm khách vào liệu trình"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="customer_profile_id" label="Khách hàng" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
            <Select
              showSearch
              filterOption={false}
              placeholder="Gõ tên hoặc SĐT để tìm khách"
              onSearch={fetchCustomerOptions}
              options={customerOptions.map((c) => ({ value: c.id, label: `${c.full_name} — ${c.phone}` }))}
            />
          </Form.Item>
          <Form.Item name="package_id" label="Liệu trình" rules={[{ required: true, message: 'Chọn liệu trình' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Chọn liệu trình"
              loading={packagesQuery.isLoading}
              onChange={onPackageChange}
              options={packages.filter((p) => p.is_active).map((p) => ({
                value: p.id,
                label: `${p.name} (${QUOTA_LABEL[p.quota_type ?? ''] ?? p.quota_type})`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="total_amount"
            label="Số tiền"
            extra={selectedSalePackage?.quota_type === 'VALUE' ? 'Định mức sử dụng của gói này sẽ tự bằng số tiền bán.' : undefined}
            rules={[{ required: true, message: 'Nhập số tiền' }]}
          >
            <InputNumber min={0} step={100000} suffix={currencySymbol} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sessions_bonus" label="Buổi tặng" extra="Cộng thêm vào số buổi của gói — để trống nếu không tặng">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expires_at" label="Hạn sử dụng" extra="Để trống nếu gói không giới hạn thời gian">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <CustomFieldFormItems definitions={customerTreatmentCustomFields} />
        </Form>
      </Modal>

      <Modal
        title="Thông tin buổi điều trị mới"
        open={!!addSessionFor}
        onCancel={() => setAddSessionFor(null)}
        onOk={() => void submitNewSession()}
        confirmLoading={addingSessionId !== null}
        okText="Tạo buổi"
        cancelText="Hủy"
      >
        <Form form={addSessionForm} layout="vertical" style={{ marginTop: 12 }}>
          <CustomFieldFormItems definitions={sessionCustomFields} />
          {sessionCustomFields.length === 0 && <Typography.Text type="secondary">Chưa có trường tùy chỉnh cho buổi điều trị.</Typography.Text>}
        </Form>
      </Modal>

      <Modal
        title="Ghi nhận thanh toán"
        open={payOpen}
        onCancel={() => { setPayOpen(false); setPayTargetId(null) }}
        onOk={submitPayment}
        okText="Lưu"
        cancelText="Hủy"
        okButtonProps={{ disabled: paymentLookupLoading || !!paymentLookupError || activePaymentMethods.length === 0 }}
      >
        <Form form={payForm} layout="vertical" style={{ marginTop: 12 }}>
          {paymentLookupError && <Alert type="error" showIcon message="Không thể ghi nhận thanh toán" description={paymentLookupError} style={{ marginBottom: 16 }} />}
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <InputNumber min={1} step={50000} suffix={currencySymbol} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
            <Select
              loading={paymentLookupLoading}
              disabled={paymentLookupLoading || !!paymentLookupError || activePaymentMethods.length === 0}
              options={activePaymentMethods.map((item) => ({ value: item.code, label: item.label }))}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

{/* Modal Ưu đãi & điểm — áp giảm giá (DC-07) và trừ điểm vào gói (LY-02) */ }
<Modal
  title={`Ưu đãi & điểm — gói #${(promoRow?.id ?? '').slice(0, 8)}`}
  open={promoOpen}
  onCancel={() => { setPromoOpen(false); setPromoRow(null) }}
  footer={null}
  width={640}
>
  <Alert
    type="warning" showIcon style={{ marginBottom: 12 }}
    message={`Giảm giá hiện tại: ${formatMoney(promoRow?.discount_amount ?? 0)} — Điểm đã dùng: ${promoRow?.points_used ?? 0} (${formatMoney(promoRow?.points_discount ?? 0)})`}
  />
  <Tabs
    items={[
      {
        key: 'discount',
        label: 'Áp ưu đãi',
        children: (
          <>
            {availableDiscounts.length === 0 && (
              <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Khách hiện không đủ điều kiện ưu đãi nào, hoặc chưa tải được danh sách." />
            )}
            {availableDiscounts.length > 0 && (
              <Form form={promoForm} layout="vertical" style={{ marginBottom: 16 }}>
                <Form.Item name="rule_id" label="Quy tắc ưu đãi đủ điều kiện" rules={[{ required: true, message: 'Chọn quy tắc' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Chọn ưu đãi"
                    options={availableDiscounts.map((rule) => ({
                      value: rule.id!,
                      label: `${rule.code} — ${rule.name} (${rule.percent_min ?? 0}–${rule.percent_max ?? 0}%)`,
                    }))}
                  />
                </Form.Item>
                <Form.Item noStyle shouldUpdate={(p, c) => p.rule_id !== c.rule_id}>
                  {({ getFieldValue }) => {
                    const rule = availableDiscounts.find((r) => r.id === getFieldValue('rule_id'))
                    if (!rule) return null
                    return (
                      <Form.Item
                        name="percent"
                        label="Mức giảm (%)"
                        initialValue={rule.percent_max ?? rule.percent_min}
                        rules={[
                          { required: true, message: 'Nhập mức giảm' },
                          {
                            validator: (_rule_, value) => {
                              const min = rule.percent_min ?? 0
                              const max = rule.percent_max ?? 100
                              if (value == null) return Promise.resolve()
                              if (value < min || value > max) {
                                return Promise.reject(new Error(`Ngoài khoảng ${min}–${max}% — vượt khoảng cần quyền discount.override`))
                              }
                              return Promise.resolve()
                            },
                          },
                        ]}
                        extra={`Khoảng cho phép: ${rule.percent_min ?? 0}–${rule.percent_max ?? 0}%. Trần tổng xếp chồng: ${rule.max_total_percent ?? 50}%.`}
                      >
                        <InputNumber min={0} max={100} precision={0} style={{ width: '100%' }} />
                      </Form.Item>
                    )
                  }}
                </Form.Item>
                <Can I="READ" a="DISCOUNT">
                  <Button type="primary" loading={applyDiscountMutation.isPending} onClick={() => void submitApplyDiscount()}>
                    Áp dụng
                  </Button>
                </Can>
              </Form>
            )}
          </>
        ),
      },
      {
        key: 'redeem',
        label: 'Đổi điểm',
        children: (
          <Form form={redeemForm} layout="vertical">
            {promoPointsQuery.isLoading ? <Spin size="small" /> : null}
            {promoPointsQuery.isError ? (
              <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Không tải được số dư và cấu hình điểm" description={errorMessage(promoPointsQuery.error)} />
            ) : null}
            {promoPointsQuery.isSuccess && !isPointsEnabled ? (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="Tính năng đổi điểm đang tắt theo cấu hình hệ thống." />
            ) : null}
            {promoPointsQuery.isSuccess && isPointsEnabled && !redemptionConfigReady ? (
              <Alert type="error" showIcon style={{ marginBottom: 12 }} message="Cấu hình quy đổi điểm chưa hợp lệ. Kiểm tra giá trị điểm và tỷ lệ tối thiểu/tối đa." />
            ) : null}
            <Form.Item
              name="points"
              label="Số điểm muốn dùng"
              rules={[
                { required: true, message: 'Nhập số điểm' },
                { validator: async (_, value) => Number.isInteger(Number(value)) && Number(value) > 0 ? Promise.resolve() : Promise.reject(new Error('Số điểm phải là số nguyên dương')) },
              ]}
            >
              <InputNumber min={1} max={redeemBalance > 0 ? redeemBalance : undefined} precision={0} style={{ width: '100%' }} disabled={!isPointsEnabled || !redemptionConfigReady || redeemBalance <= 0} />
            </Form.Item>
            {promoPointsQuery.isSuccess && isPointsEnabled && redemptionConfigReady ? (
              <Card size="small" style={{ marginBottom: 12 }}>
                <Space direction="vertical" size={4}>
                  <Typography.Text>Điểm hiện có: <Typography.Text strong>{redeemBalance.toLocaleString('vi-VN')}</Typography.Text></Typography.Text>
                  <Typography.Text>Giá trị dự kiến: <Typography.Text strong>{redeemPointsValue > 0 ? formatMoney(redeemMoney) : '—'}</Typography.Text></Typography.Text>
                  <Typography.Text type="secondary">
                    1 điểm = {formatMoney(pointValue)} · Mức được phép: {formatMoney(minRedeemMoney)}–{formatMoney(maxRedeemMoney)} ({minRedeemPercent}–{maxRedeemPercent}% công nợ {formatMoney(redeemDebt)})
                  </Typography.Text>
                </Space>
              </Card>
            ) : null}
            {redeemValidationMessage && redeemPointsValue > 0 ? (
              <Alert type="error" showIcon style={{ marginBottom: 12 }} message={redeemValidationMessage} />
            ) : null}
            <Can I="POINTS_ADJUST" a="MEMBERSHIP">
              <Button type="primary" loading={redeemPointsMutation.isPending} disabled={!canSubmitRedeem} onClick={() => void submitRedeemPoints()}>
                Đổi điểm
              </Button>
            </Can>
          </Form>
        ),
      },
      {
        key: 'rewards',
        label: 'Quà đã đổi',
        children: (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Áp quà sẽ trừ trực tiếp vào công nợ gói này"
              description="Chỉ hiện lượt đổi còn dùng được và đúng dịch vụ của gói. Gói cần còn công nợ ít nhất bằng mức giảm; nên áp trước khi thu đủ tiền. Khi xác nhận, hệ thống đồng thời đánh dấu quà đã dùng."
            />
            {rewardRedemptionsQuery.isLoading && <Spin />}
            {rewardRedemptionsQuery.isError && (
              <Alert type="error" showIcon message="Không tải được quà đã đổi" description={errorMessage(rewardRedemptionsQuery.error)} />
            )}
            {!rewardRedemptionsQuery.isLoading && !rewardRedemptionsQuery.isError && applicableRewardRedemptions.length === 0 && (
              <Empty description="Khách chưa có quà giảm tiền phù hợp với dịch vụ của gói này" />
            )}
            {applicableRewardRedemptions.map((redemption) => (
              <Card key={redemption.id} size="small" styles={{ body: { padding: 12 } }}>
                <Row align="middle" justify="space-between" gutter={[12, 8]}>
                  <Col flex="auto">
                    <Typography.Text strong>{redemption.reward?.name ?? 'Quà đổi điểm'}</Typography.Text>
                    <div>
                      <Typography.Text type="secondary">
                        Đã trừ {Number(redemption.points_spent).toLocaleString('vi-VN')} điểm · Giảm {formatMoney(redemption.reward?.benefit_amount)}
                      </Typography.Text>
                    </div>
                  </Col>
                  <Col>
                    <Button
                      type="primary"
                      disabled={!canApplyReward || (promoRow?.status !== 'ACTIVE') || Number(promoRow?.debt_amount ?? 0) < Number(redemption.reward?.benefit_amount ?? 0)}
                      loading={applyingRewardId === redemption.id}
                      onClick={() => confirmApplyReward(redemption)}
                    >
                      Áp vào gói
                    </Button>
                  </Col>
                </Row>
                {!canApplyReward && (
                  <Typography.Text type="secondary">Tài khoản chưa có quyền áp dụng quà đổi vào hóa đơn.</Typography.Text>
                )}
                {promoRow?.status === 'ACTIVE' && Number(promoRow.debt_amount ?? 0) < Number(redemption.reward?.benefit_amount ?? 0) && (
                  <Typography.Text type="danger">Công nợ gói này thấp hơn mức giảm của quà.</Typography.Text>
                )}
              </Card>
            ))}
          </Space>
        ),
      },
    ]}
  />
</Modal>

{/* Modal chi tiết — timeline buổi + lịch sử thanh toán */ }
      <Modal
        open={!!detail && !payOpen}
        onCancel={() => setDetail(null)}
        closeIcon={null}
        footer={
          <Button
            onClick={() => setDetail(null)}
            style={{ minWidth: 120, background: '#F0F1F2', borderColor: '#F0F1F2', color: '#57595C', fontWeight: 500 }}
          >
            Đóng
          </Button>
        }
        width="min(1400px, 96vw)"
        style={{ top: 16, maxWidth: '96vw' }}
        styles={{ body: { height: 'calc(82vh - 56px)', overflowY: 'auto', padding: '0 24px 16px' } }}
        title={
          detail ? (
            <Space direction="vertical" size={2}>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}>
                {profileName(detail)}
              </span>
              <Typography.Text style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.78)' }}>
                {packageName(detail)} · {QUOTA_LABEL[detail.quota_type ?? ''] ?? detail.quota_type}
              </Typography.Text>
            </Space>
          ) : null
        }
      >
        {detail && (
          <Row gutter={[20, 16]} style={{ marginTop: 16 }}>
            {/* Rail trái: tóm tắt + hành động — ghim khi cuộn */}
            <Col xs={24} lg={7}>
              <div className="sticky top-2 self-start">
              <div
                style={{
                  border: '1px solid var(--brand-border)',
                  borderRadius: 12,
                  padding: 18,
                  background: 'var(--brand-bg)',
                }}
              >
                <div style={{ fontSize: 12, color: '#6F7071', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700 }}>Tiến độ</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--brand-dark)', marginTop: 2 }}>
                  {detail.quota_type === 'SESSIONS'
                    ? `Đã dùng ${sessionUsage(detail).used}/${sessionUsage(detail).total} buổi`
                    : detail.quota_type === 'VALUE'
                      ? `${formatMoney(detail.value_used)} / ${formatMoney(detail.value_total)}`
                      : 'Trọn gói'}
                </div>
                {treatmentProgress(detail) !== null && (
                  <Progress
                    percent={treatmentProgress(detail) ?? 0}
                    size="small"
                    style={{ marginTop: 6, marginBottom: detail.quota_type === 'SESSIONS' ? 4 : 12 }}
                  />
                )}
                {detail.quota_type === 'SESSIONS' && (
                  <div style={{ fontSize: 14, color: '#3F4145', marginBottom: 12 }}>
                    Còn lại <b>{sessionUsage(detail).remaining} buổi</b>
                  </div>
                )}
                {detail.quota_type === 'UNLIMITED' && (
                  <div style={{ fontSize: 13, color: '#6F7071', margin: '6px 0 12px' }}>
                    Không giới hạn số buổi
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid var(--brand-border-soft)', paddingTop: 12 }}>
                  {canReadPayments && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: '#3F4145', fontWeight: 600 }}>Đã trả</span>
                    <b style={{ fontWeight: 700 }}>{formatMoney(detail.paid_amount)}</b>
                  </div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: '#3F4145', fontWeight: 600 }}>Công nợ</span>
                    <b style={{ fontWeight: 700, color: (detail.debt_amount ?? 0) > 0 ? '#D97706' : '#16A34A' }}>
                      {formatMoney(detail.debt_amount)}
                    </b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: '#3F4145', fontWeight: 600 }}>Trạng thái</span>
                    <Tag color={STATUS_META[detail.status ?? '']?.color} style={{ marginInlineEnd: 0 }}>
                      {STATUS_META[detail.status ?? '']?.label ?? detail.status}
                    </Tag>
                  </div>
                </div>
                {detailSupplementalInfo.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--brand-border-soft)', marginTop: 12, paddingTop: 12 }}>
                    <Typography.Text strong>Thông tin bổ sung</Typography.Text>
                    {detailSupplementalInfo.map(({ key, label, value }) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6, fontSize: 13 }}>
                        <span style={{ color: '#6F7071' }}>{label}</span>
                        <span style={{ textAlign: 'right', overflowWrap: 'anywhere' }}>{value ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {canCreateSessions && detail.status === 'ACTIVE' && detail.quota_type !== 'UNLIMITED' && (
                  <Button block disabled={addingSessionId !== null} loading={addingSessionId === detail.id} onClick={() => addSession(detail)}>
                    +1 buổi
                  </Button>
                )}
                {canUpdate && detail.status !== 'CANCELLED' && (detail.debt_amount ?? 0) > 0 && (
                  <Button
                    block
                    type="primary"
                    onClick={() => {
                      setPayTargetId(detail.id)
                      payForm.setFieldsValue({ amount: detail.debt_amount, method: activePaymentMethods.find((item) => item.code === 'CASH')?.code ?? activePaymentMethods[0]?.code })
                      setPayOpen(true)
                    }}
                  >
                    Thu tiền ({formatMoney(detail.debt_amount)})
                  </Button>
                )}
                {/* INV-01 — In phiếu hóa đơn gói liệu trình (mở hộp thoại In của trình duyệt) */}
                {canReadPayments && <Button
                  block
                  onClick={() =>
                    openHtmlPrint(`/invoices/${detail.id}/print`).catch((err) => message.error(errorMessage(err, 'Không mở được phiếu in — kiểm tra setting module.invoice')))
                  }
                >
                  In phiếu
                </Button>}
                {/* CT-06: chỉ Admin được hủy gói liệu trình */}
                {isAdmin && canUpdate && detail.status === 'ACTIVE' && (
                  <Popconfirm title="Hủy liệu trình này?" okText="Hủy" cancelText="Không" onConfirm={() => cancelTreatment(detail)}>
                    <Button block danger>
                      Hủy liệu trình
                    </Button>
                  </Popconfirm>
                )}
              </div>
              </div>
            </Col>

            {/* Vùng chính: buổi + thanh toán */}
            <Col xs={24} lg={17}>
              <Tabs
                items={[
                  {
                    key: 'sessions',
                    label: 'Buổi điều trị',
                    children: (
                      <SessionTimeline
                        ctId={detail.id}
                        ctStatus={detail.status}
                        treatmentTotalAmount={detail.total_amount}
                        formatMoney={formatMoney}
                        currencySymbol={currencySymbol}
                        staffOptions={staffOptions}
                        customFieldDefinitions={sessionCustomFields}
                        isAdmin={isAdmin}
                        onChanged={() => { refresh(); void refreshSelectedDetail() }}
                        refreshKey={sessionsRefreshKey}
                        focusSessionId={sessionToEdit?.treatmentId === detail.id ? sessionToEdit.sessionId : undefined}
                        onFocusSessionHandled={handleSessionFocusHandled}
                      />
                    ),
                  },
                  ...(canReadPayments ? [{
                    key: 'payments',
                    label: 'Lịch sử thanh toán',
                    children: (
                      <Table<PaymentRow>
                        rowKey="id"
                        size="small"
                        loading={payLoading}
                        dataSource={payments}
                        pagination={false}
                        locale={{ emptyText: <TableEmpty description="Chưa có lần thanh toán nào" /> }}
                        columns={[
                          {
                            title: 'Thời gian',
                            key: 'time',
                            width: 170,
                            render: (_, p) => {
                              const t = p.paid_at || p.created_at
                              return formatDateTime(t)
                            },
                          },
                          {
                            title: 'Số tiền',
                            dataIndex: 'amount',
                            width: 140,
                            render: (v) => <b>{formatMoney(v)}</b>,
                          },
                          {
                            title: 'Phương thức',
                            dataIndex: 'method',
                            width: 130,
                            render: (v: string) => paymentMethodLabels[v] ?? PAY_METHOD[v] ?? v ?? '—',
                          },
                          { title: 'Ghi chú', dataIndex: 'note', render: (v) => v || '—' },
                        ]}
                      />
                    ),
                  }] : []),
                  {
                    key: 'points',
                    label: 'Điểm thưởng',
                    children: <PointsHistoryPanel profileId={detail.customer_profile_id} />,
                  },
                ]}
              />
            </Col>
          </Row>
        )}
      </Modal>

      <Modal
        title={`Điều chỉnh gói — ${adjustRow ? profileName(adjustRow) : ''}`}
        open={adjustOpen}
        onCancel={() => setAdjustOpen(false)}
        onOk={() => void submitAdjust()}
        okText="Ghi điều chỉnh"
        cancelText="Hủy"
        confirmLoading={adjustMutation.isPending}
        destroyOnHidden
      >
        <Form form={adjustForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="type" label="Tham số cần chỉnh" rules={[{ required: true, message: 'Chọn tham số' }]}>
            <Select
              options={ADJUST_TYPE_OPTIONS.filter((option) =>
                option.value !== 'ADJUST_VALUE_TOTAL' || adjustRow?.quota_type === 'VALUE',
              )}
              placeholder="Chọn tham số"
            />
          </Form.Item>
          {adjustType === 'ADJUST_SESSIONS' && (
            <Alert
              type={adjustSessionsQuery.isLoading ? 'info' : adjustCompletedCount === Number(adjustAmount) ? 'success' : 'warning'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                adjustSessionsQuery.isLoading
                  ? 'Đang đối chiếu sổ liệu trình…'
                  : `Sổ liệu trình ghi nhận ${adjustCompletedCount} buổi đã hoàn thành${adjustRow?.sessions_used != null ? ` — bộ đếm hiện tại: ${adjustRow.sessions_used}` : ''}`
              }
              description={
                !adjustSessionsQuery.isLoading && adjustCompletedCount !== Number(adjustAmount)
                  ? 'Giá trị mới lệch với sổ: bộ đếm sẽ không còn khớp số buổi đã hoàn thành trong sổ. Chỉ tiếp tục nếu bạn hiểu rõ sự lệch này (VD: khách làm tay trước khi dùng hệ thống).'
                  : undefined
              }
            />
          )}
          {adjustType === 'EXTEND_EXPIRY' ? (
            <Form.Item name="expires_at" label="Hạn dùng mới" rules={[{ required: true, message: 'Chọn hạn dùng mới' }]}
              extra="Gói đang Hết hạn sẽ tự mở lại thành Đang làm nếu hạn mới ở tương lai.">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          ) : (
            <Form.Item
              name="amount"
              label={adjustType === 'ADJUST_VALUE_TOTAL' ? 'Định mức tiền mới' : 'Giá trị mới'}
              rules={[{ required: true, message: 'Nhập giá trị mới' }]}
              extra={adjustType === 'ADJUST_BONUS'
                ? 'Buổi tặng cộng thêm vào số buổi mua chính.'
                : adjustType === 'ADJUST_VALUE_TOTAL'
                  ? 'Tổng giá trị khách được sử dụng; không phải số đã tiêu.'
                  : undefined}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
          <Form.Item name="reason" label="Lý do điều chỉnh (bắt buộc)" rules={[{ required: true, whitespace: true, message: 'Nhập lý do' }]}>
            <Input.TextArea rows={2} maxLength={500} placeholder="VD: Khách báo salon ghi nhầm số buổi" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Đổi buổi tặng — ${convertRow ? profileName(convertRow) : ''}`}
        open={convertOpen}
        onCancel={() => setConvertOpen(false)}
        onOk={() => void submitConvert()}
        okText="Chuyển đổi"
        cancelText="Hủy"
        confirmLoading={convertMutation.isPending}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Còn ${convertRow ? bonusRemainingOf(convertRow) : 0} buổi tặng khả dụng`}
          description="Chỉ chuyển được buổi TẶNG còn lại, không ảnh hưởng buổi đã mua. Thao tác một chiều — không thể đổi ngược."
        />
        <Form form={convertForm} layout="vertical">
          <Form.Item name="service_id" label="Dịch vụ đích" rules={[{ required: true, message: 'Chọn dịch vụ đích' }]}>
            <Select showSearch optionFilterProp="label" options={serviceOptions} placeholder="Chọn dịch vụ muốn chuyển sang" />
          </Form.Item>
          <Form.Item
            name="from_sessions"
            label="Số buổi chuyển"
            rules={[
              { required: true, message: 'Nhập số buổi' },
              { type: 'number', min: 1, message: 'Tối thiểu 1 buổi' },
              { type: 'number', max: convertRow ? bonusRemainingOf(convertRow) : 0, message: 'Vượt số buổi tặng còn lại' },
            ]}
          >
            <InputNumber min={1} max={convertRow ? bonusRemainingOf(convertRow) : 0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="Lý do (bắt buộc)" rules={[{ required: true, whitespace: true, message: 'Nhập lý do' }]}>
            <Input.TextArea rows={2} maxLength={500} placeholder="VD: Khách không làm mụn nữa, đổi sang gội đầu dưỡng sinh" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Lịch sử điều chỉnh — ${historyRow ? profileName(historyRow) : ''}`}
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={null}
        width={860}
      >
        {historyQuery.isLoading ? (
          <Typography.Text type="secondary">Đang tải…</Typography.Text>
        ) : (pickData<TreatmentAdjustmentRow[]>(historyQuery.data) ?? []).length === 0 ? (
          <Empty description="Gói chưa từng bị điều chỉnh" style={{ margin: '24px 0' }} />
        ) : (
          <>
            <Table<TreatmentAdjustmentRow>
              rowKey="id"
              size="small"
              loading={historyQuery.isLoading}
              dataSource={paginateRows((pickData<TreatmentAdjustmentRow[]>(historyQuery.data) ?? []) as TreatmentAdjustmentRow[], adjustHistoryPage, 8)}
              pagination={false}
              columns={[
                { title: 'Thời gian', dataIndex: 'created_at', width: 130, render: (v: string) => formatDateTime(v) },
                { title: 'Loại', dataIndex: 'type', width: 140, render: (v: string) => ADJUST_TYPE_LABEL[v] ?? v },
                {
                  title: 'Giá trị',
                  dataIndex: 'amount',
                  width: 90,
                  render: (v: number | null, row: TreatmentAdjustmentRow) =>
                    v == null ? '—' : /CONVERT|SESSIONS|BONUS/.test(row.type) ? `${v} buổi` : Number(v).toLocaleString('vi-VN'),
                },
                { title: 'Lý do', dataIndex: 'reason', render: (v: string) => v },
                {
                  title: 'Thay đổi',
                  key: 'diff',
                  width: 280,
                  render: (_: unknown, row: TreatmentAdjustmentRow) => {
                    const lines = adjustmentDiffLines(row)
                    return (
                      <div style={{ fontSize: 12, display: 'grid', gap: 2 }}>
                        {lines.map((line) => (
                          <div key={line.label}>
                            <span style={{ color: '#6F7071' }}>{line.label}: </span>
                            <span style={{ color: '#8C9091' }}>{line.before}</span>
                            {' → '}
                            <span style={{ fontWeight: 600 }}>{line.after}</span>
                          </div>
                        ))}
                      </div>
                    )
                  },
                },
              ]}
            />
            <ListPagination page={adjustHistoryPage} limit={8} total={(pickData<TreatmentAdjustmentRow[]>(historyQuery.data) ?? []).length} onChange={setAdjustHistoryPage} noun="lần điều chỉnh" />
          </>
        )}
      </Modal>
    </>
  )
}

/** LY-01 — Lịch sử biến động điểm của khách (trong drawer chi tiết). */
function PointsHistoryPanel({ profileId }: { profileId: string }) {
  const pointsQuery = useGetCustomerProfilesIdPoints(profileId)
  const [pointPage, setPointPage] = useState(1)
  const data = pickData<{ points?: number; history?: MembershipTransaction[] }>(pointsQuery.data)
  const REF_LABEL: Record<string, string> = {
    PAYMENT: 'Thanh toán',
    MANUAL: 'Chỉnh tay',
    RANK: 'Xét hạng',
    REWARD: 'Đổi quà',
    WHEEL: 'Quay số',
    REDEEM: 'Đổi tiền gói',
  }
  const rows = data?.history ?? []
  return (
    <div style={{ paddingTop: 8 }}>
      <Statistic title="Điểm khả dụng" value={data?.points ?? 0} style={{ marginBottom: 16 }} />
      {pointsQuery.isLoading ? (
        <Typography.Text type="secondary">Đang tải…</Typography.Text>
      ) : rows.length === 0 ? (
        <Empty description="Chưa có biến động điểm nào" />
      ) : (
        <>
          <Table
            rowKey={(r) => String(r.id ?? r.trans_code ?? r.trans_date)}
            size="small"
            dataSource={paginateRows(rows, pointPage, 8)}
            pagination={false}
            columns={[
              { title: 'Thời gian', dataIndex: 'created_at', width: 140, render: (v: string) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm') : '—') },
              { title: 'Loại', dataIndex: 'ref_type', width: 130, render: (v: string) => REF_LABEL[v] ?? v },
              {
                title: 'Điểm',
                dataIndex: 'points_earned',
                width: 90,
                render: (v: number) => (
                  <Typography.Text type={Number(v) >= 0 ? 'success' : 'danger'}>
                    {Number(v) >= 0 ? '+' : ''}{v}
                  </Typography.Text>
                ),
              },
              { title: 'Lý do', dataIndex: 'reason', render: (v: string | null) => v || '—' },
            ]}
          />
          <ListPagination page={pointPage} limit={8} total={rows.length} onChange={setPointPage} noun="biến động điểm" />
        </>
      )}
    </div>
  )
}
