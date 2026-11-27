import MobileCards, { MobileCardRow } from '@/components/base/MobileCards'
import { useState } from 'react'
import { Alert, Button, Form, Grid, Input, Modal, Popconfirm, Popover, Select, Table, Tabs, Tag, Typography, message } from 'antd'
import { displayName } from '@/utils/displayName'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, FilterOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useAbility } from '@casl/react'
import PageTitle from '../../components/base/PageTitle'
import ListPagination from '../../components/base/ListPagination'
import { paginateRows } from '../../utils/listTable'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { getUsersCustomersAdmin } from '@/api/endpoints/customers'
import type { Customer } from '@/api/models/customer'
import { getAcademyCourseVoucherCustomersAdmin, postAcademyCourseVoucherCustomersAdmin, deleteAcademyCourseVoucherCustomersIdAdmin } from '@/api/endpoints/academy-course-voucher-customers'
import { getAcademyCourseVouchersAdmin } from '@/api/endpoints/academy-course-vouchers'
import { getTreatmentPackageVoucherCustomersAdmin, postTreatmentPackageVoucherCustomersAdmin, deleteTreatmentPackageVoucherCustomersIdAdmin } from '@/api/endpoints/treatment-package-voucher-customers'
import { getTreatmentPackageVouchersAdmin } from '@/api/endpoints/treatment-package-vouchers'
import { getProductVoucherCustomersAdmin, postProductVoucherCustomersAdmin, deleteProductVoucherCustomersIdAdmin } from '@/api/endpoints/product-voucher-customers'
import { getProductVouchersAdmin } from '@/api/endpoints/product-vouchers'
import { CATEGORY_META, type VoucherCategory, type VoucherCustomerAssignment, type VoucherCustomerRow } from '../Vouchers/components/constants'
import '../Vouchers/vouchers.css'
import '../Vouchers/components/VoucherModal.css'

// Dispatch theo danh mục — generated client tách 3 module *-voucher-customers (URL /admin).
function listVoucherCategory(category: VoucherCategory, params: Record<string, unknown> = {}) {
  if (category === 'treatment-package') return getTreatmentPackageVouchersAdmin(params as never)
  if (category === 'academy-course') return getAcademyCourseVouchersAdmin(params as never)
  return getProductVouchersAdmin(params as never)
}

function getVoucherCustomerView(category: VoucherCategory, params: Record<string, unknown> = {}) {
  if (category === 'treatment-package') return getTreatmentPackageVoucherCustomersAdmin(params as never)
  if (category === 'academy-course') return getAcademyCourseVoucherCustomersAdmin(params as never)
  return getProductVoucherCustomersAdmin(params as never)
}
function assignVoucherCustomer(category: VoucherCategory, body: VoucherCustomerAssignment) {
  if (category === 'treatment-package') return postTreatmentPackageVoucherCustomersAdmin(body as never)
  if (category === 'academy-course') return postAcademyCourseVoucherCustomersAdmin(body as never)
  return postProductVoucherCustomersAdmin(body as never)
}
function revokeVoucherCustomer(category: VoucherCategory, assignmentId: string) {
  if (category === 'treatment-package') return deleteTreatmentPackageVoucherCustomersIdAdmin(assignmentId)
  if (category === 'academy-course') return deleteAcademyCourseVoucherCustomersIdAdmin(assignmentId)
  return deleteProductVoucherCustomersIdAdmin(assignmentId)
}
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import type { Branch } from '@/api/models/branch'

const PAGE_SIZE = 10
const CATEGORIES: VoucherCategory[] = ['treatment-package', 'academy-course', 'product']

function toRows<T = VoucherCustomerRow>(payload: unknown): T[] {
  const data = pickData<any>(payload)
  if (Array.isArray(data)) return data
  return Array.isArray(data?.rows) ? data.rows : []
}

function benefitLabel(row: VoucherCustomerRow): string {
  if (row.discount_type === 'GIFT') return 'Ưu đãi cũ cần cập nhật'
  if (row.discount_type === 'PERCENT') return `Giảm ${Number(row.discount_value ?? 0)}%`
  if (row.discount_type === 'AMOUNT') return `Giảm ${Number(row.discount_value ?? 0).toLocaleString('vi-VN')} đ`
  return '—'
}

