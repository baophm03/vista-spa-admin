import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button, Card, Col, DatePicker, Descriptions, Divider, Empty, Form, Image, Input, InputNumber, Modal, Popconfirm, Progress, Row, Segmented, Select, Space, Spin, Statistic, Table, Tabs, Tag, Tooltip, Typography, Upload, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from '@ant-design/icons'
import PageTitle from '../components/PageTitle'
import {
  bizErrorMessage,
  cancelCustomerTreatment,
  createCustomerTreatment,
  createTreatmentPayment,
  createTreatmentSession,
  createSessionPhoto,
  completeSession,
  deleteSession,
  doneSession,
  listCustomerProfiles,
  listCustomerTreatments,
  listSessionPhotos,
  listTreatmentPackages,
  listTreatmentPayments,
  listTreatmentSessions,
  listUsers,
  startSession,
  updateSession,
  uploadFile,
} from '../api/newsky'
import type { CustomerProfile, CustomerTreatment, TreatmentPackage } from '../api/newsky'
import { getMyInfo } from '../api/auth'
import dayjs from 'dayjs'

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
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Đang làm', color: 'var(--brand-primary)' },
  FINISHED: { label: 'Hoàn tất', color: 'green' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
}

const SESSION_STATUS: Record<string, { label: string; color: string; hex: string }> = {
  scheduled: { label: 'Chưa làm', color: 'default', hex: '#BFBFBF' },
  in_progress: { label: 'Đang thực hiện', color: 'processing', hex: '#1677FF' },
  done: { label: 'Đã thực hiện', color: 'gold', hex: '#FAAD14' },
  completed: { label: 'Hoàn tất', color: 'green', hex: '#52C41A' },
}

const PAY_METHOD: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Chuyển khoản',
  POS: 'POS',
  OTHER: 'Khác',
}

const fmtVnd = (v: unknown) => Number(v ?? 0).toLocaleString('vi-VN')

const apiOrigin = (() => {
  try {
    return new URL(import.meta.env.VITE_API_URL).origin
  } catch {
    return 'http://localhost:3001'
  }
})()

interface SessionRow {
  id: string
  session_no: number
  status?: string
  staff_id?: string
  appointment_id?: string
  scheduled_at?: string
  started_at?: string
  done_at?: string
  completed_at?: string
  diary?: string
  skin_note?: string
  concern?: string
  products_used?: string
  result?: string
  session_value?: number
  is_warranty?: boolean
}

interface PhotoRow {
  id: string
  url?: string
  file_id?: string
  kind?: string
  caption?: string
  taken_at?: string
}

interface PaymentRow {
  id: string
  amount?: number
  method?: string
  note?: string
  paid_at?: string
  created_at?: string
}

/** Ảnh của 1 buổi: thumbnail + preview + upload theo loại (trước/sau) */
function SessionPhotos({
  sessionId,
  photos,
  kind,
  editable,
  onChanged,
}: {
  sessionId: string
  photos: PhotoRow[]
  kind?: string
  editable?: boolean
  onChanged: () => void
}) {
  return (
    <Space wrap size={8}>
      <Image.PreviewGroup>
        {photos.map((p) => (
          <Image
            key={p.id}
            width={92}
            height={92}
            style={{ objectFit: 'cover', borderRadius: 12 }}
            src={p.url ? apiOrigin + p.url : undefined}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
          />
        ))}
      </Image.PreviewGroup>
      {editable && (
        <Upload
          accept="image/*"
          multiple
          showUploadList={false}
          beforeUpload={async (file) => {
            try {
              const uploaded = await uploadFile(file)
              await createSessionPhoto(sessionId, { url: uploaded.original, kind })
              message.success('Đã thêm ảnh')
              onChanged()
            } catch (err) {
              message.error(bizErrorMessage(err))
            }
            return false
          }}
        >
          <Button icon={<PlusOutlined />}>Ảnh</Button>
        </Upload>
      )}
    </Space>
  )
}

