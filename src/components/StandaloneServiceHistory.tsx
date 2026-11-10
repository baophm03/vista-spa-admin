import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAbility } from '@casl/react'
import { Alert, Button, Divider, Form, Grid, Image, Input, InputNumber, Modal, Progress, Select, Space, Table, Tabs, Tag, Typography, Upload, message } from 'antd'
import type { ReactNode } from 'react'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, EditOutlined, GiftOutlined, PlusOutlined, PrinterOutlined, ProfileOutlined, WalletOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { errorMessage, openHtmlPrint, pickData } from '@/api/helpers'
import { fileSrc, registerUploadedFile, resolveFileSrc, useFileUrlMap } from '@/hooks/useFileUrl'
import { customInstance } from '@/api/mutator/custom-instance'
import { getStandaloneServices } from '@/api/endpoints/standalone-services'
import { getGetRewardRedemptionsQueryKey, getRewardRedemptions } from '@/api/endpoints/rewards'
import { getGetCustomerProfilesIdPointsQueryKey, useGetCustomerProfilesIdPoints } from '@/api/endpoints/customer-profiles'
import type { RewardRedemptionRow } from '@/pages/TreatmentCustomers/components/constants'
import StandaloneServicePromoModal from '@/components/StandaloneServicePromoModal'
import { postFiles } from '@/api/endpoints/files'
import { useGetLookupLists } from '@/api/endpoints/lookup-lists'
import links from '@/configs/links'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import { paginateRows } from '@/utils/listTable'

const SubHead = ({ children }: { children: string }) => (
  <div style={{ padding: '9px 16px', background: 'var(--brand-bg)', borderTop: '1px solid var(--brand-border-soft)', fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--brand-dark)' }}>{children}</div>
)

const TRow = ({ label, children }: { label: string; children: ReactNode }) => (  <div style={{ display: 'flex', padding: '11px 16px', borderTop: '1px solid var(--brand-border-soft)' }}>
    <span style={{ width: 150, flexShrink: 0, fontSize: 13.5, fontWeight: 700, color: '#3F4145', paddingTop: 1, paddingRight: 12 }}>{label}</span>
    <span style={{ flex: 1, minWidth: 0, borderLeft: '1px solid var(--brand-border-soft)', paddingLeft: 16, fontSize: 14.5, fontWeight: 600, color: '#26211F', lineHeight: 1.6, overflowWrap: 'anywhere' }}>{children || <Typography.Text type="secondary">—</Typography.Text>}</span>
  </div>
)

/** Định dạng tiền tệ dùng chung cho khối Ưu đãi & điểm */
const formatMoney = (value: unknown) => `${Number(value ?? 0).toLocaleString('vi-VN')} ₫`

interface StandaloneAppointment {
  id: string
  customer_profile_id: string
  customer_treatment_id?: string | null
  cs_date: string
  start_time: string
  status?: string
  service_amount?: number | string | null
  discount_amount?: number | string | null
  points_used?: number | string | null
  points_discount?: number | string | null
  visit_done_at?: string | null
  skin_note?: string | null
  concern?: string | null
  diary?: string | null
  products_used?: string | null
  result?: string | null
  customer_profile?: { full_name?: string; phone?: string } | null
  service?: { id?: string; title?: string; price?: number | string | null; price_max?: number | string | null } | null
  staff?: { zalo_name?: string } | null
}

/** Query dùng chung cho trang Dịch vụ lẻ — page và component share cache qua key này */
export const STANDALONE_SERVICE_QUERY = {
  queryKey: ['/standaloneServices', 'standalone-service-history'] as const,
  queryFn: () => getStandaloneServices({ page: 1, limit: 200 } as never),
}

/** Lọc các lịch hẹn là dịch vụ lẻ (không gắn gói) */
export const standaloneServiceRows = (data: unknown) =>
  (pickData<StandaloneAppointment[] | undefined>(data) ?? [])
    .filter((row) => !row.customer_treatment_id && ['pending', 'approved', 'in_progress', 'completed'].includes(String(row.status)))

interface VisitPhoto {
  id: string
  url?: string | null
  kind?: 'before' | 'process' | 'after' | null
  caption?: string | null
}

interface VisitPayment {
  id: string
  amount: number | string
  method: string
  paid_at?: string
  voided_at?: string | null
}

const VISIT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Chờ duyệt', color: 'orange' },
  approved: { label: 'Đã duyệt', color: 'purple' },
  in_progress: { label: 'Đang làm', color: 'blue' },
  completed: { label: 'Hoàn tất', color: 'green' },
}

