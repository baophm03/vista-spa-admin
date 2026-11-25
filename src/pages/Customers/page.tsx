import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { displayName } from '@/utils/displayName'
import { Button, Form, Grid, Input, InputNumber, Modal, Col, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, FilterOutlined, PlusOutlined, QrcodeOutlined, SearchOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import ListFilterPopover from '@/components/base/ListFilterPopover'
import ListPagination from '@/components/base/ListPagination'
import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import RowActionsMenu from '@/components/base/RowActionsMenu'
import { normalizeCustomerCustomFields, type CustomFieldDefWithOptions } from './components/CustomerProfileCustomFields'
import type { CustomerProfileRow, CustomerProfileSummary } from './components/CustomerProfileOverviewTab'
import { useBrandCurrency } from '@/themeRuntime'
import type { CardRank } from '@/api/models/cardRank'
import type { Customer } from '@/api/models/customer'
import type { CustomerCreate } from '@/api/models/customerCreate'
import type { GetUsersCustomersAdminParams } from '@/api/models/getUsersCustomersAdminParams'
import { deleteUsersCustomersIdAdmin, getUsersCustomersByQrAdmin, getUsersCustomersIdAdmin, getUsersCustomersIdSummaryAdmin, getGetUsersCustomersAdminQueryKey, postUsersCustomersAdmin, postUsersCustomersIdQrResetAdmin, putUsersCustomersIdAdmin, useGetUsersCustomersAdmin } from '@/api/endpoints/customers'
import { getCardRanksAdmin } from '@/api/endpoints/card-ranks'
import { getCustomFieldDefsAdmin } from '@/api/endpoints/custom-field-defs'
import { apiClient } from '@/api/mutator/custom-instance'
import { downloadBlob, errorMessage, pickData } from '@/api/helpers'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'

const CustomerQrScannerModal = lazy(() => import('./components/CustomerQrScannerModal'))
import CustomerAvatar from './components/CustomerAvatar'
import CustomerDetailDrawer from './components/CustomerDetailDrawer'
import CustomerProfileFormModal from './components/CustomerProfileFormModal'

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

type CustomerColumnKey = 'customer_code' | 'full_name' | 'phone' | 'email' | 'rank'

const CUSTOMER_COLUMN_OPTIONS: { label: string; value: CustomerColumnKey }[] = [
  { label: 'Mã khách hàng', value: 'customer_code' },
  { label: 'Tên khách hàng', value: 'full_name' },
  { label: 'Số điện thoại', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Hạng / Tài khoản', value: 'rank' },
]

const DEFAULT_VISIBLE_COLUMNS = CUSTOMER_COLUMN_OPTIONS.map((column) => column.value)

interface CustomerProfileListFilters {
  birth_month?: number
  rank_id?: string
  min_spent?: number
  max_spent?: number
  has_debt?: 'true' | 'false'
}

function buildListParams(filters: CustomerProfileListFilters, keyword: string, page: number, limit: number) {
  const params: Record<string, unknown> = { ...filters, page, limit }
  if (keyword.trim()) params.q = keyword.trim()
  else delete params.q
  return params
}

export default function Customers() {
  const { symbol: currencySymbol } = useBrandCurrency()
  const queryClient = useQueryClient()
  const profileAccess = useCustomerProfileAccess()
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [searchText, setSearchText] = useState('')
  const [keyword, setKeyword] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<CustomerColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<CustomerColumnKey[]>(DEFAULT_VISIBLE_COLUMNS)
  const [filters, setFilters] = useState<CustomerProfileListFilters>({})
  const [selected, setSelected] = useState<CustomerProfileRow | null>(null)
  const [summary, setSummary] = useState<CustomerProfileSummary | null>(null)
  const [qrUrl, setQrUrl] = useState<string>('')
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [qrLookupLoading, setQrLookupLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerProfileRow | null>(null)
  const [ranks, setRanks] = useState<CardRank[]>([])
  const [profileFieldDefs, setProfileFieldDefs] = useState<CustomFieldDefWithOptions[]>([])
  const [exporting, setExporting] = useState(false)
  const [resettingQr, setResettingQr] = useState(false)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()
  // Mobile (dưới breakpoint md): nút công cụ hiện chữ thay vì chỉ icon
  const isMobile = !Grid.useBreakpoint().md

  const listParams = buildListParams(filters, keyword, page, limit) as GetUsersCustomersAdminParams
  const listQuery = useGetUsersCustomersAdmin(listParams)
  const listBody = listQuery.data
  const rows = (listBody?.responseData ?? []) as CustomerProfileRow[]
  const total = listBody?.meta?.total ?? rows.length
  const loading = listQuery.isLoading

  useEffect(() => {
    const nextKeyword = searchText.trim()
    if (nextKeyword === keyword) return
    const timer = window.setTimeout(() => {
      setKeyword(nextKeyword)
      setPage(1)
    }, nextKeyword ? 300 : 0)
    return () => window.clearTimeout(timer)
  }, [searchText, keyword])

  useEffect(() => {
    if (!qrUrl.startsWith('blob:')) return
    return () => URL.revokeObjectURL(qrUrl)
  }, [qrUrl])

  useEffect(() => {
    getCardRanksAdmin()
      .then((body) => setRanks((pickData<CardRank[]>(body) ?? [])
        .filter((rank) => rank.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))))
      .catch(() => undefined)
    getCustomFieldDefsAdmin({ entity: 'CUSTOMER', is_active: true })
      .then((body) => setProfileFieldDefs(pickData<CustomFieldDefWithOptions[]>(body) ?? []))
      .catch((err) => message.error('Không tải được cấu hình trường hồ sơ: ' + errorMessage(err)))
  }, [])

  const loadProfileDetails = async (profileId: string) => {
    const fresh = pickData<CustomerProfileRow>(await getUsersCustomersIdAdmin(profileId))
    setSelected(fresh)
    setQrLoading(profileAccess.canViewQr)
    setQrError('')
    if (!profileAccess.canViewQr) setQrUrl('')
    const [summaryResult, qrResult] = await Promise.allSettled([
      getUsersCustomersIdSummaryAdmin(profileId),
      profileAccess.canViewQr ? apiClient.get(`/users/customers/${profileId}/qr/admin`, { responseType: 'blob' }) : Promise.resolve(null),
    ])
    if (summaryResult.status === 'fulfilled') setSummary(pickData<CustomerProfileSummary>(summaryResult.value) ?? null)
    else {
      setSummary(null)
      message.error('Không tải được tổng hợp hồ sơ: ' + errorMessage(summaryResult.reason))
    }
    if (!profileAccess.canViewQr) {
      setQrUrl('')
    } else if (qrResult.status === 'fulfilled' && qrResult.value) {
      setQrUrl(URL.createObjectURL((qrResult.value as { data: Blob }).data))
    } else {
      setQrUrl('')
      const error = errorMessage(qrResult.status === 'rejected' ? qrResult.reason : 'Không nhận được ảnh QR')
      setQrError(error)
      message.error(`Không tải được mã QR: ${error}`)
    }
    setQrLoading(false)
  }

  const refreshList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getGetUsersCustomersAdminQueryKey() })
  }, [queryClient])

  const refreshSelected = async () => {
    if (!selected) return
    try {
      await loadProfileDetails(selected.id)
      refreshList()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const openDetail = async (row: CustomerProfileRow) => {
    setSelected(row)
    setSummary(null)
    setQrUrl('')
    try {
      await loadProfileDetails(row.id)
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const lookupQrToken = async (token: string) => {
    setScannerOpen(false)
    setQrLookupLoading(true)
    try {
      const profile = pickData<Customer>(await getUsersCustomersByQrAdmin({ token }))
      if (profile) await openDetail(profile as CustomerProfileRow)
    } catch (err) {
      message.error('Không tìm thấy hồ sơ theo QR: ' + errorMessage(err))
    } finally {
      setQrLookupLoading(false)
    }
  }

  const applyFilters = (values: Record<string, unknown>) => {
    const minSpent = typeof values.min_spent === 'number' ? values.min_spent : undefined
    const maxSpent = typeof values.max_spent === 'number' ? values.max_spent : undefined
    if (minSpent !== undefined && maxSpent !== undefined && minSpent > maxSpent) {
      message.error('Chi tiêu từ không được lớn hơn chi tiêu đến')
      return
    }
    if (draftVisibleColumns.length === 0) {
      message.error('Hãy giữ lại ít nhất một cột hiển thị')
      return
    }

    const next: CustomerProfileListFilters = {}
    if (typeof values.birth_month === 'number') next.birth_month = values.birth_month
    if (typeof values.rank_id === 'string' && values.rank_id) next.rank_id = values.rank_id
    if (minSpent !== undefined) next.min_spent = minSpent
    if (maxSpent !== undefined) next.max_spent = maxSpent
    if (values.has_debt === 'true' || values.has_debt === 'false') next.has_debt = values.has_debt
    setFilters(next)
    setKeyword(searchText.trim())
    setVisibleColumns(draftVisibleColumns)
    setPage(1)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    filterForm.resetFields()
    setSearchText('')
    setKeyword('')
    setFilters({})
    setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
    setPage(1)
  }

  const openFilters = (nextOpen: boolean) => {
    setFilterOpen(nextOpen)
    if (!nextOpen) return
    filterForm.setFieldsValue(filters)
    setDraftVisibleColumns(visibleColumns)
  }

  const downloadCsv = async () => {
    setExporting(true)
    try {
      const params = buildListParams(filters, keyword, page, limit)
      delete params.page
      delete params.limit
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
      }
      const qs = query.toString()
      await downloadBlob(`/users/customers/export/admin${qs ? `?${qs}` : ''}`, `customers-${dayjs().format('YYYYMMDD-HHmm')}.csv`)
      message.success('Đã xuất danh sách khách hàng')
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const resetQr = async () => {
    if (!selected) return
    setResettingQr(true)
    try {
      await postUsersCustomersIdQrResetAdmin(selected.id)
      setQrUrl('')
      setQrLoading(true)
      setQrError('')
      const response = await apiClient.get(`/users/customers/${selected.id}/qr/admin`, { responseType: 'blob' })
      setQrUrl(URL.createObjectURL(response.data as Blob))
      message.success('Đã tạo lại mã QR; mã cũ không còn hiệu lực')
    } catch (err) {
      const error = errorMessage(err)
      setQrError(error)
      message.error(error)
    } finally {
      setQrLoading(false)
      setResettingQr(false)
    }
  }

  const openModal = async (customer?: CustomerProfileRow) => {
    form.resetFields()
    setOpen(false)
    if (!customer) {
      setEditing(null)
      form.setFieldsValue({ full_name: '', phone: '', email: '', custom_fields: {} })
      setOpen(true)
      return
    }

    try {
      const fresh = pickData<CustomerProfileRow>(await getUsersCustomersIdAdmin(customer.id))
      setEditing(fresh)
      form.setFieldsValue({
        full_name: fresh.full_name,
        phone: fresh.phone,
        email: fresh.email,
        birthday: fresh.birthday ? dayjs(fresh.birthday) : undefined,
        address: fresh.address,
        note: fresh.note,
        custom_fields: fresh.custom_fields ?? {},
      })
      setOpen(true)
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const submit = async () => {
    const values = await form.validateFields()
    const { custom_fields: enteredCustomFields = {}, ...profileValues } = values as {
      custom_fields?: Record<string, unknown>
    } & Record<string, unknown>
    const payload = {
      ...(profileValues as Record<string, unknown>),
      custom_fields: normalizeCustomerCustomFields(profileFieldDefs, enteredCustomFields, editing?.custom_fields ?? {}) ?? undefined,
      birthday: values.birthday ? (values.birthday as Dayjs).format('YYYY-MM-DD') : undefined,
    } as unknown as CustomerCreate
    try {
      if (editing) {
        await putUsersCustomersIdAdmin(editing.id, payload)
        message.success('Đã cập nhật khách hàng')
      } else {
        await postUsersCustomersAdmin(payload as unknown as { [key: string]: unknown })
        message.success('Đã thêm khách hàng')
      }
      setOpen(false)
      refreshList()
      if (selected && editing?.id === selected.id) await refreshSelected()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const remove = async (row: CustomerProfileRow) => {
    try {
      await deleteUsersCustomersIdAdmin(row.id)
      message.success('Đã xóa khách hàng')
      if (selected?.id === row.id) setSelected(null)
      refreshList()
    } catch (err) {
      message.error(errorMessage(err))
    }
  }

  const downloadQr = () => {
    if (!selected || !qrUrl) return
    const anchor = document.createElement('a')
    anchor.href = qrUrl
    anchor.download = `${selected.customer_code}.png`
    anchor.click()
  }

  const printQr = () => {
    if (!selected || !qrUrl) return
    const printWindow = window.open('', '_blank', 'popup,width=440,height=620')
    if (!printWindow) {
      message.error('Trình duyệt đang chặn cửa sổ in. Hãy cho phép cửa sổ bật lên rồi thử lại.')
      return
    }
    const customerName = escapeHtml(displayName(selected))
    const customerCode = escapeHtml(selected.customer_code)
    printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>QR ${customerCode}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#26352d}.card{width:320px;margin:0 auto;border:1px solid #dce8df;border-radius:16px;padding:22px;text-align:center}.brand{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5b7868}.name{font-size:20px;font-weight:700;margin:10px 0 6px}.code{font-family:monospace;font-size:16px;font-weight:700}img{width:210px;height:210px;image-rendering:pixelated;margin-top:16px}@media print{body{padding:0}.card{border:0}}
      </style></head><body><main class="card"><div class="brand">Vista</div><div class="name">${customerName}</div><div class="code">${customerCode}</div><img src="${qrUrl}" alt="QR ${customerCode}"></main><script>window.onload=()=>{setTimeout(()=>{window.focus();window.print();window.close()},150)}</script></body></html>`)
    printWindow.document.close()
  }

  const rowRankName = (row: CustomerProfileRow) => row.user?.membership?.card_rank?.name
  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== '').length + (keyword ? 1 : 0)

  // Nút pill mobile theo Figma "Mobile / Danh sách khách": trắng, viền hairline, radius 12, icon tím
  const mobilePillStyle = {
    flex: 1,
    height: 44,
    borderRadius: 10,
    border: '1px solid var(--brand-border-soft)',
    background: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--brand-primary)',
    padding: 0,
  } as const

  const renderFilterPopover = (trigger?: React.ReactNode) => (
    <ListFilterPopover
      iconOnly={isMobile}
      trigger={trigger}
      open={filterOpen}
      onOpenChange={openFilters}
      activeFilterCount={activeFilterCount}
      form={filterForm}
      onApply={applyFilters}
      onClear={clearFilters}
      columnOptions={CUSTOMER_COLUMN_OPTIONS}
      draftVisibleColumns={draftVisibleColumns}
      onDraftVisibleColumnsChange={(values) => setDraftVisibleColumns(values as CustomerColumnKey[])}
      filterItems={(
        <>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="birth_month" label="Tháng sinh" className="mb-2.5!">
                <Select allowClear placeholder="Tất cả" options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `Tháng ${index + 1}` }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="rank_id" label="Hạng thành viên" className="mb-2.5!">
                <Select allowClear placeholder="Tất cả" options={ranks.map((rank) => ({ value: rank.id, label: rank.name }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="min_spent" label="Chi tiêu từ" className="mb-2.5!">
                <InputNumber min={0} step={100000} suffix={currencySymbol} placeholder="Tối thiểu" className="w-full!" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_spent" label="Chi tiêu đến" className="mb-2.5!">
                <InputNumber min={0} step={100000} suffix={currencySymbol} placeholder="Tối đa" className="w-full!" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="has_debt" label="Công nợ" className="mb-0!">
            <Select allowClear placeholder="Tất cả" options={[{ value: 'true', label: 'Có nợ' }, { value: 'false', label: 'Không nợ' }]} />
          </Form.Item>
        </>
      )}
    />
  )

  return (
    <>
      <PageTitle
        subtitle="Quản lý cơ sở dữ liệu và phân hạng thành viên"
        left={
          !isMobile ? (
            <>
              <Input.Search
                allowClear
                placeholder="Tìm tên, SĐT, email, mã KH..."
                className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                aria-label="Tìm khách hàng"
                onSearch={(value) => { setKeyword(value.trim()); setPage(1) }}
              />
              {profileAccess.canRead && (
                <Button icon={<QrcodeOutlined />} loading={qrLookupLoading} onClick={() => setScannerOpen(true)} aria-label="Quét QR" title="Quét QR">
                  Quét QR
                </Button>
              )}
              {renderFilterPopover()}
              {profileAccess.canExport && (
                <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void downloadCsv()} aria-label="Xuất CSV" title="Xuất CSV">
                  Xuất CSV
                </Button>
              )}
            </>
          ) : undefined
        }
        right={
          profileAccess.canManage && !isMobile ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => void openModal()}>
              Thêm khách hàng
            </Button>
          ) : undefined
        }
      >
        Khách hàng
      </PageTitle>
      {/* Toolbar mobile theo Figma: search full-width + hàng nút Quét QR / Bộ lọc / Xuất CSV */}
      {isMobile && (
        <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: '#655E71' }} />}
            placeholder="Tìm tên, SĐT, email, mã KH"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            aria-label="Tìm khách hàng"
            style={{ height: 46, borderRadius: 12 }}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            {profileAccess.canRead && (
              <button type="button" style={mobilePillStyle} onClick={() => setScannerOpen(true)}>
                <QrcodeOutlined style={{ color: 'var(--brand-primary)', fontSize: 15 }} />
                Quét QR
              </button>
            )}
            {renderFilterPopover(
              <button type="button" style={mobilePillStyle}>
                <FilterOutlined style={{ color: 'var(--brand-primary)', fontSize: 15 }} />
                Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>,
            )}
            {profileAccess.canExport && (
              <button type="button" aria-label="Xuất CSV" style={{ ...mobilePillStyle, flex: '0 0 46px' }} onClick={() => void downloadCsv()}>
                <DownloadOutlined style={{ color: 'var(--brand-primary)', fontSize: 15 }} />
              </button>
            )}
            {/* Nút thêm chuyển từ header xuống cùng hàng công cụ trên mobile */}
            {profileAccess.canManage && (
              <button
                type="button"
                aria-label="Thêm khách hàng"
                style={{ ...mobilePillStyle, flex: '0 0 46px', background: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: '#fff' }}
                onClick={() => void openModal()}
              >
                <PlusOutlined style={{ fontSize: 15 }} />
              </button>
            )}
          </div>
        </div>
      )}
      <Table<CustomerProfileRow>
        className="desktop-only"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 950 }}
        pagination={false}
        onRow={(row) => ({
          onClick: profileAccess.canRead ? () => void openDetail(row) : undefined,
          style: profileAccess.canRead ? { cursor: 'pointer' } : undefined,
        })}
        columns={[
          {
            key: 'customer_code',
            title: 'Mã KH',
            dataIndex: 'customer_code',
            width: 130,
            render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
          },
          {
            key: 'full_name',
            title: 'Khách hàng',
            dataIndex: 'full_name',
            width: 180,
            render: (_: string, row: CustomerProfileRow) => (
              <Space>
                <CustomerAvatar profile={row} />
                <span style={{ fontWeight: 500 }}>{displayName(row)}</span>
              </Space>
            ),
          },
          { key: 'phone', title: 'Số điện thoại', dataIndex: 'phone', width: 120 },
          { key: 'email', title: 'Email', dataIndex: 'email', width: 190, render: (value: string | undefined, row: CustomerProfileRow) => value || row.user?.email || '—' },
          {
            title: 'Hạng / Tài khoản',
            key: 'rank',
            width: 120,
            render: (_: unknown, row: CustomerProfileRow) => row.user_id
              ? <Tag color="purple">{rowRankName(row) ?? 'Đã liên kết'}</Tag>
              : <Tag>Chưa liên kết</Tag>,
          },
          {
            key: 'actions',
            title: 'Thao tác', align: 'center' as const,
            width: 90,
            fixed: 'right' as const,
            render: (_: unknown, row: CustomerProfileRow) => (
              <RowActionsMenu
                items={[
                  ...(profileAccess.canManage ? [{ key: 'edit', icon: <EditOutlined />, label: 'Sửa' }] : []),
                  ...(profileAccess.canDelete ? [{ key: 'delete', icon: <DeleteOutlined />, danger: true, label: 'Xóa' }] : []),
                ]}
                onSelect={(key) => {
                  if (key === 'edit') void openModal(row)
                  else if (key === 'delete') {
                    Modal.confirm({
                      title: 'Xóa (ẩn) khách hàng này?',
                      okText: 'Xóa',
                      okButtonProps: { danger: true },
                      cancelText: 'Hủy',
                      onOk: () => remove(row),
                    })
                  }
                }}
              />
            ),
          },
        ].filter((column) =>
          (column.key !== 'actions' || profileAccess.canManage || profileAccess.canDelete) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as CustomerColumnKey)),
        )}
      />
      <MobileCards
        rows={rows}
        rowKey={(row) => row.id}
        onCardClick={profileAccess.canRead ? (row) => void openDetail(row) : undefined}
        loading={loading}
        emptyText="Chưa có khách hàng nào"
        renderCard={(row) => (
          <>
            <div className="mobile-card-head">
              <div className="mobile-card-title">{displayName(row)}</div>
              {/* Chip mã KH bên phải tiêu đề — theo Figma "Mobile / Danh sách khách" */}
              <span
                style={{
                  flexShrink: 0,
                  padding: '4px 7px',
                  borderRadius: 7,
                  background: '#f2e5f4',
                  color: 'var(--brand-primary)',
                  fontSize: 11,
                  fontWeight: 500,
                  lineHeight: 'normal',
                }}
              >
                {row.customer_code}
              </span>
            </div>
            <div className="mobile-card-rows">
              <MobileCardRow label="Số điện thoại" value={row.phone || '—'} />
              <MobileCardRow label="Email" value={row.email || row.user?.email || '—'} />
              <MobileCardRow
                label="Hạng / Tài khoản"
                value={`${rowRankName(row) ?? '—'} / ${row.user_id ? 'Đã liên kết' : 'Chưa liên kết'}`}
              />
            </div>
            {(profileAccess.canManage || profileAccess.canDelete) && (
              <div className="mobile-card-actions">
                {profileAccess.canManage && <Button size="small" icon={<EditOutlined />} onClick={(event) => { event.stopPropagation(); void openModal(row) }}>Sửa</Button>}
                {profileAccess.canDelete && <Button size="small" danger icon={<DeleteOutlined />} onClick={(event) => {
                  event.stopPropagation()
                  Modal.confirm({
                    title: 'Xóa (ẩn) khách hàng này?',
                    okText: 'Xóa',
                    okButtonProps: { danger: true },
                    cancelText: 'Hủy',
                    onOk: () => remove(row),
                  })
                }}>Xóa</Button>}
              </div>
            )}
          </>
        )}
      />
      <ListPagination page={page} limit={limit} total={total} onChange={setPage} noun="khách hàng" />

      <CustomerDetailDrawer
        selected={selected}
        summary={summary}
        qrUrl={qrUrl}
        qrLoading={qrLoading}
        qrError={qrError}
        profileFieldDefs={profileFieldDefs}
        canViewQr={profileAccess.canViewQr}
        isAdmin={profileAccess.isAdmin}
        canManage={profileAccess.canManage}
        resettingQr={resettingQr}
        onClose={() => setSelected(null)}
        onDownloadQr={downloadQr}
        onPrintQr={printQr}
        onResetQr={() => void resetQr()}
        onMembershipUpdated={refreshSelected}
      />


      <CustomerProfileFormModal
        form={form}
        open={open}
        editing={editing}
        profileFieldDefs={profileFieldDefs}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
      />


      {scannerOpen && (
        <Suspense fallback={null}>
          <CustomerQrScannerModal open onClose={() => setScannerOpen(false)} onToken={(token) => void lookupQrToken(token)} />
        </Suspense>
      )}
    </>
  )
}
