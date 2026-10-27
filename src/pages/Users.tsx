import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import {
  Avatar,
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Col,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  DownloadOutlined,
  FilterOutlined,
  HistoryOutlined,
  LinkOutlined,
  PlusOutlined,
  PrinterOutlined,
  QrcodeOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import PageTitle from '@/components/base/PageTitle'
import CustomerCodeHistoryModal from '@/components/CustomerCodeHistoryModal'
import LinkCustomerAccountModal from '@/components/LinkCustomerAccountModal'
import CustomerProfileDetailsTabs from '@/components/CustomerProfileDetailsTabs'
import CustomerProfileCustomFields, { normalizeCustomerCustomFields, type CustomFieldDefWithOptions } from '@/components/CustomerProfileCustomFields'
import type { CustomerProfileRow, CustomerProfileSummary } from '@/components/CustomerProfileOverviewTab'
import { useBrandCurrency } from '@/themeRuntime'
import type { Branch } from '@/api/models/branch'
import type { CardRank } from '@/api/models/cardRank'
import type { CustomerProfile } from '@/api/models/customerProfile'
import type { CustomerProfileCreate } from '@/api/models/customerProfileCreate'
import type { GetCustomerProfilesParams } from '@/api/models/getCustomerProfilesParams'
import {
  deleteCustomerProfilesId,
  getCustomerProfilesByQr,
  getCustomerProfilesId,
  getCustomerProfilesIdSummary,
  getGetCustomerProfilesQueryKey,
  postCustomerProfiles,
  postCustomerProfilesIdQrReset,
  putCustomerProfilesId,
  useGetCustomerProfiles,
} from '@/api/endpoints/customer-profiles'
import { getBranches } from '@/api/endpoints/branches'
import { getCardRanks } from '@/api/endpoints/membership'
import { getCustomFieldDefs } from '@/api/endpoints/settings'
import { apiClient } from '@/api/mutator/custom-instance'
import { downloadBlob, errorMessage, pickData } from '@/api/helpers'
import { useCustomerProfileAccess } from '@/utils/customerProfileAccess'

const CustomerQrScannerModal = lazy(() => import('@/components/CustomerQrScannerModal'))

function CustomerAvatar({ profile, size = 32 }: { profile: CustomerProfileRow; size?: number }) {
  const initial = profile.full_name?.trim().charAt(0).toUpperCase()
  return (
    <Avatar
      size={size}
      src={profile.user?.zalo_avatar || undefined}
      icon={initial ? undefined : <UserOutlined />}
      style={{ backgroundColor: 'var(--brand-primary)', flexShrink: 0 }}
      alt={`Ảnh đại diện ${profile.full_name}`}
    >
      {initial}
    </Avatar>
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

type CustomerColumnKey = 'customer_code' | 'full_name' | 'phone' | 'email' | 'branch' | 'rank'

const CUSTOMER_COLUMN_OPTIONS: { label: string; value: CustomerColumnKey }[] = [
  { label: 'Mã khách hàng', value: 'customer_code' },
  { label: 'Tên khách hàng', value: 'full_name' },
  { label: 'Số điện thoại', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Cơ sở', value: 'branch' },
  { label: 'Hạng / Tài khoản', value: 'rank' },
]

const DEFAULT_VISIBLE_COLUMNS = CUSTOMER_COLUMN_OPTIONS.map((column) => column.value)

interface CustomerProfileListFilters {
  branch_id?: string
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

export default function Users() {
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
  const [drawerShellLoading, setDrawerShellLoading] = useState(false)
  const [drawerTabLoading, setDrawerTabLoading] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [qrLookupLoading, setQrLookupLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerProfileRow | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [ranks, setRanks] = useState<CardRank[]>([])
  const [profileFieldDefs, setProfileFieldDefs] = useState<CustomFieldDefWithOptions[]>([])
  const [exporting, setExporting] = useState(false)
  const [resettingQr, setResettingQr] = useState(false)
  const [form] = Form.useForm()
  const [filterForm] = Form.useForm()

  const listParams = buildListParams(filters, keyword, page, limit) as GetCustomerProfilesParams
  const listQuery = useGetCustomerProfiles(listParams)
  const listBody = listQuery.data
  const rows = (listBody?.responseData ?? []) as CustomerProfileRow[]
  const total = listBody?.meta?.total ?? rows.length
  const loading = listQuery.isLoading

  useEffect(() => {
    if (!qrUrl.startsWith('blob:')) return
    return () => URL.revokeObjectURL(qrUrl)
  }, [qrUrl])

  useEffect(() => {
    getBranches()
      .then((body) => setBranches(pickData<Branch[]>(body) ?? []))
      .catch(() => undefined)
    getCardRanks()
      .then((body) => setRanks((pickData<CardRank[]>(body) ?? [])
        .filter((rank) => rank.is_active !== false)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))))
      .catch(() => undefined)
    getCustomFieldDefs({ entity: 'CUSTOMER_PROFILE', is_active: true })
      .then((body) => setProfileFieldDefs(pickData<CustomFieldDefWithOptions[]>(body) ?? []))
      .catch((err) => message.error('Không tải được cấu hình trường hồ sơ: ' + errorMessage(err)))
  }, [])

  const loadProfileDetails = async (profileId: string) => {
    const fresh = pickData<CustomerProfileRow>(await getCustomerProfilesId(profileId))
    setSelected(fresh)
    setQrLoading(profileAccess.canViewQr)
    setQrError('')
    if (!profileAccess.canViewQr) setQrUrl('')
    const [summaryResult, qrResult] = await Promise.allSettled([
      getCustomerProfilesIdSummary(profileId),
      profileAccess.canViewQr ? apiClient.get(`/customerProfiles/${profileId}/qr`, { responseType: 'blob' }) : Promise.resolve(null),
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
    void queryClient.invalidateQueries({ queryKey: getGetCustomerProfilesQueryKey() })
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
    setDrawerShellLoading(true)
    setDrawerTabLoading(false)
    try {
      await loadProfileDetails(row.id)
    } catch (err) {
      message.error(errorMessage(err))
    } finally {
      setDrawerShellLoading(false)
    }
  }

  const lookupQrToken = async (token: string) => {
    setScannerOpen(false)
    setQrLookupLoading(true)
    try {
      const profile = pickData<CustomerProfile>(await getCustomerProfilesByQr({ token }))
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
    if (typeof values.branch_id === 'string' && values.branch_id) next.branch_id = values.branch_id
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
    setSearchText(keyword)
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
      await downloadBlob(`/customerProfiles/export${qs ? `?${qs}` : ''}`, `customer-profiles-${dayjs().format('YYYYMMDD-HHmm')}.csv`)
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
      await postCustomerProfilesIdQrReset(selected.id)
      setQrUrl('')
      setQrLoading(true)
      setQrError('')
      const response = await apiClient.get(`/customerProfiles/${selected.id}/qr`, { responseType: 'blob' })
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
      const fresh = pickData<CustomerProfileRow>(await getCustomerProfilesId(customer.id))
      setEditing(fresh)
      form.setFieldsValue({
        full_name: fresh.full_name,
        phone: fresh.phone,
        email: fresh.email,
        branch_id: fresh.branch_id,
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
    } as unknown as CustomerProfileCreate
    try {
      if (editing) {
        await putCustomerProfilesId(editing.id, payload)
        message.success('Đã cập nhật khách hàng')
      } else {
        await postCustomerProfiles(payload as unknown as { [key: string]: unknown })
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
      await deleteCustomerProfilesId(row.id)
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
    const customerName = escapeHtml(selected.full_name)
    const customerCode = escapeHtml(selected.customer_code)
    const branch = escapeHtml(branches.find((item) => item.id === selected.branch_id)?.name ?? '—')
    printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>QR ${customerCode}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#26352d}.card{width:320px;margin:0 auto;border:1px solid #dce8df;border-radius:16px;padding:22px;text-align:center}.brand{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5b7868}.name{font-size:20px;font-weight:700;margin:10px 0 6px}.code{font-family:monospace;font-size:16px;font-weight:700}.branch{font-size:13px;color:#65756b;margin-top:7px}img{width:210px;height:210px;image-rendering:pixelated;margin-top:16px}@media print{body{padding:0}.card{border:0}}
      </style></head><body><main class="card"><div class="brand">Vista</div><div class="name">${customerName}</div><div class="code">${customerCode}</div><div class="branch">${branch}</div><img src="${qrUrl}" alt="QR ${customerCode}"></main><script>window.onload=()=>{setTimeout(()=>{window.focus();window.print();window.close()},150)}</script></body></html>`)
    printWindow.document.close()
  }

  const branchName = (id?: string) => branches.find((branch) => branch.id === id)?.name ?? '—'
  const rowRankName = (row: CustomerProfileRow) => row.user?.membership?.card_rank?.name
  const activeFilterCount = Object.values(filters).filter((value) => value !== undefined && value !== '').length + (keyword ? 1 : 0)

  return (
    <>
      <PageTitle
        extra={
          <Space wrap>
            {profileAccess.canRead && (
              <Button icon={<QrcodeOutlined />} loading={qrLookupLoading} onClick={() => setScannerOpen(true)}>Quét QR</Button>
            )}
            <Popover
              trigger="click"
              placement="bottomRight"
              open={filterOpen}
              onOpenChange={openFilters}
              content={(
                <div style={{ width: 300, maxHeight: 'min(70vh, 580px)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ overflowY: 'auto', paddingRight: 4 }}>
                    <Input.Search
                      allowClear
                      prefix={<SearchOutlined style={{ color: '#A9ADB2' }} />}
                      placeholder="Tìm tên, SĐT, email, mã KH..."
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      onSearch={() => filterForm.submit()}
                    />

                    <div style={{ marginTop: 16 }}>
                      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
                        <Typography.Text strong>Cột hiển thị</Typography.Text>
                        <Tag style={{ marginInlineEnd: 0 }}>{draftVisibleColumns.length}/{CUSTOMER_COLUMN_OPTIONS.length} cột</Tag>
                      </Space>
                      <Checkbox.Group
                        value={draftVisibleColumns}
                        onChange={(values) => setDraftVisibleColumns(values as CustomerColumnKey[])}
                        style={{ display: 'grid', gap: 10 }}
                        options={CUSTOMER_COLUMN_OPTIONS}
                      />
                    </div>

                    <Divider style={{ margin: '14px 0' }} />
                    <Typography.Text strong>Điều kiện lọc</Typography.Text>
                    <Form form={filterForm} layout="vertical" onFinish={applyFilters} style={{ marginTop: 10 }}>
                      <Form.Item name="branch_id" label="Cơ sở" style={{ marginBottom: 10 }}>
                        <Select allowClear placeholder="Tất cả cơ sở" options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} />
                      </Form.Item>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item name="birth_month" label="Tháng sinh" style={{ marginBottom: 10 }}>
                            <Select allowClear placeholder="Tất cả" options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `Tháng ${index + 1}` }))} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="rank_id" label="Hạng thành viên" style={{ marginBottom: 10 }}>
                            <Select allowClear placeholder="Tất cả" options={ranks.map((rank) => ({ value: rank.id, label: rank.name }))} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Row gutter={8}>
                        <Col span={12}>
                          <Form.Item name="min_spent" label="Chi tiêu từ" style={{ marginBottom: 10 }}>
                            <InputNumber min={0} step={100000} suffix={currencySymbol} placeholder="Tối thiểu" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="max_spent" label="Chi tiêu đến" style={{ marginBottom: 10 }}>
                            <InputNumber min={0} step={100000} suffix={currencySymbol} placeholder="Tối đa" style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="has_debt" label="Công nợ" style={{ marginBottom: 0 }}>
                        <Select allowClear placeholder="Tất cả" options={[{ value: 'true', label: 'Có nợ' }, { value: 'false', label: 'Không nợ' }]} />
                      </Form.Item>
                    </Form>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingTop: 12, marginTop: 12, borderTop: '1px solid var(--brand-border-soft)' }}>
                    <Button onClick={clearFilters}>Xóa lọc</Button>
                    <Button type="primary" onClick={() => filterForm.submit()}>Xác nhận</Button>
                  </div>
                </div>
              )}
            >
              <Button icon={<FilterOutlined />}>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Button>
            </Popover>
            {profileAccess.canExport && (
              <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void downloadCsv()}>
                Xuất CSV
              </Button>
            )}
            {profileAccess.canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => void openModal()}>
                Thêm khách hàng
              </Button>
            )}
          </Space>
        }
      >
        Khách hàng
      </PageTitle>
      <Table<CustomerProfileRow>
        rowKey="id"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 850 }}
        pagination={{ current: page, pageSize: limit, total, onChange: setPage, showSizeChanger: false }}
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
            render: (value: string, row: CustomerProfileRow) => (
              <Space>
                <CustomerAvatar profile={row} />
                <span style={{ fontWeight: 500 }}>{value}</span>
              </Space>
            ),
          },
          { key: 'phone', title: 'Số điện thoại', dataIndex: 'phone' },
          { key: 'email', title: 'Email', dataIndex: 'email', render: (value: string | undefined, row: CustomerProfileRow) => value || row.user?.email || '—' },
          { key: 'branch', title: 'Cơ sở', dataIndex: 'branch_id', render: (value?: string) => branchName(value) },
          {
            title: 'Hạng / Tài khoản',
            key: 'rank',
            width: 160,
            render: (_: unknown, row: CustomerProfileRow) => row.user_id
              ? <Tag color="purple">{rowRankName(row) ?? 'Đã liên kết'}</Tag>
              : <Tag>Chưa liên kết</Tag>,
          },
          {
            key: 'actions',
            title: '',
            width: 140,
            fixed: 'right' as const,
            render: (_: unknown, row: CustomerProfileRow) => (
              <Space>
                {profileAccess.canManage && (
                  <Button size="small" onClick={(event) => { event.stopPropagation(); void openModal(row) }}>
                    Sửa
                  </Button>
                )}
                {profileAccess.canDelete && (
                  <Popconfirm
                    title="Xóa (ẩn) khách hàng này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={(event) => { event?.stopPropagation(); void remove(row) }}
                    onCancel={(event) => event?.stopPropagation()}
                  >
                    <Button size="small" danger onClick={(event) => event.stopPropagation()}>
                      Xóa
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ].filter((column) =>
          (column.key !== 'actions' || profileAccess.canManage) &&
          (column.key === 'actions' || visibleColumns.includes(column.key as CustomerColumnKey)),
        )}
      />

      <Drawer
        title={selected ? `${selected.full_name} — ${selected.customer_code}` : ''}
        width="min(980px, calc(100vw - 24px))"
        open={!!selected}
        onClose={() => {
          setSelected(null)
          setDrawerShellLoading(false)
          setDrawerTabLoading(false)
        }}
      >
        {selected && (
          <Spin spinning={drawerShellLoading || drawerTabLoading} tip="Đang tải toàn bộ hồ sơ…">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <CustomerAvatar profile={selected} size={60} />
              <div style={{ minWidth: 0 }}>
                <Typography.Title level={5} style={{ margin: 0 }}>{selected.full_name}</Typography.Title>
                <Typography.Text type="secondary">{selected.user?.zalo_name || selected.phone}</Typography.Text>
              </div>
            </div>

            {profileAccess.canViewQr && <div style={{ textAlign: 'center', padding: '18px 12px', background: '#FAFBFA', border: '1px solid var(--brand-border-soft)', borderRadius: 12 }}>
              {qrUrl ? (
                <img src={qrUrl} alt={`Mã QR ${selected.customer_code}`} width={180} height={180} style={{ display: 'block', margin: '0 auto' }} />
              ) : qrLoading ? (
                <div role="status" style={{ width: 180, height: 180, margin: '0 auto', display: 'grid', placeItems: 'center', color: '#8A8D93' }}>Đang tải QR…</div>
              ) : (
                <div role="alert" style={{ width: 180, height: 180, margin: '0 auto', display: 'grid', placeItems: 'center', color: '#8A8D93' }}>{qrError || 'Chưa có mã QR'}</div>
              )}
              <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Quét mã để tra cứu khách hàng
              </Typography.Text>
              <Space wrap style={{ justifyContent: 'center', marginTop: 12 }}>
                <Button icon={<DownloadOutlined />} disabled={!qrUrl} onClick={downloadQr}>Tải QR</Button>
                <Button icon={<PrinterOutlined />} disabled={!qrUrl} onClick={printQr}>In QR</Button>
                {profileAccess.isAdmin && (
                  <Popconfirm
                    title="Tạo mã QR mới?"
                    description="Mã QR cũ sẽ không còn hiệu lực."
                    okText="Tạo lại"
                    cancelText="Hủy"
                    onConfirm={() => void resetQr()}
                  >
                    <Button loading={resettingQr}>Tạo lại QR</Button>
                  </Popconfirm>
                )}
              </Space>
            </div>}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
              {profileAccess.canManage && !selected.user_id && (
                <Button
                  icon={<LinkOutlined />}
                  onClick={() => setLinkOpen(true)}
                  style={{ flex: '1 1 180px', minWidth: 0, justifyContent: 'center' }}
                >Liên kết tài khoản</Button>
              )}
              {profileAccess.canManage && (
                <Button
                  icon={<HistoryOutlined />}
                  onClick={() => setHistoryOpen(true)}
                  style={{ flex: selected.user_id ? '0 0 auto' : '1 1 180px', minWidth: 0, justifyContent: 'center' }}
                >Lịch sử mã khách</Button>
              )}
            </div>

            <CustomerProfileDetailsTabs
              key={selected.id}
              profile={selected}
              summary={summary}
              branchName={branchName}
              fieldDefinitions={profileFieldDefs}
              onLoadingChange={setDrawerTabLoading}
            />
          </div>
          </Spin>
        )}
      </Drawer>

      <Modal
        title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12, maxHeight: '68vh', overflowY: 'auto', paddingInlineEnd: 8 }}>
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="VD: Nguyễn Thu Hà" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập SĐT' }]}>
                <Input placeholder="0901234568" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="email@gmail.com" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item name="branch_id" label="Cơ sở" rules={[{ required: true, message: 'Chọn cơ sở' }]}>
                <Select
                  disabled={!!editing}
                  options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                  placeholder="Chọn cơ sở"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="birthday"
                label="Ngày sinh"
                rules={[{
                  validator: async (_, value: Dayjs | undefined) => {
                    if (!value || value.isBefore(dayjs().startOf('day'), 'day')) return
                    throw new Error('Ngày sinh phải trước ngày hiện tại')
                  },
                }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  disabledDate={(current) => !!current && !current.isBefore(dayjs().startOf('day'), 'day')}
                />
              </Form.Item>
            </Col>
          </Row>
          <CustomerProfileCustomFields definitions={profileFieldDefs} />
          <Form.Item name="address" label="Địa chỉ"><Input /></Form.Item>
          <Form.Item name="note" label="Ghi chú"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {scannerOpen && (
        <Suspense fallback={null}>
          <CustomerQrScannerModal open onClose={() => setScannerOpen(false)} onToken={(token) => void lookupQrToken(token)} />
        </Suspense>
      )}

      <LinkCustomerAccountModal
        open={linkOpen}
        profile={selected}
        onCancel={() => setLinkOpen(false)}
        onLinked={refreshSelected}
      />
      <CustomerCodeHistoryModal
        open={historyOpen}
        profileId={selected?.id}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  )
}