export default function StandaloneServiceHistory({
  focusAppointmentId,
  onFocusConsumed,
  search,
  statusFilter,
}: {
  focusAppointmentId?: string | null
  onFocusConsumed?: () => void
  /** Thanh tìm kiếm & Select trạng thái đã nâng lên page (toolbar chuẩn trong PageTitle) */
  search: string
  statusFilter: string
}) {
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<StandaloneAppointment | null>(null)
  const queryClient = useQueryClient()
  const appointmentsQuery = useQuery(STANDALONE_SERVICE_QUERY)
  const rows = standaloneServiceRows(appointmentsQuery.data)
  const visibleRows = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi-VN')
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!keyword) return true
      const text = [row.customer_profile?.full_name, row.customer_profile?.phone, row.service?.title, row.staff?.zalo_name]
        .filter(Boolean).join(' ').toLocaleLowerCase('vi-VN')
      return text.includes(keyword)
    })
  }, [rows, search, statusFilter])

  useEffect(() => {
    if (!focusAppointmentId || appointmentsQuery.isLoading) return
    const appointment = rows.find((row) => row.id === focusAppointmentId)
    if (appointment) {
      setSelected(appointment)
      onFocusConsumed?.()
    } else {
      void customInstance<any>({ url: `/standaloneServices/${focusAppointmentId}`, method: 'GET' })
        .then((response) => {
          const appointment = pickData<StandaloneAppointment | undefined>(response)
          if (appointment && !appointment.customer_treatment_id) setSelected(appointment)
        })
        .catch((err) => message.error(errorMessage(err)))
        .finally(() => onFocusConsumed?.())
    }
  }, [focusAppointmentId, appointmentsQuery.data, appointmentsQuery.isLoading])

  const ability = useAbility()
  const canEditVisit = ability.can('UPDATE' as never, 'STANDALONE-SERVICE') || ability.can('START' as never, 'STANDALONE-SERVICE')
  const canCompleteVisit = ability.can('APPROVE' as never, 'STANDALONE-SERVICE')
  const [editTargetId, setEditTargetId] = useState<string | null>(null)
  const [completeTargetId, setCompleteTargetId] = useState<string | null>(null)
  // "Ưu đãi & điểm": mở thẳng tab ưu đãi trong hồ sơ lần làm (mirror row action của Liệu trình KH)
  const [promoTargetId, setPromoTargetId] = useState<string | null>(null)
  const promoAvailable = (row: StandaloneAppointment) => !['completed', 'cancelled'].includes(String(row.status))
  // ===== Thu tiền ngay từ list (BE cho thu từ lúc tạo — đặt cọc/chốt giá trước khi làm) =====
  const [payTarget, setPayTarget] = useState<StandaloneAppointment | null>(null)
  const [paySaving, setPaySaving] = useState(false)
  const [payForm] = Form.useForm()
  const canCollectPayment = ability.can('UPDATE' as never, 'STANDALONE-SERVICE')
  const payMethodsQuery = useGetLookupLists({ key: 'payment.methods', items_is_active: 'true' })
  const payMethods = (pickData<Array<{ lookup_items?: Array<{ code: string; label?: string; is_active?: boolean }> }>>(payMethodsQuery.data)?.[0]?.lookup_items ?? []).filter((item) => item.is_active !== false)

  const openPayModal = (row: StandaloneAppointment) => {
    const payable = Math.max(Number(row.service_amount ?? row.service?.price ?? 0) - Number(row.discount_amount || 0) - Number(row.points_discount || 0), 0)
    payForm.resetFields()
    payForm.setFieldsValue({ amount: payable, method: payMethods.find((item) => item.is_active !== false)?.code, note: undefined })
    setPayTarget(row)
  }

  const submitPay = async () => {
    if (!payTarget || paySaving) return
    setPaySaving(true)
    try {
      const values = await payForm.validateFields()
      await customInstance<any>({ url: `/standaloneServices/${payTarget.id}/payments`, method: 'POST', data: values })
      message.success('Đã ghi nhận khoản thu')
      setPayTarget(null)
      await appointmentsQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesIdPointsQueryKey(payTarget.customer_profile_id) })
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setPaySaving(false)
    }
  }

  const printRow = async (row: StandaloneAppointment) => {
    try {
      await openHtmlPrint(`/standaloneServices/${row.id}/print`)
    } catch (err) {
      message.error(errorMessage(err, 'Không mở được phiếu in — kiểm tra setting module.invoice'))
    }
  }

  const columns: TableColumnsType<StandaloneAppointment> = [
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_value, row) => <div><div style={{ fontWeight: 600 }}>{row.customer_profile?.full_name || 'Khách hàng'}</div><Typography.Text type="secondary">{row.customer_profile?.phone || '—'}</Typography.Text></div>,
    },
    { title: 'Dịch vụ', key: 'service', render: (_value, row) => row.service?.title || '—' },
    { title: 'KTV', key: 'staff', render: (_value, row) => row.staff?.zalo_name || 'Chưa gán' },
    { title: 'Thời gian', key: 'time', width: 155, render: (_value, row) => <>{dayjs(row.cs_date).format('DD/MM/YYYY')}<br />{row.start_time?.slice(0, 5)}</> },
    { title: 'Giá dịch vụ', key: 'price', width: 150, render: (_value, row) => {
      const minimum = Number(row.service?.price ?? 0)
      const maximum = Math.max(minimum, Number(row.service?.price_max ?? minimum))
      if (maximum > minimum && ['pending', 'approved'].includes(String(row.status))) {
        return <div><Typography.Text type="secondary">Chưa chốt</Typography.Text><br />{minimum.toLocaleString('vi-VN')}–{maximum.toLocaleString('vi-VN')} ₫</div>
      }
      return `${Number(row.service_amount ?? minimum).toLocaleString('vi-VN')} ₫`
    } },
    { title: 'Trạng thái', key: 'status', width: 120, render: (_value, row) => <Tag color={VISIT_STATUS[String(row.status)]?.color}>{VISIT_STATUS[String(row.status)]?.label || row.status}</Tag> },
    {
      title: 'Hành động', key: 'action', width: 90, align: 'center' as const,
      render: (_value, row) => {
        const inProgress = String(row.status) === 'in_progress'
        return (
          <RowActionsMenu
            items={[
              ...(inProgress && canEditVisit ? [{ key: 'edit', icon: <EditOutlined />, label: 'Chỉnh sửa' }] : []),
              ...(inProgress && canCompleteVisit ? [{
                key: 'complete',
                icon: <CheckCircleOutlined style={{ color: '#159447' }} />,
                label: <span style={{ color: '#159447', fontWeight: 600 }}>Hoàn tất dịch vụ</span>,
              }] : []),
              ...(promoAvailable(row) ? [{ key: 'promo', icon: <GiftOutlined />, label: 'Ưu đãi & điểm' }] : []),
              ...(canCollectPayment && promoAvailable(row) ? [{ key: 'pay', icon: <WalletOutlined />, label: 'Thu tiền' }] : []),
              { key: 'print', icon: <PrinterOutlined />, label: 'In phiếu' },
            ]}
            onSelect={(key) => {
              if (key === 'edit') { setEditTargetId(row.id); setCompleteTargetId(null); setSelected(row) }
              else if (key === 'complete') { setEditTargetId(row.id); setCompleteTargetId(row.id); setSelected(row) }
              else if (key === 'promo') { setPromoTargetId(row.id); setEditTargetId(null); setCompleteTargetId(null); setSelected(row) }
              else if (key === 'pay') openPayModal(row)
              else if (key === 'print') void printRow(row)
            }}
          />
        )
      },
    },
  ]

  return (
    <>
      <Table<StandaloneAppointment>
        className="desktop-only"
        rowKey="id"
        loading={appointmentsQuery.isLoading}
        dataSource={paginateRows(visibleRows, page, 10)}
        columns={columns}
        pagination={false}
        onRow={(row) => ({ onClick: () => setSelected(row), style: { cursor: 'pointer' } })}
        locale={{ emptyText: search ? 'Không tìm thấy dịch vụ lẻ phù hợp' : 'Chưa có khách dùng dịch vụ lẻ' }}
      />
      <MobileCards
        rows={paginateRows(visibleRows, page, 10)}
        rowKey={(row) => row.id}
        onCardClick={(row) => setSelected(row)}
        emptyText={search ? 'Không tìm thấy dịch vụ lẻ phù hợp' : 'Chưa có khách dùng dịch vụ lẻ'}
        renderCard={(row) => {
          const inProgress = String(row.status) === 'in_progress'
          return (
            <>
              <div className="mobile-card-head">
                <div>
                  <div className="mobile-card-title">{row.customer_profile?.full_name || 'Khách hàng'}</div>
                  <div className="mobile-card-sub">{row.customer_profile?.phone || '—'}</div>
                </div>
                <Tag color={VISIT_STATUS[String(row.status)]?.color}>{VISIT_STATUS[String(row.status)]?.label || row.status}</Tag>
              </div>
              <div className="mobile-card-rows">
                <MobileCardRow label="Dịch vụ" value={row.service?.title || '—'} />
                <MobileCardRow label="KTV" value={row.staff?.zalo_name || 'Chưa gán'} />
                <MobileCardRow label="Thời gian" value={`${dayjs(row.cs_date).format('DD/MM/YYYY')} ${row.start_time?.slice(0, 5)}`} />
                <MobileCardRow label="Giá" value={
                  (() => {
                    const minimum = Number(row.service?.price ?? 0)
                    const maximum = Math.max(minimum, Number(row.service?.price_max ?? minimum))
                    if (maximum > minimum && ['pending', 'approved'].includes(String(row.status))) return `Chưa chốt · ${minimum.toLocaleString('vi-VN')}–${maximum.toLocaleString('vi-VN')} ₫`
                    return `${Number(row.service_amount ?? minimum).toLocaleString('vi-VN')} ₫`
                  })()
                } />
              </div>
              <div className="mobile-card-actions">
                {inProgress && canEditVisit && <Button size="small" icon={<EditOutlined />} onClick={() => { setEditTargetId(row.id); setCompleteTargetId(null); setSelected(row) }}>Chỉnh sửa</Button>}
                {inProgress && canCompleteVisit && <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => { setEditTargetId(row.id); setCompleteTargetId(row.id); setSelected(row) }}>Hoàn tất</Button>}
                {promoAvailable(row) && <Button size="small" icon={<GiftOutlined />} onClick={() => { setPromoTargetId(row.id); setEditTargetId(null); setCompleteTargetId(null); setSelected(row) }}>Ưu đãi & điểm</Button>}
                {canCollectPayment && promoAvailable(row) && <Button size="small" icon={<WalletOutlined />} onClick={() => openPayModal(row)}>Thu tiền</Button>}
                <Button size="small" icon={<PrinterOutlined />} onClick={() => void printRow(row)}>In phiếu</Button>
              </div>
            </>
          )
        }}
      />
      <ListPagination page={page} limit={10} total={visibleRows.length} onChange={setPage} noun="lần làm dịch vụ" />
      <Modal
        title={selected ? `${selected.customer_profile?.full_name || 'Khách hàng'} · ${selected.service?.title || 'Dịch vụ lẻ'}` : 'Hồ sơ lần làm dịch vụ'}
        open={!!selected}
        onCancel={() => { setSelected(null); setCompleteTargetId(null); setPromoTargetId(null) }}
        footer={<Button onClick={() => setSelected(null)}>Đóng</Button>}
        width="min(1200px, calc(100vw - 24px))"
        style={{ top: 20 }}
      >
        {selected && <StandaloneServiceVisit autoOpenEdit={selected.id === editTargetId} autoOpenPromo={selected.id === promoTargetId} completeMode={selected.id === completeTargetId} appointment={selected} onUpdated={(updated) => {
          setSelected(updated)
          void appointmentsQuery.refetch()
        }} />}
      </Modal>
      <Modal
        title={payTarget ? `Thu tiền — ${payTarget.customer_profile?.full_name || 'Khách hàng'} · ${payTarget.service?.title || 'Dịch vụ lẻ'}` : 'Thu tiền dịch vụ lẻ'}
        open={!!payTarget}
        onCancel={() => setPayTarget(null)}
        onOk={() => void submitPay()}
        confirmLoading={paySaving}
        okText="Thu tiền"
        cancelText="Hủy"
      >
        <Form form={payForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="amount" label="Số tiền thu" rules={[{ required: true, message: 'Nhập số tiền thu' }]}>
            <InputNumber min={1} precision={0} step={1000} style={{ width: '100%' }} addonAfter="₫" />
          </Form.Item>
          <Form.Item name="method" label="Phương thức thanh toán" rules={[{ required: true, message: 'Chọn phương thức thanh toán' }]}>
            <Select loading={payMethodsQuery.isLoading} placeholder="Chọn phương thức" options={payMethods.map((item) => ({ value: item.code, label: item.label || item.code }))} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input maxLength={255} placeholder="VD: đặt cọc, thu trước…" /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function StandaloneServiceVisit({ appointment, onUpdated, autoOpenEdit, autoOpenPromo, completeMode }: { appointment: StandaloneAppointment; onUpdated: (row: StandaloneAppointment) => void; autoOpenEdit?: boolean; autoOpenPromo?: boolean; completeMode?: boolean }) {
  const ability = useAbility()
  const queryClient = useQueryClient()
  const [record, setRecord] = useState(appointment)
  const [photos, setPhotos] = useState<VisitPhoto[]>([])
  const [payments, setPayments] = useState<VisitPayment[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [activeDetailTab, setActiveDetailTab] = useState('visit')
  const [editForm] = Form.useForm()
  const [paymentForm] = Form.useForm()
  // ===== Ưu đãi & điểm (mirror TreatmentPromoModal của Liệu trình KH) =====
  const [promoOpen, setPromoOpen] = useState(false)
  const [redeemForm] = Form.useForm()
  const [redeemSubmitting, setRedeemSubmitting] = useState(false)
  const [applyingRewardId, setApplyingRewardId] = useState<string | null>(null)
  const photoMethodsQuery = useGetLookupLists({ key: 'payment.methods', items_is_active: 'true' })
  const methodList = pickData<Array<{ is_active?: boolean; lookup_items?: Array<{ code: string; label?: string; is_active?: boolean }> }>>(photoMethodsQuery.data)?.[0]
  const paymentMethods = (methodList?.lookup_items ?? []).filter((item) => item.is_active !== false)
  const editable = ability.can('UPDATE' as never, 'SESSION') || ability.can('START' as never, 'APPOINTMENT')
  const canCollect = ability.can('UPDATE' as never, 'STANDALONE-SERVICE')
  const canReadPayments = ability.can('READ' as never, 'PAYMENT')
  const canComplete = ability.can('APPROVE' as never, 'STANDALONE-SERVICE')
  const serviceAmount = Number(record.service_amount ?? record.service?.price ?? 0)
  // Mức giảm đã áp (quà đổi + điểm thưởng) — trừ khỏi dư nợ, mirror BE recordStandaloneServicePayment
  const visitDiscounts = Number(record.discount_amount || 0) + Number(record.points_discount || 0)
  const paid = payments.filter((payment) => !payment.voided_at).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const due = Math.max(serviceAmount - visitDiscounts - paid, 0)
  const paidPercent = serviceAmount > 0 ? Math.min(100, Math.round(((paid + visitDiscounts) / serviceAmount) * 100)) : 0
  const priceMax = Math.max(Number(record.service?.price_max ?? 0), Number(record.service?.price ?? 0))
  const priceIsRange = priceMax > Number(record.service?.price ?? 0)
  const pricePendingConfirmation = priceIsRange && ['pending', 'approved'].includes(String(record.status))

  useEffect(() => {
    setRecord(appointment)
    setPhotos([])
    setPayments([])
    setActiveDetailTab('visit')
    setEditOpen(!!autoOpenEdit)
    setPromoOpen(!!autoOpenPromo)
    redeemForm.resetFields()
    setPaymentOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([
      customInstance<any>({ url: `/standaloneServices/${appointment.id}/service-record`, method: 'GET' }),
      customInstance<any>({ url: `/standaloneServices/${appointment.id}/photos`, method: 'GET' }),
      customInstance<any>({ url: `/standaloneServices/${appointment.id}/payments`, method: 'GET' }),
    ]).then(([recordResponse, photoResponse, paymentResponse]) => {
      if (!active) return
      const fresh = pickData<StandaloneAppointment | undefined>(recordResponse)
      if (fresh) {
        const merged = {
          ...appointment,
          ...fresh,
          customer_profile: fresh.customer_profile ?? appointment.customer_profile,
          service: fresh.service ?? appointment.service,
          staff: fresh.staff ?? appointment.staff,
        }
        setRecord(merged)
        onUpdated(merged)
        editForm.setFieldsValue({ skin_note: fresh.skin_note ?? '', concern: fresh.concern ?? '', diary: fresh.diary ?? '', products_used: fresh.products_used ?? '', result: fresh.result ?? '' })
      }
      setPhotos(pickData<VisitPhoto[]>(photoResponse) ?? [])
      const freshPayments = pickData<VisitPayment[]>(paymentResponse) ?? []
      setPayments(freshPayments)
      const total = Number(fresh?.service_amount ?? appointment.service_amount ?? appointment.service?.price ?? 0)
      const freshDiscounts = Number(fresh?.discount_amount || 0) + Number(fresh?.points_discount || 0)
      const freshPaid = freshPayments.filter((payment) => !payment.voided_at).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      const methods = pickData<Array<{ lookup_items?: Array<{ code: string; is_active?: boolean }> }>>(photoMethodsQuery.data)?.[0]?.lookup_items ?? []
      paymentForm.setFieldsValue({ amount: Math.max(total - freshDiscounts - freshPaid, 0), method: methods.find((item) => item.is_active !== false)?.code })
    }).catch((err) => { if (active) message.error(errorMessage(err)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [appointment.id, photoMethodsQuery.data])

  const saveVisit = async (markDone = false) => {
    if (saving) return false
    setSaving(true)
    try {
      const values = await editForm.validateFields()
      if (markDone && !String(values.diary ?? '').trim()) {
        message.error('Nhập nhật ký buổi làm trước khi xác nhận đã làm xong')
        return false
      }
      const response = await customInstance<any>({ url: `/standaloneServices/${appointment.id}/service-record`, method: 'PUT', data: { ...values, ...(markDone ? { mark_done: true } : {}) } })
      const fresh = pickData<StandaloneAppointment | undefined>(response)
      if (fresh) { const merged = { ...appointment, ...fresh, customer_profile: fresh.customer_profile ?? appointment.customer_profile, service: fresh.service ?? appointment.service, staff: fresh.staff ?? appointment.staff }; setRecord(merged); onUpdated(merged) }
      message.success(markDone ? 'Đã lưu hồ sơ và xác nhận làm xong' : 'Đã lưu hồ sơ lần làm')
      return true
    } catch (err) {
      if (!(err as { errorFields?: unknown })?.errorFields) message.error(errorMessage(err))
      return false
    } finally { setSaving(false) }
  }

  const saveAndClose = async (markDone = false) => { if (await saveVisit(markDone)) setEditOpen(false) }

  // Chế độ "Hoàn tất dịch vụ" từ danh sách: lưu nhật ký + xác nhận làm xong + hoàn tất luôn
  const finishAndComplete = async () => {
    if (!(await saveVisit(true))) return
    setEditOpen(false)
    await completeVisit()
  }

  const uploadPhoto = async (file: File, kind: 'before' | 'process' | 'after') => {
    try {
      const uploaded = pickData<{ id?: string; path?: string }>(await postFiles({ file }))
      if (!uploaded?.id) throw new Error('Máy chủ không trả về file')
      registerUploadedFile(uploaded.id, uploaded.path)
      const response = await customInstance<any>({ url: `/standaloneServices/${appointment.id}/photos`, method: 'POST', data: { file_id: uploaded.id, kind } })
      const saved = pickData<VisitPhoto | undefined>(response)
      if (!saved?.id) throw new Error('Máy chủ chưa xác nhận ảnh')
      setPhotos((current) => [saved, ...current])
      message.success('Đã lưu ảnh lần làm')
    } catch (err) { message.error(errorMessage(err)) }
  }

  const collectPayment = async () => {
    if (saving) return
    setSaving(true)
    try {
      const values = await paymentForm.validateFields()
      const response = await customInstance<any>({ url: `/standaloneServices/${appointment.id}/payments`, method: 'POST', data: values })
      const saved = pickData<VisitPayment | undefined>(response)
      if (!saved?.id) throw new Error('Máy chủ chưa xác nhận khoản thu')
      const freshPayments = pickData<VisitPayment[]>(await customInstance<any>({ url: `/standaloneServices/${appointment.id}/payments`, method: 'GET' })) ?? []
      setPayments(freshPayments)
      const fresh = pickData<StandaloneAppointment | undefined>(await customInstance<any>({ url: `/standaloneServices/${appointment.id}/service-record`, method: 'GET' }))
      if (fresh) { const merged = { ...appointment, ...fresh, customer_profile: fresh.customer_profile ?? appointment.customer_profile, service: fresh.service ?? appointment.service, staff: fresh.staff ?? appointment.staff }; setRecord(merged); onUpdated(merged) }
      const freshPaid = freshPayments.filter((payment) => !payment.voided_at).reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
      const freshDiscounts = Number(fresh?.discount_amount || 0) + Number(fresh?.points_discount || 0)
      paymentForm.setFieldsValue({ amount: Math.max(Number(fresh?.service_amount ?? record.service_amount ?? 0) - freshDiscounts - freshPaid, 0) })
      setPaymentOpen(false)
      void queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesIdPointsQueryKey(appointment.customer_profile_id) })
      message.success('Đã ghi nhận khoản thu')
    } catch (err) {
      if (!(err as { errorFields?: unknown })?.errorFields) message.error(errorMessage(err))
    } finally { setSaving(false) }
  }

  const completeVisit = async () => {
    setSaving(true)
    try {
      const response = await customInstance<any>({ url: `/standaloneServices/${appointment.id}/complete`, method: 'POST' })
      const fresh = pickData<StandaloneAppointment | undefined>(response)
      if (fresh) { const merged = { ...appointment, ...fresh, customer_profile: fresh.customer_profile ?? appointment.customer_profile, service: fresh.service ?? appointment.service, staff: fresh.staff ?? appointment.staff }; setRecord(merged); onUpdated(merged) }
      message.success('Dịch vụ đã hoàn tất')
    } catch (err) { message.error(errorMessage(err)) } finally { setSaving(false) }
  }

  // ===== Ưu đãi & điểm: dữ liệu + handlers (mirror TreatmentCustomers/page.tsx) =====
  const promoAvailable = !pricePendingConfirmation && !['completed', 'cancelled'].includes(String(record.status))
  const promoPointsQuery = useGetCustomerProfilesIdPoints(record.customer_profile_id, {
    query: { enabled: promoOpen && Boolean(record.customer_profile_id) },
  })
  const promoPointsData = pickData<{
    points?: number
    redemption?: { enabled?: boolean | string; point_value?: number | null; min_percent?: number | null; max_percent?: number | null }
  }>(promoPointsQuery.data)
  const rewardRedemptionsParams = {
    page: 1,
    limit: 100,
    status: 'ISSUED',
    ...(record.customer_profile_id ? { customer_profile_id: record.customer_profile_id } : {}),
  }
  const rewardRedemptionsQuery = useQuery({
    queryKey: getGetRewardRedemptionsQueryKey(rewardRedemptionsParams),
    queryFn: async () => getRewardRedemptions(rewardRedemptionsParams),
    enabled: promoOpen && Boolean(record.customer_profile_id),
  })
  const applicableRewardRedemptions = (pickData<RewardRedemptionRow[]>(rewardRedemptionsQuery.data) ?? []).filter((redemption) => {
    const reward = redemption.reward
    if (redemption.status !== 'ISSUED' || reward?.type !== 'BENEFIT' || Number(reward.benefit_amount ?? 0) <= 0) return false
    return !reward.service_id || String(reward.service_id) === String(record.service?.id)
  })
  const redeemPointsValue = Number(Form.useWatch('points', redeemForm) ?? 0)
  const redeemBalance = Number(promoPointsData?.points ?? 0)
  const pointValue = Number(promoPointsData?.redemption?.point_value)
  const minRedeemPercent = Number(promoPointsData?.redemption?.min_percent)
  const maxRedeemPercent = Number(promoPointsData?.redemption?.max_percent)
  const isPointsEnabled = promoPointsData?.redemption?.enabled === true || promoPointsData?.redemption?.enabled === 'true'
  const redemptionConfigReady = Number.isFinite(pointValue) && pointValue > 0
    && Number.isFinite(minRedeemPercent) && Number.isFinite(maxRedeemPercent)
    && minRedeemPercent <= maxRedeemPercent
  const redeemMoney = redeemPointsValue * pointValue
  const minRedeemMoney = due * minRedeemPercent / 100
  const maxRedeemMoney = due * maxRedeemPercent / 100
  let redeemValidationMessage = ''
  if (redeemPointsValue > 0 && due <= 0) redeemValidationMessage = 'Lượt dịch vụ không còn dư nợ để đổi điểm.'
  else if (redeemPointsValue > redeemBalance) redeemValidationMessage = `Khách chỉ còn ${redeemBalance.toLocaleString('vi-VN')} điểm.`
  else if (redeemPointsValue > 0 && redemptionConfigReady && redeemMoney < minRedeemMoney) {
    redeemValidationMessage = `Giá trị đổi thấp hơn mức tối thiểu ${formatMoney(minRedeemMoney)}.`
  } else if (redeemPointsValue > 0 && redemptionConfigReady && redeemMoney > maxRedeemMoney) {
    redeemValidationMessage = `Giá trị đổi vượt mức tối đa ${formatMoney(maxRedeemMoney)}.`
  }
  const canSubmitRedeem = promoPointsQuery.isSuccess && isPointsEnabled && redemptionConfigReady && promoAvailable
    && redeemPointsValue > 0 && Number.isInteger(redeemPointsValue)
    && redeemPointsValue <= redeemBalance && due > 0
    && redeemMoney >= minRedeemMoney && redeemMoney <= maxRedeemMoney
  const canApplyReward = ability.can('REDEEM_ADMIN' as never, 'REWARD' as never) && ability.can('READ' as never, 'DISCOUNT' as never)

  /** Sau khi BE áp ưu đãi: tải lại hồ sơ lần làm để cập nhật discount/points và dư nợ */
  const refreshAfterPromo = async () => {
    const fresh = pickData<StandaloneAppointment | undefined>(
      await customInstance<any>({ url: `/standaloneServices/${appointment.id}/service-record`, method: 'GET' }),
    )
    if (fresh) {
      const merged = {
        ...appointment,
        ...fresh,
        customer_profile: fresh.customer_profile ?? appointment.customer_profile,
        service: fresh.service ?? appointment.service,
        staff: fresh.staff ?? appointment.staff,
      }
      setRecord(merged)
      onUpdated(merged)
    }
  }

  const openPromo = () => {
    redeemForm.resetFields()
    setPromoOpen(true)
  }

  const submitRedeemPoints = async () => {
    if (!canSubmitRedeem || redeemSubmitting) return
    try {
      const values = await redeemForm.validateFields()
      setRedeemSubmitting(true)
      await customInstance({ url: `/standaloneServices/${appointment.id}/redeem-points`, method: 'POST', data: { points: values.points } })
      message.success('Đã trừ điểm vào lượt dịch vụ')
      redeemForm.resetFields()
      await refreshAfterPromo()
      await promoPointsQuery.refetch()
      void queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesIdPointsQueryKey(appointment.customer_profile_id) })
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setRedeemSubmitting(false)
    }
  }

  const confirmApplyReward = (redemption: RewardRedemptionRow) => {
    const reward = redemption.reward
    if (!reward?.benefit_amount || applyingRewardId) return
    Modal.confirm({
      title: 'Áp dụng quà vào lượt dịch vụ?',
      content: `Giảm ${formatMoney(reward.benefit_amount)} vào dư nợ lượt dịch vụ “${record.service?.title || 'Dịch vụ lẻ'}” và đánh dấu lượt đổi đã dùng. Thao tác này không thể hoàn tác.`,
      okText: 'Áp dụng quà',
      cancelText: 'Hủy',
      onOk: async () => {
        setApplyingRewardId(redemption.id)
        try {
          await customInstance({ url: `/standaloneServices/${appointment.id}/apply-reward`, method: 'POST', data: { redemption_id: redemption.id } })
          message.success(`Đã trừ ${formatMoney(reward.benefit_amount)} khỏi dư nợ và ghi nhận quà đã dùng`)
          await refreshAfterPromo()
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

  const urlMap = useFileUrlMap()
  const photoSrc = (url?: string | null) => (!url ? '' : /^https?:\/\//i.test(url) ? url : `${links.imageEndpoint}${url}`)
  const photoSrcOf = (photo: VisitPhoto) =>
    fileSrc((photo as any).file) ?? resolveFileSrc(urlMap, (photo as any).file_id) ?? photoSrc((photo as any).url)
  const photoRow = (kind: 'before' | 'process' | 'after', label: string) => {
    const rows = photos.filter((photo) => photo.kind === kind && photoSrcOf(photo))
    return (
      <TRow key={kind} label={label}>
        <Space wrap size={10}>
          {rows.length > 0 && <Image.PreviewGroup items={rows.map((photo) => photoSrcOf(photo)!)}>{rows.map((photo) => <Image key={photo.id} src={photoSrcOf(photo) ?? undefined} width={88} height={88} style={{ objectFit: 'cover', borderRadius: 10 }} />)}</Image.PreviewGroup>}
          {editable && record.status === 'in_progress' && <Upload accept="image/*" multiple showUploadList={false} beforeUpload={(file) => { void uploadPhoto(file, kind); return false }}><Button icon={<PlusOutlined />}>Ảnh</Button></Upload>}
          {!rows.length && !(editable && record.status === 'in_progress') && <Typography.Text type="secondary">{loading ? 'Đang tải ảnh…' : 'Chưa có ảnh'}</Typography.Text>}
        </Space>
      </TRow>
    )
  }

  const printReceipt = async () => {
    try {
      await openHtmlPrint(`/standaloneServices/${appointment.id}/print`)
    } catch (err) {
      message.error(errorMessage(err, 'Không mở được phiếu in — kiểm tra setting module.invoice'))
    }
  }

  const scheduledAt = dayjs(`${String(record.cs_date).slice(0, 10)}T${record.start_time?.slice(0, 5)}`)
  const canFinalize = record.status === 'in_progress' && !!record.visit_done_at && paid + visitDiscounts >= serviceAmount && canComplete && scheduledAt.isBefore(dayjs())

  // Mobile (dưới breakpoint md): chuyển vùng nội dung bằng Select; desktop/tablet dùng Tabs
  const isMobile = !Grid.useBreakpoint().md

  // Nội dung các tab — dùng chung cho Tabs (desktop) và Select (mobile), mỗi bề width chỉ render một dạng
  const paymentsPanel = isMobile ? (
    <MobileCards
      rows={payments}
      rowKey={(row) => row.id}
      emptyText="Chưa có khoản thu dịch vụ"
      renderCard={(row) => (
        <>
          <div className="mobile-card-head">
            <div className="mobile-card-title">{Number(row.amount).toLocaleString('vi-VN')} ₫</div>
            <Tag color={row.voided_at ? 'red' : 'green'}>{row.voided_at ? 'Đã hủy' : 'Đã thu'}</Tag>
          </div>
          <div className="mobile-card-rows">
            <MobileCardRow label="Thời gian" value={row.paid_at ? dayjs(row.paid_at).format('DD/MM/YYYY HH:mm') : '—'} />
            <MobileCardRow label="Phương thức" value={row.method || '—'} />
          </div>
        </>
      )}
    />
  ) : (
    <Table<VisitPayment>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={payments}
      locale={{ emptyText: 'Chưa có khoản thu dịch vụ' }}
      columns={[
        { title: 'Thời gian', dataIndex: 'paid_at', render: (value?: string) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—' },
        { title: 'Số tiền', dataIndex: 'amount', align: 'right', render: (value: number | string) => `${Number(value).toLocaleString('vi-VN')} ₫` },
        { title: 'Phương thức', dataIndex: 'method' },
        { title: 'Trạng thái', key: 'status', render: (_value, row) => <Tag color={row.voided_at ? 'red' : 'green'}>{row.voided_at ? 'Đã hủy' : 'Đã thu'}</Tag> },
      ]}
    />
  )

  const visitPanel = (
    <div style={{ border: '1px solid var(--brand-border)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '13px 16px', background: 'var(--brand-bg)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', border: '1px solid var(--brand-border)' }}>
          <ProfileOutlined style={{ fontSize: 18 }} />
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Space size={8} wrap>
            <Typography.Text strong>{dayjs(record.cs_date).format('DD/MM/YYYY')} · {record.start_time?.slice(0, 5)}</Typography.Text>
            <Tag color={record.status === 'completed' ? 'green' : record.visit_done_at ? 'orange' : 'blue'}>{record.status === 'completed' ? 'Hoàn tất' : record.visit_done_at ? 'KTV đã làm xong' : 'Đang thực hiện'}</Tag>
          </Space>
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 3 }}>{record.service?.title || 'Dịch vụ lẻ'} · {record.staff?.zalo_name || 'Chưa gán KTV'}</Typography.Text>
        </div>
        {record.status === 'in_progress' && editable && <Button icon={<EditOutlined />} loading={loading} disabled={loading} onClick={() => setEditOpen(true)}>Sửa</Button>}
        {canFinalize && <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} onClick={() => void completeVisit()}>Hoàn tất dịch vụ</Button>}
      </div>
      {!pricePendingConfirmation && <TRow label="Giá dịch vụ">{serviceAmount.toLocaleString('vi-VN')} ₫</TRow>}
      <SubHead>Thông tin ban đầu</SubHead>
      <TRow label="Tình trạng da"><span style={{ whiteSpace: 'pre-wrap' }}>{record.skin_note || 'Chưa ghi'}</span></TRow>
      <TRow label="Cần cải thiện"><span style={{ whiteSpace: 'pre-wrap' }}>{record.concern || 'Chưa ghi'}</span></TRow>
      {photoRow('before', 'Ảnh trước')}
      <SubHead>Thực hiện</SubHead>
      <TRow label="Nhật ký"><span style={{ whiteSpace: 'pre-wrap' }}>{record.diary || 'Chưa ghi'}</span></TRow>
      <TRow label="Sản phẩm đã dùng"><span style={{ whiteSpace: 'pre-wrap' }}>{record.products_used || 'Chưa ghi'}</span></TRow>
      {photoRow('process', 'Ảnh quá trình')}
      <SubHead>Kết quả</SubHead>
      <TRow label="Kết quả / dặn dò"><span style={{ whiteSpace: 'pre-wrap' }}>{record.result || 'Chưa ghi'}</span></TRow>
      {photoRow('after', 'Ảnh sau')}
    </div>
  )
  const pointsPanel = <ServicePointsHistory profileId={record.customer_profile_id} />

  return (
    <>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Cố định rail trái: scroll cột phải thì aside đứng yên (trừ mobile xếp chồng) */}
        <aside style={{ flex: '1 1 260px', maxWidth: 330, padding: 18, border: '1px solid var(--brand-border)', borderRadius: 14, background: 'var(--brand-bg)', ...(isMobile ? {} : { position: 'sticky', top: 0, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto' } as const) }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.2 }}>{pricePendingConfirmation ? 'GIÁ CHƯA CHỐT' : 'THANH TOÁN DỊCH VỤ'}</Typography.Text>
          <Typography.Title level={4} style={{ margin: '5px 0 14px' }}>{record.service?.title || 'Dịch vụ lẻ'}</Typography.Title>
          {pricePendingConfirmation ? (
            <div style={{ padding: '8px 0 12px' }}>
              <Typography.Text type="secondary">Khoảng giá</Typography.Text>
              <Typography.Title level={5} style={{ margin: '3px 0' }}>{Number(record.service?.price ?? 0).toLocaleString('vi-VN')}–{priceMax.toLocaleString('vi-VN')} ₫</Typography.Title>
              <Typography.Text type="secondary">Lễ tân chốt giá khi bắt đầu lịch.</Typography.Text>
            </div>
          ) : (
            <>
              <Progress percent={paidPercent} size="small" showInfo={false} strokeColor="var(--brand-primary)" />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                <span>Đã thu</span><strong>{paid.toLocaleString('vi-VN')} / {serviceAmount.toLocaleString('vi-VN')} ₫</strong>
              </div>
            </>
          )}
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ display: 'grid', gap: 9, fontSize: 13.5 }}>
            {!pricePendingConfirmation && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Còn phải thu</span><strong style={{ color: due > 0 ? '#D97706' : '#159447' }}>{due.toLocaleString('vi-VN')} ₫</strong></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}><span>Trạng thái</span><Tag color={VISIT_STATUS[String(record.status)]?.color}>{VISIT_STATUS[String(record.status)]?.label || record.status}</Tag></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Ngày hẹn</span><strong>{dayjs(record.cs_date).format('DD/MM/YYYY')} · {record.start_time?.slice(0, 5)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>KTV</span><strong style={{ textAlign: 'right' }}>{record.staff?.zalo_name || 'Chưa gán'}</strong></div>
          </div>
          {canCollect && record.status === 'in_progress' && due > 0 && (
            <Button type="primary" block style={{ marginTop: 16 }} onClick={() => {
              const methods = pickData<Array<{ lookup_items?: Array<{ code: string; is_active?: boolean }> }>>(photoMethodsQuery.data)?.[0]?.lookup_items ?? []
              paymentForm.resetFields()
              paymentForm.setFieldsValue({ amount: due, method: methods.find((item) => item.is_active !== false)?.code, note: undefined })
              setPaymentOpen(true)
            }}>
              Thu tiền ({due.toLocaleString('vi-VN')} ₫)
            </Button>
          )}
          {promoAvailable && (
            <Button block icon={<GiftOutlined />} style={{ marginTop: 10 }} onClick={openPromo}>Ưu đãi & điểm</Button>
          )}
          {canReadPayments && !pricePendingConfirmation && <Button block style={{ marginTop: 10 }} onClick={() => void printReceipt()}>In phiếu</Button>}
        </aside>

        {/* Vùng chính: desktop/tablet dùng Tabs, mobile dùng Select — render theo bề width, không ẩn bằng CSS */}
        <div style={{ flex: '3 1 560px', minWidth: 0 }}>
          {isMobile ? (
            <>
              <Select
                style={{ width: '100%', marginBottom: 12 }}
                value={activeDetailTab}
                onChange={setActiveDetailTab}
                options={[
                  { value: 'visit', label: 'Thông tin dịch vụ' },
                  { value: 'payments', label: 'Lịch sử thanh toán' },
                  { value: 'points', label: 'Điểm thưởng' },
                ]}
              />
              {activeDetailTab === 'visit' && visitPanel}
              {activeDetailTab === 'payments' && paymentsPanel}
              {activeDetailTab === 'points' && pointsPanel}
            </>
          ) : (
            <Tabs
              activeKey={activeDetailTab}
              onChange={setActiveDetailTab}
              items={[
                { key: 'visit', label: 'Thông tin dịch vụ', children: visitPanel },
                { key: 'payments', label: 'Lịch sử thanh toán', children: paymentsPanel },
                { key: 'points', label: 'Điểm thưởng', children: pointsPanel },
              ]}
            />
          )}
        </div>
      </div>
      <Modal
        title="Thu tiền dịch vụ lẻ"
        open={paymentOpen}
        onCancel={() => setPaymentOpen(false)}
        onOk={() => void collectPayment()}
        confirmLoading={saving}
        okButtonProps={{ disabled: !paymentMethods.length }}
        okText="Thu tiền"
        cancelText="Hủy"
      >
        <Typography.Text type="secondary">{record.customer_profile?.full_name || 'Khách hàng'} · {record.service?.title || 'Dịch vụ lẻ'}</Typography.Text>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, margin: '12px 0 4px' }}>
          <Typography.Text>Còn phải thu</Typography.Text>
          <Typography.Text strong>{due.toLocaleString('vi-VN')} ₫</Typography.Text>
        </div>
        <Form form={paymentForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="amount" label="Số tiền thu" rules={[{ required: true, message: 'Nhập số tiền thu' }]}>
            <InputNumber min={1} max={due} precision={0} step={1000} style={{ width: '100%' }} addonAfter="₫" />
          </Form.Item>
          <Form.Item name="method" label="Phương thức thanh toán" rules={[{ required: true, message: 'Chọn phương thức thanh toán' }]}>
            <Select loading={photoMethodsQuery.isLoading} placeholder="Chọn phương thức" options={paymentMethods.map((item) => ({ value: item.code, label: item.label || item.code }))} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input maxLength={255} placeholder="Không bắt buộc" /></Form.Item>
          {!paymentMethods.length && <Alert type="warning" showIcon message="Chưa có phương thức thanh toán đang bật." />}
        </Form>
      </Modal>
      <Modal
        title={completeMode && !record.visit_done_at ? 'Nhật ký buổi làm — Hoàn tất dịch vụ' : 'Sửa thông tin buổi dịch vụ lẻ'}
        width="min(720px, calc(100vw - 24px))"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={completeMode && !record.visit_done_at
          ? <Space wrap>
              <Button onClick={() => setEditOpen(false)}>Hủy</Button>
              <Button loading={saving} onClick={() => void saveAndClose(false)}>Lưu</Button>
              <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} onClick={() => void finishAndComplete()}>Xong</Button>
            </Space>
          : <Space wrap><Button onClick={() => setEditOpen(false)}>Hủy</Button><Button loading={saving} onClick={() => void saveAndClose(false)}>Lưu</Button>{!record.visit_done_at && <Button type="primary" icon={<CheckCircleOutlined />} loading={saving} onClick={() => void saveAndClose(true)}>Lưu và xác nhận đã làm xong</Button>}</Space>}
      >
        <Typography.Text type="secondary" style={{ display: 'block', margin: '4px 0 16px' }}>{record.customer_profile?.full_name || 'Khách hàng'} · {record.service?.title || 'Dịch vụ lẻ'} · {dayjs(record.cs_date).format('DD/MM/YYYY')} {record.start_time?.slice(0, 5)}</Typography.Text>
        <Form form={editForm} layout="vertical" disabled={!editable || record.status !== 'in_progress'}>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>THÔNG TIN BAN ĐẦU</Divider>
          <Form.Item name="skin_note" label="Tình trạng da"><Input.TextArea rows={3} maxLength={10000} placeholder="VD: da khô, hơi đỏ vùng má…" /></Form.Item>
          <Form.Item name="concern" label="Điều cần cải thiện"><Input.TextArea rows={3} maxLength={10000} placeholder="VD: nám, mụn viêm, lỗ chân lông…" /></Form.Item>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>THỰC HIỆN</Divider>
          <Form.Item name="diary" label="Nhật ký buổi làm"><Input.TextArea rows={3} maxLength={10000} placeholder="Các bước đã thực hiện, phản ứng của khách…" /></Form.Item>
          <Form.Item name="products_used" label="Sản phẩm đã dùng"><Input.TextArea rows={2} maxLength={10000} placeholder="Tên sản phẩm hoặc ghi chú sản phẩm" /></Form.Item>
          <Divider plain style={{ fontSize: 11, color: '#A9ADB2', letterSpacing: 1, margin: '4px 0 14px' }}>KẾT QUẢ / DẶN DÒ</Divider>
          <Form.Item name="result" label="Kết quả / dặn dò sau buổi"><Input.TextArea rows={3} maxLength={10000} placeholder="Kết quả quan sát được, cách chăm sóc tại nhà…" /></Form.Item>
          {!record.visit_done_at && <Alert type="info" showIcon message={completeMode ? 'Điền đầy đủ nhật ký rồi bấm Xong để hoàn tất dịch vụ.' : 'KTV xác nhận xong phần làm tại đây. Lễ tân cần thu đủ tiền rồi mới hoàn tất lịch hẹn.'} />}
        </Form>
      </Modal>
      <StandaloneServicePromoModal
        open={promoOpen}
        row={record}
        formatMoney={formatMoney}
        redeemForm={redeemForm}
        pointsLoading={promoPointsQuery.isLoading}
        pointsError={promoPointsQuery.isError}
        pointsLoaded={promoPointsQuery.isSuccess}
        pointsErrorMessage={promoPointsQuery.isError ? errorMessage(promoPointsQuery.error) : ''}
        isPointsEnabled={isPointsEnabled}
        redemptionConfigReady={redemptionConfigReady}
        redeemBalance={redeemBalance}
        redeemPointsValue={redeemPointsValue}
        redeemMoney={redeemMoney}
        pointValue={pointValue}
        minRedeemMoney={minRedeemMoney}
        maxRedeemMoney={maxRedeemMoney}
        minRedeemPercent={minRedeemPercent}
        maxRedeemPercent={maxRedeemPercent}
        redeemDebt={due}
        redeemValidationMessage={redeemValidationMessage}
        canSubmitRedeem={canSubmitRedeem}
        redeemSubmitting={redeemSubmitting}
        onRedeemPoints={() => void submitRedeemPoints()}
        rewardsLoading={rewardRedemptionsQuery.isLoading}
        rewardsError={rewardRedemptionsQuery.isError}
        rewardsErrorMessage={rewardRedemptionsQuery.isError ? errorMessage(rewardRedemptionsQuery.error) : ''}
        applicableRewardRedemptions={applicableRewardRedemptions}
        canApplyReward={canApplyReward}
        applyingRewardId={applyingRewardId}
        onApplyReward={confirmApplyReward}
        onCancel={() => setPromoOpen(false)}
      />
    </>
  )
}

interface CustomerPointHistoryRow {
  id?: string
  trans_code?: string
  created_at?: string
  trans_date?: string
  ref_type?: string
  points_earned?: number
  reason?: string | null
}

function ServicePointsHistory({ profileId }: { profileId: string }) {
  const pointsQuery = useGetCustomerProfilesIdPoints(profileId)
  const data = pickData<{
    points?: number
    history?: CustomerPointHistoryRow[]
    redemption?: { enabled?: boolean }
  }>(pointsQuery.data)
  const rows = data?.history ?? []
  const [pointPage, setPointPage] = useState(1)
  const typeLabels: Record<string, string> = {
    PAYMENT: 'Thanh toán',
    MANUAL: 'Chỉnh tay',
    RANK: 'Xét hạng',
    REWARD: 'Đổi quà',
    WHEEL: 'Quay số',
    REDEEM: 'Đổi tiền gói',
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Điểm hiện có</Typography.Text>
        <Typography.Title level={3} style={{ margin: '2px 0 0' }}>
          {pointsQuery.isError ? '—' : pointsQuery.isLoading ? '…' : Number(data?.points ?? 0).toLocaleString('vi-VN')}
        </Typography.Title>
      </div>
      {data?.redemption?.enabled === false && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Cơ chế điểm thưởng đang tắt trong Cài đặt hệ thống." />}
      {pointsQuery.isLoading ? (
        <Typography.Text type="secondary">Đang tải lịch sử điểm…</Typography.Text>
      ) : pointsQuery.isError ? (
        <Alert type="error" showIcon message="Không tải được lịch sử điểm" description={errorMessage(pointsQuery.error)} />
      ) : rows.length === 0 ? (
        <Typography.Text type="secondary">Chưa có biến động điểm nào.</Typography.Text>
      ) : (
        <>
          <Table<CustomerPointHistoryRow>
            rowKey={(row) => String(row.id ?? row.trans_code ?? row.trans_date)}
            size="small"
            dataSource={paginateRows(rows, pointPage, 8)}
            pagination={false}
            columns={[
              { title: 'Thời gian', key: 'time', width: 150, render: (_value, row) => row.created_at ? dayjs(row.created_at).format('DD/MM/YYYY HH:mm') : row.trans_date ? dayjs(row.trans_date).format('DD/MM/YYYY') : '—' },
              { title: 'Loại', dataIndex: 'ref_type', width: 130, render: (value: string) => typeLabels[value] ?? value ?? '—' },
              { title: 'Điểm', dataIndex: 'points_earned', width: 90, render: (value: number) => <Typography.Text type={Number(value) >= 0 ? 'success' : 'danger'}>{Number(value) >= 0 ? '+' : ''}{Number(value || 0)}</Typography.Text> },
              { title: 'Lý do', dataIndex: 'reason', render: (value: string | null) => value || '—' },
            ]}
          />
          <ListPagination page={pointPage} limit={8} total={rows.length} onChange={setPointPage} noun="biến động điểm" />
        </>
      )}
    </div>
  )
}
