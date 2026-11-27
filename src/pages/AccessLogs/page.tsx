import ResponsiveTable from '@/components/base/ResponsiveTable'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Descriptions, Form, Input, Modal, Select, Space, Spin, Tabs, Tag, Typography, message } from 'antd'
import { FilterOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

import MobileUI from '@/components/base/MobileUI'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import ListPagination from '@/components/base/ListPagination'
import TableEmpty from '@/components/base/TableEmpty'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { apiClient } from '@/api/mutator/custom-instance'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import type { Branch } from '@/api/models/branch'
import { useBrandDateTime } from '@/themeRuntime'
import { useProfileStore } from '@/stores/profile-store'

type Category = 'BUSINESS' | 'DATA_ACCESS' | 'SECURITY' | 'SYSTEM'
type Outcome = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'DENIED'
type Source = 'ADMIN' | 'MINI_APP' | 'SYSTEM' | 'INTEGRATION'

interface AuditChange {
  field: string
  from?: string | null
  to?: string | null
}

interface AuditEvent {
  id: string
  created_at: string
  category: Category
  module: string
  event_code: string
  outcome: Outcome
  actor_id?: string | null
  actor_name?: string | null
  actor_label?: string | null
  actor_type: string
  source: Source
  branch_id?: string | null
  branch_name?: string | null
  target_type?: string | null
  target_id?: string | null
  customer_id?: string | null
  customer_name?: string | null
  customer_code?: string | null
  summary: string
  changes?: AuditChange[]
  reason_code?: string | null
  business_reason?: string | null
  correlation_id?: string | null
  ip?: string | null
  is_legacy?: boolean
  metadata?: Record<string, unknown>
}

interface AuditQuery {
  page: number
  limit: number
  category?: Category
  module?: string
  event_code?: string
  outcome?: Outcome
  source?: Source
  branch_id?: string
  q?: string
  from?: string
  to?: string
}

interface AuditResponse {
  data: AuditEvent[]
  meta?: { page?: number; limit?: number; total?: number }
}

interface DetailResponse {
  data: AuditEvent
}

const CATEGORY_LABEL: Record<Category, string> = {
  BUSINESS: 'Thay đổi nghiệp vụ',
  DATA_ACCESS: 'Truy cập dữ liệu',
  SECURITY: 'Bảo mật & phân quyền',
  SYSTEM: 'Tác vụ hệ thống',
}

const OUTCOME_META: Record<Outcome, { label: string; color: string }> = {
  SUCCESS: { label: 'Thành công', color: 'green' },
  PARTIAL: { label: 'Một phần', color: 'orange' },
  FAILED: { label: 'Thất bại', color: 'red' },
  DENIED: { label: 'Bị từ chối', color: 'volcano' },
}

const SOURCE_LABEL: Record<Source, string> = {
  ADMIN: 'Quản trị',
  MINI_APP: 'Mini App',
  SYSTEM: 'Hệ thống',
  INTEGRATION: 'Tích hợp',
}

const MODULE_LABEL: Record<string, string> = {
  ACCESS_CONTROL: 'Phân quyền', APPOINTMENT: 'Lịch hẹn', AUTH: 'Đăng nhập', ACADEMY_COURSE: 'Khóa học',
  ACADEMY_REGISTRATION: 'Đăng ký học viên', BRANCH: 'Cơ sở', CARD_RANK: 'Hạng thẻ',
  COMMISSION: 'Hoa hồng', CONTENT: 'Nội dung App', CUSTOMER: 'Hồ sơ khách hàng', CUSTOMER_PROFILE: 'Hồ sơ khách hàng',
  CUSTOM_FIELD: 'Dữ liệu khách hàng', DISCOUNT: 'Ưu đãi', HEALTH_METRIC: 'Chỉ số sức khỏe',
  HEALTH_RECORD: 'Hồ sơ sức khỏe', IMPORT: 'Nhập dữ liệu', INVOICE: 'Hóa đơn', LOOKUP: 'Danh mục',
  IMPORT_JOB: 'Lượt nhập', SYSTEM_JOB: 'Tác vụ hệ thống',
  LUCKY_WHEEL: 'Vòng quay may mắn', MEMBERSHIP: 'Hội viên', NOTIFICATION: 'Thông báo',
  PAYMENT: 'Thanh toán', PRODUCT: 'Sản phẩm', PRODUCT_ORDER: 'Đơn hàng', REWARD: 'Quà & lượt đổi',
  SERVICE: 'Dịch vụ', SETTING: 'Cấu hình', STAFF: 'Tài khoản nhân viên', STAFF_SCHEDULE: 'Lịch làm việc KTV',
  TREATMENT: 'Liệu trình khách hàng', TREATMENT_PACKAGE: 'Gói liệu trình', TREATMENT_SESSION: 'Buổi điều trị',
  VOUCHER: 'Voucher', WARRANTY_CLAIM: 'Bảo hành', REFERRAL: 'Giới thiệu', FAVORITE: 'Yêu thích',
  SUPPORT: 'Hỗ trợ', FILE: 'Tệp', INTEGRATION: 'Tích hợp', PRODUCT_CATEGORY: 'Danh mục sản phẩm',
  SERVICE_CATEGORY: 'Danh mục dịch vụ', SCREENING: 'Sàng lọc',
}

const EVENT_OPTIONS = [
  { value: 'APPOINTMENT.CREATED', label: 'Lịch hẹn mới' },
  { value: 'APPOINTMENT.UPDATED', label: 'Cập nhật lịch hẹn' },
  { value: 'APPOINTMENT.APPROVED', label: 'Duyệt lịch hẹn' },
  { value: 'APPOINTMENT.REJECTED', label: 'Từ chối lịch hẹn' },
  { value: 'APPOINTMENT.CANCELLED', label: 'Hủy lịch hẹn' },
  { value: 'APPOINTMENT.COMPLETED', label: 'Hoàn tất lịch hẹn' },
  { value: 'CUSTOMER.CREATED', label: 'Tạo hồ sơ khách hàng' },
  { value: 'CUSTOMER.UPDATED', label: 'Cập nhật hồ sơ khách hàng' },
  { value: 'CUSTOMER.DELETED', label: 'Xóa hồ sơ khách hàng' },
  { value: 'CUSTOMER.VIEWED', label: 'Xem hồ sơ khách hàng' },
  { value: 'CUSTOMER.EXPORTED', label: 'Xuất hồ sơ khách hàng' },
  { value: 'CUSTOMER.QR_LOOKUP', label: 'Tra cứu khách bằng QR' },
  { value: 'CUSTOMER.QR_REVEALED', label: 'Hiển thị mã QR khách hàng' },
  { value: 'HEALTH_RECORD.VIEWED', label: 'Xem hồ sơ sức khỏe' },
  { value: 'HEALTH_METRIC.VIEWED', label: 'Xem chỉ số sức khỏe' },
  { value: 'PAYMENT.CREATED', label: 'Ghi nhận thanh toán' },
  { value: 'PAYMENT.VOIDED', label: 'Hủy thanh toán' },
  { value: 'MEMBERSHIP.UPDATED', label: 'Cập nhật hội viên' },
  { value: 'TREATMENT_SESSION.CREATED', label: 'Tạo buổi điều trị' },
  { value: 'TREATMENT_SESSION.VIEWED', label: 'Xem buổi điều trị' },
  { value: 'TREATMENT_SESSION.LIST_VIEWED', label: 'Xem danh sách buổi điều trị' },
  { value: 'TREATMENT_SESSION.CUSTOMER_HISTORY_VIEWED', label: 'Xem lịch sử điều trị của khách' },
  { value: 'TREATMENT_SESSION.PHOTOS_VIEWED', label: 'Xem ảnh buổi điều trị' },
  { value: 'TREATMENT_SESSION.REOPENED', label: 'Mở lại buổi điều trị' },
  { value: 'TREATMENT_EXPIRY_JOB.COMPLETED', label: 'Rà soát liệu trình hết hạn thành công' },
  { value: 'TREATMENT_EXPIRY_JOB.FAILED', label: 'Rà soát liệu trình hết hạn thất bại' },
  { value: 'ACCESS_CONTROL.CREATED', label: 'Tạo vai trò' },
  { value: 'ACCESS_CONTROL.UPDATED', label: 'Cập nhật vai trò' },
  { value: 'ACCESS_CONTROL.PERMISSIONS_CHANGED', label: 'Thay đổi quyền' },
  { value: 'STAFF.CREATED', label: 'Tạo tài khoản nhân viên' },
  { value: 'STAFF.UPDATED', label: 'Cập nhật tài khoản nhân viên' },
  { value: 'IMPORT_JOB.COMPLETED', label: 'Nhập dữ liệu thành công' },
  { value: 'IMPORT_JOB.FAILED', label: 'Nhập dữ liệu thất bại' },
  { value: 'APPOINTMENT_REMINDERS.COMPLETED', label: 'Gửi nhắc lịch hẹn thành công' },
  { value: 'APPOINTMENT_REMINDERS.FAILED', label: 'Gửi nhắc lịch hẹn thất bại' },
  { value: 'APPOINTMENT_EXPIRY.COMPLETED', label: 'Rà soát lịch hẹn hết hạn thành công' },
  { value: 'APPOINTMENT_EXPIRY.FAILED', label: 'Rà soát lịch hẹn hết hạn thất bại' },
  { value: 'MEMBERSHIP_DAILY_SYNC_JOB.COMPLETED', label: 'Đồng bộ hội viên thành công' },
  { value: 'MEMBERSHIP_DAILY_SYNC_JOB.FAILED', label: 'Đồng bộ hội viên thất bại' },
  { value: 'MEMBERSHIP_RANK_RESET_JOB.COMPLETED', label: 'Đặt lại hạng hội viên thành công' },
  { value: 'MEMBERSHIP_RANK_RESET_JOB.FAILED', label: 'Đặt lại hạng hội viên thất bại' },
  { value: 'BIRTHDAY_NOTIFICATIONS.COMPLETED', label: 'Gửi thông báo sinh nhật thành công' },
  { value: 'BIRTHDAY_NOTIFICATIONS.FAILED', label: 'Gửi thông báo sinh nhật thất bại' },
  { value: 'SECURITY.ACCESS_DENIED', label: 'Truy cập bị từ chối' },
  { value: 'SECURITY.LOGIN_SUCCEEDED', label: 'Đăng nhập thành công' },
  { value: 'SECURITY.LOGIN_FAILED', label: 'Đăng nhập thất bại' },
]

function rowsFrom<T>(value: unknown): T[] {
  const payload = pickData<unknown>(value)
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { rows?: unknown }).rows)) {
    return (payload as { rows: T[] }).rows
  }
  return []
}

