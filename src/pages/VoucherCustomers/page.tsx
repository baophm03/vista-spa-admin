import { useState } from 'react'
import { displayName } from '@/utils/displayName'
import { Alert, Button, Form, Input, Modal, Popconfirm, Select, Table, Tabs, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DeleteOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { useAbility } from '@casl/react'
import PageTitle from '../../components/base/PageTitle'
import ListPagination from '../../components/base/ListPagination'
import { paginateRows } from '../../utils/listTable'
import { errorMessage, pickData, pickMeta } from '@/api/helpers'
import { getCustomerProfilesAdmin } from '@/api/endpoints/customer-profiles'
import type { CustomerProfile } from '@/api/models/customerProfile'
import { getAcademyCourseVoucherCustomersAdmin, postAcademyCourseVoucherCustomersAdmin, deleteAcademyCourseVoucherCustomersIdAdmin } from '@/api/endpoints/academy-course-voucher-customers'
import { getAcademyCourseVouchersAdmin } from '@/api/endpoints/academy-course-vouchers'
import { getTreatmentPackageVoucherCustomersAdmin, postTreatmentPackageVoucherCustomersAdmin, deleteTreatmentPackageVoucherCustomersIdAdmin } from '@/api/endpoints/treatment-package-voucher-customers'
import { getTreatmentPackageVouchersAdmin } from '@/api/endpoints/treatment-package-vouchers'
import { getProductVoucherCustomersAdmin, postProductVoucherCustomersAdmin, deleteProductVoucherCustomersIdAdmin } from '@/api/endpoints/product-voucher-customers'
import { getProductVouchersAdmin } from '@/api/endpoints/product-vouchers'
import { CATEGORY_META, type VoucherCategory, type VoucherCustomerAssignment, type VoucherCustomerRow } from '../Vouchers/components/constants'

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

function VoucherCustomerTab({ category, branches }: { category: VoucherCategory; branches: Array<{ value: string; label: string }> }) {
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
    queryFn: ({ pageParam }) => getCustomerProfilesAdmin({ page: pageParam, limit: 50, ...(customerSearch ? { q: customerSearch } : {}), ...(assignmentBranchId ? { branch_id: assignmentBranchId } : {}) }),
    getNextPageParam: (lastPage, allPages) => {
      const total = pickMeta(lastPage)?.total ?? 0
      const loaded = allPages.reduce((count, pageResult) => count + (pickData<CustomerProfile[]>(pageResult) ?? []).length, 0)
      return loaded < total ? allPages.length + 1 : undefined
    },
  })
  const customerRows = customersQuery.data?.pages.flatMap((pageResult) => pickData<CustomerProfile[]>(pageResult) ?? []) ?? []
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
      await assignMutation.mutateAsync({ voucher_id: values.voucher_id, customer_profile_id: values.customer_profile_id, branch_id: assignmentBranchId })
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

  const columns: TableColumnsType<VoucherCustomerRow> = [
    {
      title: 'Khách hàng / Voucher',
      key: 'mobile-summary',
      width: 210,
      responsive: ['xs'],
      render: (_value: unknown, row: VoucherCustomerRow) => {
        const customer = [row.user_phone, row.rank_name].filter(Boolean).join(' · ')
        const status = row.status === 'ACTIVE' ? 'Hoạt động' : row.status === 'USED' ? 'Đã dùng' : 'Đã gỡ'
        const period = row.start_date || row.end_date
          ? `${row.start_date ? dayjs(row.start_date).format('DD/MM/YYYY') : '—'} → ${row.end_date ? dayjs(row.end_date).format('DD/MM/YYYY') : '—'}`
          : 'Không giới hạn'
        const details = [row.source === 'AUTO' ? 'Tự động' : 'Gán thủ công', row.points_cost == null ? 'Miễn phí' : `${Number(row.points_cost).toLocaleString('vi-VN')} điểm`, status, period]
          .filter(Boolean)
          .join(' · ')
        return (
          <div>
            <Typography.Text strong ellipsis={{ tooltip: row.user_name || '—' }}>{row.user_name || '—'}</Typography.Text>
            {customer && <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: customer }}>{customer}</Typography.Text>}
            <Typography.Text strong style={{ display: 'block' }} ellipsis={{ tooltip: row.voucher_title }}>{row.voucher_title}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: benefitLabel(row) }}>{benefitLabel(row)}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: details }}>{details}</Typography.Text>
          </div>
        )
      },
    },
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
      render: (value: string) => value === 'ACTIVE' ? <Tag color="green">Hoạt động</Tag> : value === 'USED' ? <Tag color="purple">Đã dùng</Tag> : <Tag>Đã gỡ</Tag>,
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
      render: (_value: unknown, row: VoucherCustomerRow) => row.source === 'FIXED' && row.assignment_id && row.status === 'ACTIVE' ? (
        <Popconfirm
          title="Gỡ voucher này khỏi khách hàng?"
          description="Khách sẽ không còn voucher này trên app."
          okText="Gỡ"
          okButtonProps={{ danger: true }}
          cancelText="Hủy"
          onConfirm={() => void revoke(row)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} title="Gỡ voucher" />
        </Popconfirm>
      ) : (
        <Typography.Text type="secondary">—</Typography.Text>
      ),
    }] : []),
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên, SĐT hoặc tên voucher"
            style={{ maxWidth: 300 }}
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); setPage(1) }}
            onPressEnter={() => setSearch(searchInput.trim())}
            onBlur={() => setSearch(searchInput.trim())}
          />
          <Select
            value={branchFilter ?? 'ALL'}
            style={{ width: 220 }}
            options={[{ value: 'ALL', label: 'Tất cả cơ sở' }, ...branches]}
            onChange={(value) => { setBranchFilter(value === 'ALL' ? undefined : value); setPage(1) }}
          />
        </div>
        {canUpdate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.resetFields()
            setCustomerSearch('')
            setAssignmentBranchId(branchFilter ?? (branches.length === 1 ? branches[0].value : undefined))
            setAssignOpen(true)
          }}>
            Đổi voucher
          </Button>
        )}
      </div>
      {viewQuery.isError && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không tải được danh sách voucher khách hàng" description={errorMessage(viewQuery.error)} action={<Button size="small" onClick={() => void viewQuery.refetch()}>Thử lại</Button>} />
      )}
      <Table<VoucherCustomerRow>
        className="[&_.ant-table-thead_th]:whitespace-nowrap"
        rowKey={(row) => `${row.source}-${row.assignment_id ?? row.voucher_id}-${row.customer_profile_id ?? row.user_id ?? 'customer'}`}
        loading={viewQuery.isLoading}
        dataSource={paginateRows(rows, page, PAGE_SIZE)}
        pagination={false}
        columns={columns}
        tableLayout="fixed"
        locale={{ emptyText: 'Chưa có khách hàng nào được ghi nhận' }}
      />
      <ListPagination page={page} limit={PAGE_SIZE} total={rows.length} onChange={setPage} noun="bản ghi" hideOnSinglePage />

      <Modal
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
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
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
                form.setFieldsValue({ customer_profile_id: undefined, voucher_id: undefined })
              }}
            />
          </Form.Item>
          <Form.Item
            name="customer_profile_id"
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
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as VoucherCategory)}
        items={CATEGORIES.map((category) => ({
          key: category,
          label: CATEGORY_META[category].label,
          children: <VoucherCustomerTab category={category} branches={branches} />,
        }))}
      />
    </>
  )
}