function VoucherCustomerTab({ category, branches, isMobile }: { category: VoucherCategory; branches: Array<{ value: string; label: string }>; isMobile: boolean }) {
  const ability = useAbility()
  const canUpdate = ability.can('UPDATE', 'VOUCHER')
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<string | undefined>()
  const [assignmentBranchId, setAssignmentBranchId] = useState<string | undefined>()
  const [form] = Form.useForm()

  const viewQuery = useQuery({
    queryKey: ['voucher-customer-view', category, search, branchFilter],
    queryFn: () => getVoucherCustomerView(category, { ...(search ? { q: search } : {}), ...(branchFilter ? { branch_id: branchFilter } : {}) }),
  })
  const rows = toRows(viewQuery.data)

  // Danh sách voucher đang hoạt động của loại này để gán (voucher Cố định là chính).
  const vouchersQuery = useQuery({
    queryKey: ['voucher-category', category, assignmentBranchId],
    queryFn: () => listVoucherCategory(category, assignmentBranchId ? { branch_id: assignmentBranchId } : {}),
  })
  const voucherOptions = toRows<{ id: string; title: string; branch_id?: string | null; branch_name?: string | null; is_active: boolean; end_date?: string | null }>(vouchersQuery.data)
    .filter((row) => row.is_active && (!row.end_date || dayjs(row.end_date).isAfter(dayjs(), 'day')))
    .filter((row) => !row.branch_id || (assignmentBranchId && row.branch_id === assignmentBranchId))
    .map((row) => ({ value: row.id, label: row.branch_name ? `${row.title} · ${row.branch_name}` : row.title }))

  // Chọn khách hàng — chỉ mở khi modal gán đang mở.
  const customersQuery = useInfiniteQuery({
    queryKey: ['voucher-customer-select', customerSearch, assignmentBranchId],
    enabled: assignOpen && Boolean(assignmentBranchId),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => getUsersCustomersAdmin({ page: pageParam, limit: 50, ...(customerSearch ? { q: customerSearch } : {}), ...(assignmentBranchId ? { branch_id: assignmentBranchId } : {}) }),
    getNextPageParam: (lastPage, allPages) => {
      const total = pickMeta(lastPage)?.total ?? 0
      const loaded = allPages.reduce((count, pageResult) => count + (pickData<Customer[]>(pageResult) ?? []).length, 0)
      return loaded < total ? allPages.length + 1 : undefined
    },
  })
  const customerRows = customersQuery.data?.pages.flatMap((pageResult) => pickData<Customer[]>(pageResult) ?? []) ?? []
  const customerOptions = customerRows.map((customer) => ({
    value: customer.id,
    label: [displayName(customer), customer.phone, customer.customer_code].filter(Boolean).join(' · '),
  }))

  const assignMutation = useMutation({
    mutationFn: (body: VoucherCustomerAssignment) => assignVoucherCustomer(category, body),
  })
  const revokeMutation = useMutation({
    mutationFn: (assignmentId: string) => revokeVoucherCustomer(category, assignmentId),
  })

  const submitAssign = async () => {
    try {
      const values = await form.validateFields()
      await assignMutation.mutateAsync({ voucher_id: values.voucher_id, user_id: values.user_id, branch_id: assignmentBranchId })
      message.success('Đã đổi voucher cho khách hàng')
      form.resetFields()
      setCustomerSearch('')
      setAssignOpen(false)
      setPage(1)
      await queryClient.invalidateQueries({ queryKey: ['voucher-customer-view', category] })
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err, 'Không thể đổi voucher'))
    }
  }

  const revoke = async (row: VoucherCustomerRow) => {
    if (!row.assignment_id) return
    try {
      await revokeMutation.mutateAsync(row.assignment_id)
      message.success('Đã gỡ voucher khỏi khách hàng')
      await queryClient.invalidateQueries({ queryKey: ['voucher-customer-view', category] })
    } catch (err) {
      message.error(errorMessage(err, 'Không thể gỡ voucher'))
    }
  }

  const statusTag = (status: VoucherCustomerRow['status']) =>
    status === 'ACTIVE' ? <Tag color="green">Hoạt động</Tag> : status === 'USED' ? <Tag color="purple">Đã dùng</Tag> : <Tag>Đã gỡ</Tag>
  const renderRevoke = (row: VoucherCustomerRow, mobile = false) => {
    if (!canUpdate || row.source !== 'FIXED' || !row.assignment_id || row.status !== 'ACTIVE') return null
    return (
      <Popconfirm
        title="Gỡ voucher này khỏi khách hàng?"
        description="Khách sẽ không còn voucher này trên app."
        okText="Gỡ"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        onConfirm={() => void revoke(row)}
      >
        <Button size="small" danger icon={<DeleteOutlined />} aria-label="Gỡ voucher" title="Gỡ voucher">
          {mobile ? 'Gỡ voucher' : null}
        </Button>
      </Popconfirm>
    )
  }

  const columns: TableColumnsType<VoucherCustomerRow> = [
    {
      title: 'Khách hàng',
      dataIndex: 'user_name',
      width: 160,
      responsive: ['sm'],
      render: (value: string | null | undefined, row) => (
        <div>
          <Typography.Text strong ellipsis={{ tooltip: value || '—' }}>{value || '—'}</Typography.Text>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: [row.user_phone, row.rank_name].filter(Boolean).join(' · ') }}>
            {[row.user_phone, row.rank_name].filter(Boolean).join(' · ') || '—'}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Voucher',
      dataIndex: 'voucher_title',
      width: 180,
      responsive: ['sm'],
      ellipsis: true,
      render: (value: string, row) => (
        <div>
          <Typography.Text strong ellipsis={{ tooltip: value }}>{value}</Typography.Text>
          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{benefitLabel(row)}</Typography.Text></div>
        </div>
      ),
    },
    {
      title: 'Cơ sở',
      dataIndex: 'branch_name',
      width: 130,
      responsive: ['lg'],
      render: (value?: string | null) => value || '—',
    },
    {
      title: 'Phát hành',
      key: 'source-points',
      width: 120,
      responsive: ['xl'],
      render: (_value: unknown, row: VoucherCustomerRow) => (
        <div>
          <Tag color={row.source === 'AUTO' ? 'cyan' : 'blue'}>{row.source === 'AUTO' ? 'Tự động' : 'Gán tay'}</Tag>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            {row.points_cost == null ? 'Miễn phí' : `${Number(row.points_cost).toLocaleString('vi-VN')} điểm`}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 85,
      responsive: ['sm'],
      render: statusTag,
    },
    {
      title: 'Thời hạn',
      key: 'period',
      width: 145,
      responsive: ['xl'],
      render: (_value: unknown, row: VoucherCustomerRow) => {
        const start = row.start_date ? dayjs(row.start_date).format('DD/MM/YYYY') : null
        const end = row.end_date ? dayjs(row.end_date).format('DD/MM/YYYY') : null
        const expired = Boolean(row.end_date && dayjs(row.end_date).isBefore(dayjs(), 'day'))
        const period = !start && !end ? 'Không giới hạn' : `${start ?? '—'} → ${end ?? '—'}`
        return <Typography.Text type={expired ? 'secondary' : undefined} delete={expired} ellipsis={{ tooltip: period }}>{period}</Typography.Text>
      },
    },
    ...(canUpdate ? [{
      title: 'Thao tác',
      key: 'actions',
      align: 'center' as const,
      width: 88,
      render: (_value: unknown, row: VoucherCustomerRow) => renderRevoke(row) ?? <Typography.Text type="secondary">—</Typography.Text>,
    }] : []),
  ]

  const pageRows = paginateRows(rows, page, PAGE_SIZE)
  const rowKey = (row: VoucherCustomerRow) => `${row.source}-${row.assignment_id ?? row.voucher_id}-${row.user_id ?? row.user_id ?? 'customer'}`
  const branchSelect = (
    <Select
      aria-label="Lọc theo cơ sở"
      value={branchFilter ?? 'ALL'}
      className="voucher-branch-select"
      options={[{ value: 'ALL', label: 'Tất cả cơ sở' }, ...branches]}
      onChange={(value) => { setBranchFilter(value === 'ALL' ? undefined : value); setPage(1) }}
    />
  )
  const applySearch = (value: string) => {
    const keyword = value.trim()
    if (keyword === search) return
    setSearch(keyword)
    setPage(1)
  }
  const changeSearchInput = (value: string) => {
    setSearchInput(value)
    if (!value) applySearch('')
  }

  return (
    <>
      {/* docs 6.2.1: mobile → [Tìm] / [Bộ lọc][+] */}
      <div className="voucher-toolbar" style={isMobile ? undefined : { gap: 16 }}>
        <div className="voucher-toolbar-search" style={isMobile ? undefined : { gap: 8 }}>
          {isMobile ? (
            <>
              <Input.Search
                allowClear
                className="voucher-search"
                placeholder="Tên, SĐT, voucher"
                aria-label="Tìm theo tên, SĐT hoặc tên voucher"
                value={searchInput}
                onChange={(event) => changeSearchInput(event.target.value)}
                onSearch={applySearch}
              />
              <Popover trigger="click" placement="bottomRight" title="Lọc theo cơ sở" content={branchSelect}>
                <Button className="voucher-filter-button" type={branchFilter ? 'primary' : 'default'} icon={<FilterOutlined />} aria-label="Bộ lọc cơ sở">Bộ lọc</Button>
              </Popover>
            </>
          ) : (
            <>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Tìm theo tên, SĐT hoặc tên voucher"
                className="voucher-customer-search"
                value={searchInput}
                onChange={(event) => changeSearchInput(event.target.value)}
                onPressEnter={() => applySearch(searchInput)}
                onBlur={() => applySearch(searchInput)}
              />
              {branchSelect}
            </>
          )}
        </div>
        {canUpdate && (
          <Button type="primary" className="voucher-toolbar-button" icon={<PlusOutlined />} aria-label="Đổi voucher" onClick={() => {
            form.resetFields()
            setCustomerSearch('')
            setAssignmentBranchId(branchFilter ?? (branches.length === 1 ? branches[0].value : undefined))
            setAssignOpen(true)
          }}>
            {isMobile ? null : 'Đổi voucher'}
          </Button>
        )}
      </div>
      {viewQuery.isError && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không tải được danh sách voucher khách hàng" description={errorMessage(viewQuery.error)} action={<Button size="small" onClick={() => void viewQuery.refetch()}>Thử lại</Button>} />
      )}
      <Table<VoucherCustomerRow>
        className="desktop-only voucher-table [&_.ant-table-thead_th]:whitespace-nowrap"
        rowKey={rowKey}
        loading={viewQuery.isLoading}
        dataSource={pageRows}
        pagination={false}
        columns={columns}
        tableLayout="fixed"
        locale={{ emptyText: 'Chưa có khách hàng nào được ghi nhận' }}
      />
      <MobileCards
        className="voucher-card-list"
        rows={pageRows}
        rowKey={rowKey}
        loading={viewQuery.isLoading}
        emptyText={search || branchFilter ? 'Không tìm thấy voucher khách hàng' : 'Chưa có khách hàng nào được ghi nhận'}
        renderCard={(row) => {
          const contact = [row.user_phone, row.rank_name].filter(Boolean).join(' · ')
          const benefit = benefitLabel(row)
          const source = row.source === 'AUTO' ? 'Tự động' : 'Gán thủ công'
          const points = row.points_cost == null ? 'Miễn phí' : `${Number(row.points_cost).toLocaleString('vi-VN')} điểm`
          const start = row.start_date && dayjs(row.start_date).format('DD/MM/YYYY')
          const end = row.end_date && dayjs(row.end_date).format('DD/MM/YYYY')
          const period = start && end ? `${start} – ${end}` : start ? `Từ ${start}` : end ? `Đến ${end}` : 'Không giới hạn'
          return (
            <div className="voucher-mobile-card">
              <div className="voucher-card-header">
                <div className="min-w-0">
                  <div className="mobile-card-title">{row.user_name || '—'}</div>
                  {contact && <div className="mobile-card-sub">{contact}</div>}
                </div>
                {statusTag(row.status)}
              </div>
              <div className="voucher-card-benefit">
                <div className="mobile-card-title">{row.voucher_title}</div>
                {benefit !== '—' && <strong>{benefit}</strong>}
              </div>
              <div className="mobile-card-rows">
                <MobileCardRow label="Cơ sở" value={row.branch_name || '—'} />
                <MobileCardRow label="Phát hành" value={`${source} · ${points}`} />
              </div>
              <div className="voucher-card-footer">
                <div className="min-w-0">
                  <div className="mobile-card-sub">Thời hạn</div>
                  <div className="text-xs font-medium">{period}</div>
                </div>
                {renderRevoke(row, true)}
              </div>
            </div>
          )
        }}
      />
      <ListPagination page={page} limit={PAGE_SIZE} total={rows.length} onChange={setPage} noun="bản ghi" hideOnSinglePage />

      <Modal
        className="voucher-editor-modal"
        title={`Đổi ${CATEGORY_META[category].label.toLowerCase()} cho khách hàng`}
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={() => void submitAssign()}
        confirmLoading={assignMutation.isPending}
        okText="Đổi"
        cancelText="Hủy"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className={isMobile ? 'voucher-form' : undefined} style={{ marginTop: 12 }}>
          <Form.Item label="Cơ sở" required>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={assignmentBranchId}
              placeholder="Chọn cơ sở"
              options={branches}
              onChange={(value) => {
                setAssignmentBranchId(value || undefined)
                setCustomerSearch('')
                form.setFieldsValue({ user_id: undefined, voucher_id: undefined })
              }}
            />
          </Form.Item>
          <Form.Item
            name="user_id"
            label="Khách hàng"
            rules={[{ required: true, message: 'Chọn khách hàng' }]}
          >
            <Select
              showSearch
              allowClear
              disabled={!assignmentBranchId}
              filterOption={false}
              placeholder={assignmentBranchId ? 'Tìm theo tên, SĐT hoặc mã khách hàng' : 'Chọn cơ sở trước'}
              options={customerOptions}
              onSearch={(value) => setCustomerSearch(value.trim())}
              onPopupScroll={(event) => {
                const element = event.currentTarget
                if (
                  element.scrollTop + element.clientHeight >= element.scrollHeight - 24
                  && customersQuery.hasNextPage
                  && !customersQuery.isFetchingNextPage
                ) {
                  void customersQuery.fetchNextPage()
                }
              }}
              loading={customersQuery.isFetching}
              notFoundContent={customersQuery.isFetching ? 'Đang tải khách hàng...' : 'Không tìm thấy khách hàng'}
            />
          </Form.Item>
          <Form.Item name="voucher_id" label="Voucher" rules={[{ required: true, message: 'Chọn voucher' }]}>
            <Select
              showSearch
              allowClear
              disabled={!assignmentBranchId}
              optionFilterProp="label"
              placeholder={assignmentBranchId ? 'Chỉ voucher đang hoạt động' : 'Chọn cơ sở trước'}
              options={voucherOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default function VoucherCustomers() {
  const [activeTab, setActiveTab] = useState<VoucherCategory>('treatment-package')
  const isMobile = !Grid.useBreakpoint().md
  const branchesQuery = useGetBranchesAdmin({ status: 'active' })
  const branches = ((pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[])
    .filter((branch) => branch.is_active !== false)
    .map((branch) => ({ value: branch.id, label: branch.name }))
  return (
    <>
      <PageTitle subtitle="Đổi voucher cho khách hàng và xem các voucher khách đang có (tự động theo hạng hoặc gán tay)">
        Voucher khách hàng
      </PageTitle>
      <Tabs
        className="voucher-tabs"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as VoucherCategory)}
        items={CATEGORIES.map((category) => ({
          key: category,
          label: CATEGORY_META[category].label,
          children: <VoucherCustomerTab category={category} branches={branches} isMobile={isMobile} />,
        }))}
      />
    </>
  )
}