function formatField(field: string): string {
  const labels: Record<string, string> = {
    status: 'Trạng thái', name: 'Tên', branch_id: 'Cơ sở', staff_id: 'Nhân viên', work_date: 'Ngày làm',
    shift_name: 'Ca làm', shift_hours: 'Giờ làm', start_time: 'Giờ bắt đầu', end_time: 'Giờ kết thúc',
    amount: 'Số tiền', points: 'Điểm', rank_id: 'Hạng thành viên', price: 'Giá', original_price: 'Giá gốc',
    sku: 'Mã hàng', brand: 'Thương hiệu', quantity: 'Số lượng', is_active: 'Đang hoạt động',
    title: 'Tiêu đề', short_description: 'Mô tả ngắn', note: 'Ghi chú', category_id: 'Danh mục',
    full_name: 'Họ tên', display_name: 'Tên hiển thị', sort_order: 'Thứ tự', discount_percent: 'Phần trăm giảm giá',
    is_completed: 'Hoàn tất', session_value: 'Giá trị buổi', description: 'Mô tả', color: 'Màu sắc',
  }
  return labels[field] || field.replaceAll('_', ' ')
}

function targetLabel(row: AuditEvent): string {
  if (row.customer_name) return `${row.customer_name}${row.customer_code ? ` · ${row.customer_code}` : ''}`
  if (!row.target_type && !row.target_id) return '—'
  return MODULE_LABEL[row.target_type || ''] || 'Đối tượng'
}