/** Giá trị ô bảng — trống thì gạch mờ */
const CellVal = ({ v }: { v?: string | null }) =>
  v ? <>{v}</> : <span style={{ color: '#C4C6C9' }}>—</span>

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
  staffOptions,
  isAdmin,
  onChanged,
}: {
  ctId: string
  ctStatus?: string
  staffOptions: { value: string; label: string }[]
  isAdmin?: boolean
  onChanged?: () => void
}) {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [photos, setPhotos] = useState<Record<string, PhotoRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState<SessionRow | null>(null)
  const [editForm] = Form.useForm()

  const staffName = (id?: string) => staffOptions.find((o) => o.value === id)?.label

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = (await listTreatmentSessions(ctId)) as unknown as SessionRow[]
      setSessions(rows)
      const entries = await Promise.all(
        rows.map(async (s) => [s.id, (await listSessionPhotos(s.id)) as unknown as PhotoRow[]] as const),
      )
      setPhotos(Object.fromEntries(entries))
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [ctId])

  useEffect(() => {
    load()
  }, [load])

  const act = async (fn: () => Promise<unknown>, okText: string) => {
    try {
      await fn()
      message.success(okText)
      load()
      onChanged?.()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const openEdit = (s: SessionRow) => {
    setEditOpen(s)
    editForm.setFieldsValue({
      scheduled_at: s.scheduled_at ? dayjs(s.scheduled_at) : null,
      staff_id: s.staff_id,
      session_value: s.session_value,
      skin_note: s.skin_note,
      concern: s.concern,
      diary: s.diary,
      products_used: s.products_used,
      result: s.result,
    })
  }

  const submitEdit = async () => {
    const values = await editForm.validateFields()
    await act(
      () =>
        updateSession(editOpen!.id, {
          ...values,
          scheduled_at: values.scheduled_at ? values.scheduled_at.toISOString() : null,
        }),
      'Đã cập nhật buổi',
    )
    setEditOpen(null)
  }

  if (loading) return <Spin style={{ display: 'block', margin: '32px auto' }} />
  if (!sessions.length) return <Empty description="Chưa có buổi nào — bấm +1 buổi ở ngoài bảng để tạo" style={{ padding: '24px 0' }} />

  /** Admin toàn quyền; user thường chỉ bắt đầu buổi N khi mọi buổi thường < N đã hoàn tất (bảo hành ngoại lệ) */
  const canStart = (s: SessionRow) =>
    !!isAdmin || !!s.is_warranty || sessions.every((o) => o.is_warranty || o.session_no >= s.session_no || o.status === 'completed')

  return (
    <>
      {/* Mỗi buổi = 1 bảng liền mạch: header tint + dòng subheader pha + dòng dữ liệu */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sessions.map((s) => {
          const st = SESSION_STATUS[s.status ?? ''] ?? { label: s.status ?? '—', hex: '#BFBFBF' }
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
                    background: `${st.hex}14`,
                    color: st.hex,
                    border: `1px solid ${st.hex}33`,
                  }}
                >
                  {String(s.session_no).padStart(2, '0')}
                </div>
                <Space size={8} align="center" wrap>
                  <span style={{ fontWeight: 800, fontSize: 15.5, color: '#26211F' }}>
                    {s.scheduled_at ? dayjs(s.scheduled_at).format('DD/MM/YYYY · HH:mm') : 'Chưa xếp lịch'}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      padding: '3px 12px',
                      borderRadius: 999,
                      background: `${st.hex}1A`,
                      color: st.hex,
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
                {ctStatus === 'ACTIVE' && (
                  <Space size={6} wrap style={{ marginLeft: 'auto' }}>
                    {s.status === 'scheduled' && (
                      <Tooltip title={canStart(s) ? undefined : 'Hoàn tất các buổi trước theo đúng thứ tự'}>
                        <Button
                          type="primary"
                          ghost
                          disabled={!canStart(s)}
                          onClick={() => act(() => startSession(s.id), 'Đã bắt đầu buổi')}
                        >
                          Bắt đầu
                        </Button>
                      </Tooltip>
                    )}
                    {s.status === 'in_progress' && (
                      <Button onClick={() => act(() => doneSession(s.id), 'Đã thực hiện xong')}>
                        Đã làm
                      </Button>
                    )}
                    {s.status === 'done' && (
                      <Button type="primary" onClick={() => act(() => completeSession(s.id), 'Đã hoàn tất buổi')}>
                        Hoàn tất
                      </Button>
                    )}
                    {s.status !== 'completed' && (
                      <Button icon={<EditOutlined />} onClick={() => openEdit(s)}>
                        Sửa
                      </Button>
                    )}
                    {s.status === 'scheduled' && (
                      <Popconfirm title="Xóa buổi này?" okText="Xóa" cancelText="Hủy" onConfirm={() => act(() => deleteSession(s.id), 'Đã xóa buổi')}>
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
              {s.session_value != null && <TRow label="Giá trị buổi">{fmtVnd(s.session_value)}đ</TRow>}
              {(s.started_at || s.done_at || s.completed_at) && (
                <TRow label="Thời gian">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#5A5C60' }}>
                    {[
                      s.started_at && `Bắt đầu ${dayjs(s.started_at).format('DD/MM HH:mm')}`,
                      s.done_at && `Xong ${dayjs(s.done_at).format('DD/MM HH:mm')}`,
                      s.completed_at && `Hoàn tất ${dayjs(s.completed_at).format('DD/MM HH:mm')}`,
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
                  editable={ctStatus === 'ACTIVE'}
                  onChanged={load}
                />
              </TRow>

              <SubHead>Thực hiện</SubHead>
              <TRow label="Nhật ký"><CellVal v={s.diary} /></TRow>
              <TRow label="Sản phẩm"><CellVal v={s.products_used} /></TRow>
              <TRow label="Ảnh quá trình">
                <SessionPhotos
                  sessionId={s.id}
                  photos={midPhotos}
                  kind="process"
                  editable={ctStatus === 'ACTIVE'}
                  onChanged={load}
                />
              </TRow>

              <SubHead>Kết quả cuối buổi</SubHead>
              <TRow label="Kết quả"><CellVal v={s.result} /></TRow>
              <TRow label="Ảnh sau">
                <SessionPhotos
                  sessionId={s.id}
                  photos={(photos[s.id] ?? []).filter((p) => p.kind === 'after')}
                  kind="after"
                  editable={ctStatus === 'ACTIVE'}
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
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="scheduled_at" label="Ngày hẹn">
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="staff_id" label="KTV phụ trách">
                <Select allowClear showSearch optionFilterProp="label" options={staffOptions} placeholder="Chọn KTV" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="session_value" label="Giá trị buổi (đ) — dùng cho gói định mức tiền">
            <InputNumber min={0} step={50000} style={{ width: '100%' }} />
          </Form.Item>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>
            ĐẦU BUỔI
          </Divider>
          <Form.Item name="skin_note" label="Tình trạng da">
            <Input.TextArea rows={2} placeholder="VD: da khô, hơi đỏ vùng má..." />
          </Form.Item>
          <Form.Item name="concern" label="Điều cần cải thiện">
            <Input.TextArea rows={2} placeholder="VD: nám vùng gò má, lỗ chân lông to..." />
          </Form.Item>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>
            THỰC HIỆN
          </Divider>
          <Form.Item name="diary" label="Nhật ký buổi làm">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="products_used" label="Sản phẩm đã dùng">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>
            KẾT QUẢ CUỐI BUỔI
          </Divider>
          <Form.Item name="result" label="Kết quả">
            <Input.TextArea rows={2} placeholder="VD: da sáng hơn, khách hài lòng..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function TreatmentCustomers() {
  const [rows, setRows] = useState<CustomerTreatment[]>([])
  const [profiles, setProfiles] = useState<CustomerProfile[]>([])
  const [packages, setPackages] = useState<TreatmentPackage[]>([])
  const [staffOptions, setStaffOptions] = useState<{ value: string; label: string }[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [pkgFilter, setPkgFilter] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [form] = Form.useForm()
  // Modal chi tiết
  const [detail, setDetail] = useState<CustomerTreatment | null>(null)
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [payForm] = Form.useForm()
  const [isAdmin, setIsAdmin] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listCustomerTreatments())
    } catch (err) {
      message.error(bizErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    getMyInfo()
      .then((me: any) => setIsAdmin(!!me?.is_admin))
      .catch(() => undefined)
    listCustomerProfiles({ page: 1, limit: 200 }).then(({ data }) => setProfiles(data)).catch(() => undefined)
    listTreatmentPackages().then(setPackages).catch(() => undefined)
    listUsers({ page: 1, limit: 200 })
      .then((data: any) => {
        setStaffOptions(
          (data?.rows ?? []).map((u: any) => ({ value: u.id, label: u.zalo_name || u.email || u.id })),
        )
      })
      .catch(() => undefined)
  }, [load])

  const profileOf = (id: string) => profiles.find((p) => p.id === id)
  const profileName = (row: CustomerTreatment) =>
    row.customer_profile?.full_name ?? profileOf(row.customer_profile_id)?.full_name ?? 'Khách hàng'
  const packageName = (row: CustomerTreatment) =>
    row.package_type?.name ?? packages.find((p) => p.id === row.package_id)?.name ?? '—'

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (pkgFilter && r.package_id !== pkgFilter) return false
      if (q) {
        const p = profileOf(r.customer_profile_id)
        const hay = `${p?.full_name ?? ''} ${p?.phone ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, filter, pkgFilter, search, profiles])

  const stats = useMemo(() => ({
    total: rows.length,
    ongoing: rows.filter((r) => r.status === 'ACTIVE').length,
    done: rows.filter((r) => r.status === 'FINISHED').length,
    debt: rows.reduce((s, r) => s + Number(r.debt_amount ?? 0), 0),
  }), [rows])

  const openDetail = (row: CustomerTreatment) => {
    setDetail(row)
    setPayLoading(true)
    listTreatmentPayments(row.id)
      .then((data) => setPayments(data as unknown as PaymentRow[]))
      .catch(() => setPayments([]))
      .finally(() => setPayLoading(false))
  }

  const [formLoading, setFormLoading] = useState(false)
  const [customerOptions, setCustomerOptions] = useState<CustomerProfile[]>([])
  const custTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Search khách phía server (BE hỗ trợ ?q=) — debounce 300ms */
  const fetchCustomerOptions = useCallback((q: string) => {
    if (custTimer.current) clearTimeout(custTimer.current)
    custTimer.current = setTimeout(() => {
      listCustomerProfiles({ page: 1, limit: 50, ...(q ? { q } : {}) })
        .then(({ data }) => setCustomerOptions(data))
        .catch(() => undefined)
    }, 300)
  }, [])

  const openModal = () => {
    form.setFieldsValue({ customer_profile_id: undefined, package_id: undefined, total_amount: undefined })
    setOpen(true)
    // Fetch mới mỗi lần mở — gói vừa tạo ở chỗ khác cũng hiện ngay
    setFormLoading(true)
    listTreatmentPackages()
      .then(setPackages)
      .catch(() => undefined)
      .finally(() => setFormLoading(false))
    fetchCustomerOptions('')
  }

  const onPackageChange = (id: string) => {
    const pkg = packages.find((p) => p.id === id)
    if (pkg) form.setFieldsValue({ total_amount: pkg.list_price ?? undefined })
  }

  const submit = async () => {
    const values = await form.validateFields()
    try {
      await createCustomerTreatment(values)
      message.success('Đã thêm khách vào liệu trình')
      setOpen(false)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const addSession = async (row: CustomerTreatment) => {
    try {
      await createTreatmentSession(row.id, {})
      message.success('Đã tạo buổi mới — bấm vào dòng để gán lịch & KTV')
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const cancelTreatment = async (row: CustomerTreatment) => {
    try {
      await cancelCustomerTreatment(row.id)
      message.success('Đã hủy liệu trình')
      if (detail?.id === row.id) setDetail(null)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  const submitPayment = async () => {
    const values = await payForm.validateFields()
    try {
      await createTreatmentPayment(detail!.id, values)
      message.success('Đã ghi nhận thanh toán')
      setPayOpen(false)
      payForm.resetFields()
      openDetail(detail!)
      load()
    } catch (err) {
      message.error(bizErrorMessage(err))
    }
  }

  return (
    <>
      <PageTitle
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
              Thêm khách vào liệu trình
            </Button>
          </Space>
        }
      >
        Khách dùng liệu trình
      </PageTitle>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Tổng lượt đăng ký" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Đang thực hiện" value={stats.ongoing} valueStyle={{ color: 'var(--brand-primary)' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Đã hoàn tất" value={stats.done} valueStyle={{ color: '#16A34A' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card styles={{ body: { padding: '16px 20px' } }}>
            <Statistic title="Tổng công nợ" value={stats.debt} suffix="đ" valueStyle={{ color: '#D97706' }} />
          </Card>
        </Col>
      </Row>

      <Space size={12} style={{ marginBottom: 16 }} wrap>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
          placeholder="Tìm theo tên / SĐT khách"
          style={{ width: 260 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Lọc theo liệu trình"
          style={{ minWidth: 240 }}
          value={pkgFilter}
          onChange={setPkgFilter}
          options={packages.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Segmented options={FILTERS} value={filter} onChange={(v) => setFilter(v as string)} />
      </Space>

      <Table<CustomerTreatment>
        rowKey="id"
        loading={loading}
        dataSource={list}
        onRow={(row) => ({ onClick: () => openDetail(row), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Khách hàng',
            key: 'customer',
            render: (_, row) => {
              const p = profileOf(row.customer_profile_id)
              return (
                <div>
                  <div style={{ fontWeight: 500 }}>{profileName(row)}</div>
                  <div style={{ fontSize: 12, color: '#6F7071' }}>
                    {packageName(row)}{(row.customer_profile?.phone ?? p?.phone) ? ` · ${row.customer_profile?.phone ?? p?.phone}` : ''}
                  </div>
                </div>
              )
            },
          },
          {
            title: 'Tiến độ',
            width: 220,
            render: (_, row) => {
              if (row.quota_type === 'SESSIONS') {
                const total = row.sessions_total ?? 0
                const used = row.sessions_used ?? 0
                if (!total) return <Tag>Chưa cấu hình số buổi</Tag>
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Progress percent={Math.round((used / total) * 100)} size="small" strokeColor="var(--brand-primary)" style={{ flex: 1, margin: 0 }} />
                    <span style={{ fontSize: 12, whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {used}/{total} buổi
                    </span>
                  </div>
                )
              }
              if (row.quota_type === 'VALUE') {
                return <Tag color="gold">Định mức {fmtVnd(row.value_used)}/{fmtVnd(row.value_total)}đ</Tag>
              }
              return <Tag color="gold">Trọn gói</Tag>
            },
          },
          {
            title: 'Thanh toán',
            key: 'payment',
            width: 200,
            render: (_, row) => (
              <div>
                <div style={{ fontSize: 13 }}>
                  {fmtVnd(row.paid_amount)} / {fmtVnd(row.total_amount)}đ
                </div>
                <Tag color={row.debt_amount > 0 ? 'orange' : 'green'} style={{ marginTop: 4 }}>
                  {row.debt_amount > 0 ? `Còn nợ ${fmtVnd(row.debt_amount)}đ` : 'Đã trả đủ'}
                </Tag>
              </div>
            ),
          },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 110,
            render: (v: string) => <Tag color={STATUS_META[v]?.color}>{STATUS_META[v]?.label ?? v}</Tag>,
          },
          {
            title: '',
            width: 240,
            render: (_, row) => (
              <Space onClick={(e) => e.stopPropagation()}>
                {row.status === 'ACTIVE' && (
                  <Button size="small" type="primary" ghost onClick={() => addSession(row)}>
                    +1 buổi
                  </Button>
                )}
                {row.debt_amount > 0 && row.status !== 'CANCELLED' && (
                  <Button
                    size="small"
                    onClick={() => {
                      setDetail(row)
                      payForm.setFieldsValue({ amount: row.debt_amount, method: 'CASH' })
                      setPayOpen(true)
                    }}
                  >
                    Thu tiền
                  </Button>
                )}
                {row.status === 'ACTIVE' && (
                  <Popconfirm title="Hủy liệu trình này?" okText="Hủy" cancelText="Không" onConfirm={() => cancelTreatment(row)}>
                    <Button size="small" danger>
                      Hủy LT
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="Thêm khách vào liệu trình"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
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
              loading={formLoading}
              onChange={onPackageChange}
              options={packages.filter((p) => p.is_active).map((p) => ({
                value: p.id,
                label: `${p.name} (${QUOTA_LABEL[p.quota_type ?? ''] ?? p.quota_type})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="total_amount" label="Số tiền (đ)" rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <InputNumber min={0} step={100000} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Ghi nhận thanh toán"
        open={payOpen}
        onCancel={() => setPayOpen(false)}
        onOk={submitPayment}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={payForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="amount" label="Số tiền (đ)" rules={[{ required: true, message: 'Nhập số tiền' }]}>
            <InputNumber min={1} step={50000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="method" label="Phương thức" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'CASH', label: 'Tiền mặt' },
                { value: 'BANK', label: 'Chuyển khoản' },
                { value: 'POS', label: 'POS' },
                { value: 'OTHER', label: 'Khác' },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal chi tiết — timeline buổi + lịch sử thanh toán */}
      <Modal
        rootClassName="brand-header-modal"
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
              <div className="rail-sticky">
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
                    ? `${detail.sessions_used ?? 0}/${detail.sessions_total ?? 0} buổi`
                    : detail.quota_type === 'VALUE'
                      ? `${fmtVnd(detail.value_used)}/${fmtVnd(detail.value_total)}đ`
                      : 'Trọn gói'}
                </div>
                <Progress
                  percent={detail.progress_percent ?? 0}
                  size="small"
                  style={{ marginTop: 6, marginBottom: 12 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid var(--brand-border-soft)', paddingTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: '#3F4145', fontWeight: 600 }}>Đã trả</span>
                    <b style={{ fontWeight: 700 }}>{fmtVnd(detail.paid_amount)}đ</b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: '#3F4145', fontWeight: 600 }}>Công nợ</span>
                    <b style={{ fontWeight: 700, color: detail.debt_amount > 0 ? '#D97706' : '#16A34A' }}>
                      {fmtVnd(detail.debt_amount)}đ
                    </b>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: '#3F4145', fontWeight: 600 }}>Trạng thái</span>
                    <Tag color={STATUS_META[detail.status ?? '']?.color} style={{ marginInlineEnd: 0 }}>
                      {STATUS_META[detail.status ?? '']?.label ?? detail.status}
                    </Tag>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {detail.status === 'ACTIVE' && detail.quota_type !== 'UNLIMITED' && (
                  <Button block onClick={() => addSession(detail)}>
                    +1 buổi
                  </Button>
                )}
                {detail.status !== 'CANCELLED' && detail.debt_amount > 0 && (
                  <Button
                    block
                    type="primary"
                    onClick={() => {
                      payForm.setFieldsValue({ amount: detail.debt_amount, method: 'CASH' })
                      setPayOpen(true)
                    }}
                  >
                    Thu tiền ({fmtVnd(detail.debt_amount)}đ)
                  </Button>
                )}
                {detail.status === 'ACTIVE' && (
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
                      <SessionTimeline ctId={detail.id} ctStatus={detail.status} staffOptions={staffOptions} isAdmin={isAdmin} onChanged={load} />
                    ),
                  },
                  {
                    key: 'payments',
                    label: 'Lịch sử thanh toán',
                    children: (
                      <Table<PaymentRow>
                        rowKey="id"
                        size="small"
                        loading={payLoading}
                        dataSource={payments}
                        pagination={false}
                        locale={{ emptyText: 'Chưa có lần thanh toán nào' }}
                        columns={[
                          {
                            title: 'Thời gian',
                            key: 'time',
                            width: 170,
                            render: (_, p) => {
                              const t = p.paid_at || p.created_at
                              return t ? dayjs(t).format('DD/MM/YYYY HH:mm') : '—'
                            },
                          },
                          {
                            title: 'Số tiền',
                            dataIndex: 'amount',
                            width: 140,
                            render: (v) => <b>{fmtVnd(v)}đ</b>,
                          },
                          {
                            title: 'Phương thức',
                            dataIndex: 'method',
                            width: 130,
                            render: (v: string) => PAY_METHOD[v] ?? v ?? '—',
                          },
                          { title: 'Ghi chú', dataIndex: 'note', render: (v) => v || '—' },
                        ]}
                      />
                    ),
                  },
                ]}
              />
            </Col>
          </Row>
        )}
      </Modal>
    </>
  )
}