function branchList(value: unknown): Branch[] {
  const payload = pickData<unknown>(value)
  if (Array.isArray(payload)) return payload as Branch[]
  if (payload && typeof payload === 'object' && Array.isArray((payload as { rows?: unknown }).rows)) return (payload as { rows: Branch[] }).rows
  return []
}

export default function AccessLogs() {
  const { formatDateTime } = useBrandDateTime()
  const profile = useProfileStore((state) => state.profile)
  const profileRoles = [
    ...(profile?.roles ?? []),
    ...(profile?.user_roles ?? []).map(({ role }) => role?.code || role?.role_name || ''),
  ].map((role) => role.toLowerCase())
  const isPlatformAdmin = Boolean(profile?.is_admin || profile?.is_super_admin || profileRoles.some((role) => ['admin', 'super_admin', 'super admin'].includes(role)))
  const [page, setPage] = useState(1)
  const [activeCategory, setActiveCategory] = useState<Category | undefined>()
  const [module, setModule] = useState<string>()
  const [eventCode, setEventCode] = useState<string>()
  const [outcome, setOutcome] = useState<Outcome>()
  const [source, setSource] = useState<Source>()
  const [branchId, setBranchId] = useState<string>()
  const [search, setSearch] = useState('')
  const [filterForm] = Form.useForm()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null]>(() => [dayjs().subtract(6, 'day').startOf('day'), dayjs().endOf('day')])
  const [result, setResult] = useState<AuditResponse>({ data: [], meta: { total: 0 } })
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<unknown>()
  const [selected, setSelected] = useState<AuditEvent | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const limit = 20
  const activeFilterCount = [module, eventCode, outcome, source, branchId, range.some(Boolean)].filter(Boolean).length

  useEffect(() => {
    if (!profile?.id) return
    setActiveCategory(isPlatformAdmin ? undefined : 'BUSINESS')
  }, [profile?.id, isPlatformAdmin])

  const branchesQuery = useGetBranchesAdmin({ status: 'all' }, { query: { enabled: isPlatformAdmin } })
  const allBranches = branchList(branchesQuery.data)
  const rowBranches = useMemo(() => {
    const unique = new Map<string, string>()
    for (const row of result.data) if (row.branch_id && row.branch_name) unique.set(row.branch_id, row.branch_name)
    return [...unique].map(([value, label]) => ({ value, label }))
  }, [result.data])

  const params = useMemo<AuditQuery>(() => ({
    page,
    limit,
    ...(activeCategory ? { category: activeCategory } : {}),
    ...(module ? { module } : {}),
    ...(eventCode ? { event_code: eventCode } : {}),
    ...(outcome ? { outcome } : {}),
    ...(source ? { source } : {}),
    ...(branchId ? { branch_id: branchId } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(range[0] ? { from: range[0].toISOString() } : {}),
    ...(range[1] ? { to: range[1].add(1, 'millisecond').toISOString() } : {}),
  }), [page, limit, activeCategory, module, eventCode, outcome, source, branchId, search, range])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(undefined)
    const fetchEvents = async () => {
      const retryDelays = [1000, 3000, 6000]
      for (const delay of retryDelays) {
        try {
          return await apiClient.get('/audit-events/admin', { params, signal: controller.signal })
        } catch (error) {
          if (controller.signal.aborted || (error as { code?: string })?.code !== 'ERR_NETWORK') throw error
          await new Promise<void>((resolve) => {
            const finish = () => {
              window.clearTimeout(timer)
              controller.signal.removeEventListener('abort', finish)
              resolve()
            }
            const timer = window.setTimeout(finish, delay)
            controller.signal.addEventListener('abort', finish, { once: true })
          })
          if (controller.signal.aborted) throw error
        }
      }
      return apiClient.get('/audit-events/admin', { params, signal: controller.signal })
    }
    fetchEvents()
      .then(({ data }) => {
        if (controller.signal.aborted) return
        setResult({ data: rowsFrom<AuditEvent>(data), meta: pickMeta(data) })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setLoadError(error)
        setResult({ data: [], meta: { total: 0 } })
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [params, refreshKey])

  const total = result.meta?.total ?? result.data.length
  const branchOptions = isPlatformAdmin
    ? allBranches.map((branch) => ({ value: branch.id, label: `${branch.code} · ${branch.name}` }))
    : rowBranches

  const openDetails = async (row: AuditEvent) => {
    setSelected(row)
    setDetailLoading(true)
    try {
      const { data } = await apiClient.get(`/audit-events/${encodeURIComponent(row.id)}/admin`)
      const payload = pickData<DetailResponse | AuditEvent>(data)
      setSelected((payload && 'data' in payload ? payload.data : payload) as AuditEvent)
    } catch (error) {
      message.error(errorMessage(error, 'Không tải được chi tiết nhật ký'))
    } finally {
      setDetailLoading(false)
    }
  }

  const categoryOptions = isPlatformAdmin
    ? [{ label: 'Tất cả', value: '' }, ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ label, value }))]
    : [{ label: 'Thay đổi nghiệp vụ', value: 'BUSINESS' }]

  return (
    <MobileUI>
      <PageTitle subtitle="Theo dõi thay đổi nghiệp vụ và truy cập dữ liệu nhạy cảm">
        Nhật ký
      </PageTitle>

      <Tabs
        activeKey={isPlatformAdmin ? activeCategory ?? 'ALL' : 'BUSINESS'}
        onChange={(key) => { setActiveCategory(key === 'ALL' ? undefined : key as Category); setPage(1) }}
        items={categoryOptions.map(({ label, value }) => ({ key: value || 'ALL', label }))}
        tabBarExtraContent={
          <Button aria-label="Làm mới" className="max-md:[&>span:not(.ant-btn-icon)]:hidden" icon={<ReloadOutlined />} onClick={() => setRefreshKey((key) => key + 1)}>Làm mới</Button>
        }
      />

      <div className="toolbar-row mb-4 flex flex-wrap items-center gap-2 max-lg:mb-3 max-md:grid">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm nhật ký..."
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          className="max-md:max-w-none!"
          style={{ flex: '1 1 170px', maxWidth: 280 }}
        />
        <ListFilterPopover
          open={filtersOpen}
          onOpenChange={(open) => {
            if (open) filterForm.setFieldsValue({ module, eventCode, outcome, source, branchId, range })
            setFiltersOpen(open)
          }}
          activeFilterCount={activeFilterCount}
          trigger={<Button className="keep-label" icon={<FilterOutlined />}>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Button>}
          form={filterForm}
          onApply={(values) => {
            const dates = values.range as [Dayjs | null, Dayjs | null] | null | undefined
            setModule(values.module as string | undefined)
            setEventCode(values.eventCode as string | undefined)
            setOutcome(values.outcome as Outcome | undefined)
            setSource(values.source as Source | undefined)
            setBranchId(values.branchId as string | undefined)
            setRange([dates?.[0]?.startOf('day') ?? null, dates?.[1]?.endOf('day') ?? null])
            setPage(1)
            setFiltersOpen(false)
          }}
          onClear={() => {
            filterForm.resetFields()
            filterForm.submit()
          }}
          filterItems={
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              <Form.Item name="module" label="Nhóm" style={{ marginBottom: 0 }} className="col-span-2 min-w-0">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Tất cả nhóm"
                    style={{ width: '100%' }}
                    options={Object.entries(MODULE_LABEL).map(([value, label]) => ({ value, label }))}
                  />
              </Form.Item>
              <Form.Item name="branchId" label="Cơ sở" style={{ marginBottom: 0 }} className="col-span-2 min-w-0">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Mọi cơ sở"
                    style={{ width: '100%' }}
                    options={branchOptions}
                  />
              </Form.Item>
              <Form.Item name="eventCode" label="Sự kiện" style={{ marginBottom: 0 }} className="min-w-0">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Tất cả sự kiện"
                    style={{ width: '100%' }}
                    popupMatchSelectWidth={300}
                    options={EVENT_OPTIONS}
                  />
              </Form.Item>
              <Form.Item name="outcome" label="Kết quả" style={{ marginBottom: 0 }} className="min-w-0">
                  <Select<Outcome>
                    allowClear
                    placeholder="Mọi kết quả"
                    style={{ width: '100%' }}
                    options={Object.entries(OUTCOME_META).map(([value, meta]) => ({ value, label: meta.label }))}
                  />
              </Form.Item>
              <Form.Item name="source" label="Nguồn" style={{ marginBottom: 0 }} className="col-span-2 min-w-0">
                  <Select<Source>
                    allowClear
                    placeholder="Mọi nguồn"
                    style={{ width: '100%' }}
                    options={Object.entries(SOURCE_LABEL).map(([value, label]) => ({ value, label }))}
                  />
              </Form.Item>
              <Form.Item name="range" label="Khoảng ngày" style={{ marginBottom: 0 }} className="col-span-2 min-w-0">
                  <DatePicker.RangePicker
                    allowEmpty={[true, true]}
                    style={{ width: '100%' }}
                    format="DD/MM/YYYY"
                  />
              </Form.Item>
            </div>
          }
        />
      </div>

      {loadError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Không tải được nhật ký hệ thống"
          description={errorMessage(loadError)}
          action={<Button size="small" onClick={() => setRefreshKey((key) => key + 1)}>Thử lại</Button>}
        />
      )}

      <ResponsiveTable<AuditEvent>
        rowKey="id"
        loading={loading}
        dataSource={result.data}
        pagination={false}
        scroll={{ x: 1050 }}
        onMobileCardClick={(row) => void openDetails(row)}
        onRow={(row) => ({ onClick: () => void openDetails(row), className: 'cursor-pointer' })}
        locale={{ emptyText: loadError ? null : <TableEmpty description="Chưa có sự kiện trong khoảng đã chọn" /> }}
        columns={[
          { title: 'Thời gian', dataIndex: 'created_at', width: 170, render: (value: string) => formatDateTime(value) },
          {
            title: 'Người thực hiện', dataIndex: 'actor_name', width: 190,
            render: (value: string | null | undefined, row) => value || row.actor_label || (row.actor_type === 'SYSTEM' ? 'Hệ thống' : 'Không xác định'),
          },
          {
            title: 'Sự kiện', dataIndex: 'summary', width: 330,
            render: (value: string, row) => (
              <Space direction="vertical" size={2}>
                <span>{value || 'Sự kiện hệ thống'}</span>
                {row.business_reason && (
                  <Typography.Text type="secondary" className="break-words" style={{ fontSize: 12 }}>
                    Lý do: {row.business_reason}
                  </Typography.Text>
                )}
                {row.is_legacy && <Tag color="default">Dữ liệu cũ</Tag>}
              </Space>
            ),
          },
          { title: 'Đối tượng', width: 240, render: (_: unknown, row) => targetLabel(row) },
          {
            title: 'Kết quả', dataIndex: 'outcome', width: 130,
            render: (value: Outcome) => <Tag color={OUTCOME_META[value]?.color}>{OUTCOME_META[value]?.label || value}</Tag>,
          },
          { title: 'Nguồn', dataIndex: 'source', width: 120, render: (value: Source) => SOURCE_LABEL[value] || value },
        ]}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="sự kiện" />

      <Modal
        title={selected && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pr-7">
            <span>{selected.summary || EVENT_OPTIONS.find(({ value }) => value === selected.event_code)?.label || 'Chi tiết nhật ký'}</span>
            <Tag style={{ marginInlineEnd: 0 }} color={OUTCOME_META[selected.outcome]?.color}>
              {OUTCOME_META[selected.outcome]?.label || 'Không xác định'}
            </Tag>
          </div>
        )}
        centered
        width={460}
        open={Boolean(selected)}
        onCancel={() => setSelected(null)}
        footer={null}
        styles={{ body: { maxHeight: '65dvh', overflowY: 'auto' } }}
      >
        {selected && (
          <Spin spinning={detailLoading}>
          <div className="space-y-3">
            {selected.is_legacy && (
              <Alert type="info" showIcon message="Dữ liệu cũ" description="Bản ghi này được chuyển tiếp từ nhật ký truy cập trước đây nên không có thông tin chi tiết thay đổi." />
            )}
            <Descriptions bordered size="small" column={1} styles={{ label: { width: '38%' }, content: { overflowWrap: 'anywhere' } }}>
              <Descriptions.Item label="Người thực hiện">{selected.actor_name || selected.actor_label || (selected.actor_type === 'SYSTEM' ? 'Hệ thống' : 'Không xác định')}</Descriptions.Item>
              <Descriptions.Item label="Thời gian">{formatDateTime(selected.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Nhóm">{CATEGORY_LABEL[selected.category] || selected.category}</Descriptions.Item>
              <Descriptions.Item label="Nguồn">{SOURCE_LABEL[selected.source] || selected.source}</Descriptions.Item>
              <Descriptions.Item label="Đối tượng">
                {targetLabel(selected)}
                {!selected.customer_name && selected.target_id && (
                  <Typography.Text type="secondary" copyable={{ text: selected.target_id }} style={{ marginLeft: 6, fontSize: 12 }}>
                    #{selected.target_id.slice(0, 8)}
                  </Typography.Text>
                )}
              </Descriptions.Item>
              {selected.branch_name && <Descriptions.Item label="Cơ sở">{selected.branch_name}</Descriptions.Item>}
            </Descriptions>

            {selected.business_reason && (
              <div className="border-t pt-3" style={{ borderColor: 'var(--brand-border-soft)' }}>
                <Typography.Text strong>Lý do</Typography.Text>
                <div className="mt-1 whitespace-pre-wrap break-words">{selected.business_reason}</div>
              </div>
            )}

            {Boolean(selected.changes?.length) && (
              <section>
                <Typography.Title level={5}>{selected.event_code === 'STAFF_SCHEDULE.DELETED' ? 'Ca làm đã xóa' : 'Thông tin đã thay đổi'}</Typography.Title>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {selected.event_code !== 'STAFF_SCHEDULE.DELETED' && <div className="grid grid-cols-3 gap-2 border-b px-3 py-2 font-semibold">
                    <span>Nội dung</span><span>Trước</span><span>Sau</span>
                  </div>}
                  {selected.changes!.map((change, index) => (
                    <div key={`${change.field}-${index}`} className={`grid ${selected.event_code === 'STAFF_SCHEDULE.DELETED' ? 'grid-cols-2' : 'grid-cols-3'} gap-2 break-words border-b border-slate-100 px-3 py-2 last:border-b-0`}>
                      <Typography.Text type="secondary">{formatField(change.field)}</Typography.Text>
                      <span>{change.field === 'work_date' && change.from === '[ẩn dữ liệu nhạy cảm]'
                        ? 'Không có ngày trong bản ghi'
                        : change.field === 'work_date' && change.from && /^\d{4}-\d{2}-\d{2}$/.test(change.from)
                          ? dayjs(change.from).format('DD/MM/YYYY')
                          : change.from ?? '—'}</span>
                      {selected.event_code !== 'STAFF_SCHEDULE.DELETED' && <span>{change.to ?? '—'}</span>}
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>
          </Spin>
        )}
      </Modal>
    </MobileUI>
  )
}
