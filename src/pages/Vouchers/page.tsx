import { useState } from 'react'
import { Alert, Button, Form, Input, Modal, Select, Table, Tabs, Tag, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, GiftOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { Can, useAbility } from '@casl/react'
import { useGetCardRanksAdmin } from '@/api/endpoints/card-ranks'
import { useGetBranchesAdmin } from '@/api/endpoints/branches'
import type { Branch } from '@/api/models/branch'
import PageTitle from '../../components/base/PageTitle'
import StatCards, { type StatItem } from '../../components/base/StatCards'
import RowActionsMenu from '../../components/base/RowActionsMenu'
import ListPagination from '../../components/base/ListPagination'
import { errorMessage, pickData } from '@/api/helpers'
import { getTreatmentPackagesAdmin } from '@/api/endpoints/treatment-packages'
import { getAcademyCoursesAdmin } from '@/api/endpoints/academy'
import { getProductCategoriesAdmin } from '@/api/endpoints/product-categories'
import { getProductsAdmin } from '@/api/endpoints/products'
import {
  deleteTreatmentPackageVouchersIdAdmin,
  getTreatmentPackageVouchersAdmin,
  postTreatmentPackageVouchersAdmin,
  putTreatmentPackageVouchersIdAdmin,
} from '@/api/endpoints/treatment-package-vouchers'
import {
  deleteAcademyCourseVouchersIdAdmin,
  getAcademyCourseVouchersAdmin,
  postAcademyCourseVouchersAdmin,
  putAcademyCourseVouchersIdAdmin,
} from '@/api/endpoints/academy-course-vouchers'
import {
  deleteProductVouchersIdAdmin,
  getProductVouchersAdmin,
  postProductVouchersAdmin,
  putProductVouchersIdAdmin,
} from '@/api/endpoints/product-vouchers'
import type { ProductCategory } from '@/api/models/productCategory'
import VoucherModal from './components/VoucherModal'
import { CATEGORY_META, type VoucherCategory, type VoucherCategoryRow, type VoucherCategoryWrite } from './components/constants'
import { useBrandCurrency } from '@/themeRuntime'

const PAGE_SIZE = 10
const CATEGORIES: VoucherCategory[] = ['treatment-package', 'academy-course', 'product']

// Dispatch theo danh mục —generated client tách CRUD voucher theo 3 module *-vouchers (URL /admin).
function listVoucherCategory(category: VoucherCategory, params: Record<string, unknown>) {
  if (category === 'treatment-package') return getTreatmentPackageVouchersAdmin(params as never)
  if (category === 'academy-course') return getAcademyCourseVouchersAdmin(params as never)
  return getProductVouchersAdmin(params as never)
}
function createVoucherCategory(category: VoucherCategory, body: VoucherCategoryWrite) {
  if (category === 'treatment-package') return postTreatmentPackageVouchersAdmin(body as never)
  if (category === 'academy-course') return postAcademyCourseVouchersAdmin(body as never)
  return postProductVouchersAdmin(body as never)
}
function updateVoucherCategory(category: VoucherCategory, id: string, body: VoucherCategoryWrite) {
  if (category === 'treatment-package') return putTreatmentPackageVouchersIdAdmin(id, body as never)
  if (category === 'academy-course') return putAcademyCourseVouchersIdAdmin(id, body as never)
  return putProductVouchersIdAdmin(id, body as never)
}
function removeVoucherCategory(category: VoucherCategory, id: string) {
  if (category === 'treatment-package') return deleteTreatmentPackageVouchersIdAdmin(id)
  if (category === 'academy-course') return deleteAcademyCourseVouchersIdAdmin(id)
  return deleteProductVouchersIdAdmin(id)
}

function toRows(payload: unknown): VoucherCategoryRow[] {
  const data = pickData<any>(payload)
  return Array.isArray(data) ? data : []
}

function toTargets(payload: unknown, collectionKeys: string[]) {
  const data = pickData<any>(payload)
  const list = Array.isArray(data) ? data : collectionKeys.map((key) => data?.[key]).find(Array.isArray) ?? []
  return (list as any[]).map((item) => ({
    value: String(item.id),
    label: String(item.name ?? item.title ?? item.package_name ?? item.course_name ?? 'Chưa có tên'),
  }))
}

async function loadTargets(category: VoucherCategory) {
  if (category === 'treatment-package') {
    return toTargets(await getTreatmentPackagesAdmin({ page: 1, limit: 200, is_active: true }), ['rows', 'items', 'treatment_packages', 'packages'])
  }
  if (category === 'academy-course') {
    return toTargets(await getAcademyCoursesAdmin({ is_active: true }), ['rows', 'items', 'courses'])
  }
  return toTargets(await getProductsAdmin({ is_active: true }), ['rows', 'items', 'products'])
}

function VoucherCategoryTab({ category }: { category: VoucherCategory }) {
  const ability = useAbility()
  const { format: formatMoney } = useBrandCurrency()
  const canUpdate = ability.can('UPDATE', 'VOUCHER')
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<VoucherCategoryRow | null>(null)
  const [branchFilter, setBranchFilter] = useState<string | undefined>()
  const [form] = Form.useForm()
  const meta = CATEGORY_META[category]
  const listKey = ['voucher-category', category, branchFilter]
  const listKeyBase = ['voucher-category', category]

  const applySearch = (nextKeyword: string) => {
    setSearchInput(nextKeyword)
    setSearch(nextKeyword.trim())
    setPage(1)
  }

  const vouchersQuery = useQuery({
    queryKey: [...listKey, page, search],
    queryFn: () => listVoucherCategory(category, {
      page,
      limit: PAGE_SIZE,
      ...(search ? { q: search } : {}),
      ...(branchFilter ? { branch_id: branchFilter } : {}),
    }),
  })
  const branchesQuery = useGetBranchesAdmin({ status: 'active' })
  const targetsQuery = useQuery({ queryKey: ['voucher-category-targets', category], queryFn: () => loadTargets(category) })
  const productCategoriesQuery = useQuery({
    queryKey: ['voucher-product-categories'],
    enabled: category === 'product',
    queryFn: async () => {
      const categories = pickData<ProductCategory[]>(await getProductCategoriesAdmin()) ?? []
      return categories.filter((item) => item.is_active !== false).map((item) => ({ value: item.id, label: item.name }))
    },
  })
  const ranksQuery = useGetCardRanksAdmin({ is_active: true })
  const rows = toRows(vouchersQuery.data)
  const total = (vouchersQuery.data as unknown as { meta?: { total?: number } })?.meta?.total ?? rows.length
  const statsMeta = (vouchersQuery.data as unknown as { meta?: { stats?: { total?: number; active?: number; expired?: number } } })?.meta?.stats
  const targets = targetsQuery.data ?? []
  const productCategories = productCategoriesQuery.data ?? []
  const branches = ((pickData<Branch[]>(branchesQuery.data) ?? []) as Branch[])
    .filter((branch) => branch.is_active !== false)
    .map((branch) => ({ value: branch.id, label: branch.name }))
  const ranks = (ranksQuery.data?.responseData ?? [])
    .filter((rank) => rank.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((rank) => ({ value: rank.id, label: rank.name }))
  const targetLabelFor = (row: VoucherCategoryRow) => category === 'product' && row.product_category_id
    ? `Danh mục: ${row.target_name || '—'}`
    : row.target_name || `Tất cả ${meta.label.replace('Voucher ', '').toLowerCase()}`
  const createMutation = useMutation({ mutationFn: (body: VoucherCategoryWrite) => createVoucherCategory(category, body) })
  const updateMutation = useMutation({ mutationFn: ({ id, body }: { id: string; body: VoucherCategoryWrite }) => updateVoucherCategory(category, id, body) })
  const hideMutation = useMutation({ mutationFn: (id: string) => removeVoucherCategory(category, id) })

  const statItems: StatItem[] = [
    { key: 'total', label: 'Tổng voucher', value: (statsMeta?.total ?? total).toLocaleString('vi-VN'), icon: <GiftOutlined />, tone: 'primary' },
    { key: 'active', label: 'Đang hoạt động', value: (statsMeta?.active ?? 0).toLocaleString('vi-VN'), icon: <CheckCircleOutlined />, tone: 'secondary' },
    { key: 'expired', label: 'Đã hết hạn', value: (statsMeta?.expired ?? 0).toLocaleString('vi-VN'), icon: <ClockCircleOutlined />, tone: 'neutral' },
  ]

  const openModal = (row?: VoucherCategoryRow) => {
    setEditing(row ?? null)
    form.resetFields()
    if (row) {
      form.setFieldsValue({
        ...row,
        [meta.targetField]: row[meta.targetField] ?? undefined,
        product_target_type: row.product_category_id ? 'CATEGORY' : row.product_id ? 'PRODUCT' : 'ALL',
        product_category_id: row.product_category_id ?? undefined,
        branch_id: row.branch_id ?? undefined,
        quantity_total: row.quantity_total ?? undefined,
        card_rank_id: category === 'academy-course' || row.issue_mode === 'FIXED' ? undefined : row.card_rank_id ?? undefined,
        issue_mode: row.issue_mode ?? 'AUTO',
        points_cost: row.points_cost ?? undefined,
        discount_type: row.discount_type === 'GIFT' ? undefined : row.discount_type ?? (category === 'academy-course' ? 'PERCENT' : 'AMOUNT'),
        discount_value: row.discount_type === 'GIFT' ? undefined : Number(row.discount_value ?? 0),
        minimum_order_amount: Number(row.minimum_order_amount ?? 0),
        maximum_discount_amount: row.maximum_discount_amount == null ? undefined : Number(row.maximum_discount_amount),
        minimum_tuition: Number(row.minimum_tuition ?? 0),
        max_uses_per_student: row.max_uses_per_student ?? 1,
        start_date: row.start_date ? dayjs(row.start_date) : undefined,
        end_date: row.end_date ? dayjs(row.end_date) : undefined,
        date_range: row.start_date || row.end_date
          ? [row.start_date ? dayjs(row.start_date) : null, row.end_date ? dayjs(row.end_date) : null]
          : undefined,
      })
    } else {
      form.setFieldsValue({ title: '', branch_id: undefined, card_rank_id: undefined, issue_mode: 'AUTO', points_cost: undefined, is_active: true, product_target_type: 'ALL', product_id: undefined, product_category_id: undefined, discount_type: category === 'treatment-package' || category === 'product' ? 'AMOUNT' : category === 'academy-course' ? 'PERCENT' : undefined, discount_value: undefined, minimum_tuition: 0, minimum_order_amount: 0, maximum_discount_amount: undefined, max_uses_per_student: 1 })
    }
    setOpen(true)
  }

  const submit = async () => {
    try {
      const values = await form.validateFields()
      const formValues = { ...values }
      delete formValues.date_range
      delete formValues.product_target_type
      const targetValues = category === 'product'
        ? {
            product_id: values.product_target_type === 'PRODUCT' ? values.product_id || null : null,
            product_category_id: values.product_target_type === 'CATEGORY' ? values.product_category_id || null : null,
          }
        : { [meta.targetField]: values[meta.targetField] || null }
      const body: VoucherCategoryWrite = {
        ...formValues,
        ...targetValues,
        branch_id: values.branch_id || null,
        discount_value: values.discount_value,
        issue_mode: values.issue_mode === 'FIXED' ? 'FIXED' : 'AUTO',
        ...(values.issue_mode === 'FIXED'
          ? { card_rank_id: null }
          : {
              ...(category !== 'academy-course' ? { card_rank_id: values.card_rank_id || null } : {}),
            }),
        points_cost: values.points_cost ?? null,
        quantity_total: values.quantity_total ?? null,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, body })
        message.success('Đã cập nhật voucher')
      } else {
        await createMutation.mutateAsync(body)
        message.success('Đã thêm voucher')
      }
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: listKeyBase })
    } catch (err) {
      if ((err as { errorFields?: unknown })?.errorFields) return
      message.error(errorMessage(err, 'Không thể lưu voucher'))
    }
  }

  const remove = async (row: VoucherCategoryRow) => {
    try {
      await hideMutation.mutateAsync(row.id)
      message.success('Đã xóa voucher')
      await queryClient.invalidateQueries({ queryKey: listKeyBase })
    } catch (err) {
      message.error(errorMessage(err, 'Không thể xóa voucher'))
    }
  }

  const columns: TableColumnsType<VoucherCategoryRow> = [
    {
      title: 'Voucher',
      key: 'mobile-summary',
      width: 210,
      responsive: ['xs'],
      render: (_value: unknown, row: VoucherCategoryRow) => {
        const target = targetLabelFor(row)
        const benefit = row.discount_type === 'GIFT'
          ? 'Ưu đãi cũ cần cập nhật'
          : row.discount_type === 'AMOUNT'
            ? `Giảm ${formatMoney(row.discount_value)}`
            : `Giảm ${Number(row.discount_value ?? 0).toLocaleString('vi-VN')}%`
        const expired = Boolean(row.end_date && dayjs(row.end_date).isBefore(dayjs(), 'day'))
        const status = expired ? 'Hết hạn' : row.is_active ? 'Hoạt động' : 'Tắt'
        const period = row.start_date || row.end_date
          ? `${row.start_date ? dayjs(row.start_date).format('DD/MM/YYYY') : '—'} → ${row.end_date ? dayjs(row.end_date).format('DD/MM/YYYY') : '—'}`
          : 'Không giới hạn'
        const issue = row.issue_mode === 'FIXED'
          ? 'Gán thủ công'
          : `Tự động${category !== 'academy-course' ? ` · ${row.card_rank_name || 'Mọi hạng'}` : ''}`
        const details = [row.branch_name || 'Tất cả cơ sở', issue, row.points_cost == null ? 'Miễn phí' : `${Number(row.points_cost).toLocaleString('vi-VN')} điểm`, status, period].join(' · ')
        return (
          <div>
            <Typography.Text strong ellipsis={{ tooltip: row.title }}>{row.title}</Typography.Text>
            <Typography.Text style={{ display: 'block' }} ellipsis={{ tooltip: benefit }}>{benefit}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: target }}>{target}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: details }}>{details}</Typography.Text>
          </div>
        )
      },
    },
    {
      title: 'Voucher', dataIndex: 'title', width: 165,
      responsive: ['sm'],
      render: (value: string, row) => {
        const target = targetLabelFor(row)
        return (
          <div>
            <Typography.Text strong ellipsis={{ tooltip: value }}>{value}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: target }}>{target}</Typography.Text>
          </div>
        )
      },
    },
    {
      title: 'Ưu đãi', key: 'benefit', width: 195,
      responsive: ['sm'],
      render: (_value: unknown, row: VoucherCategoryRow) => {
        const benefit = row.discount_type === 'GIFT'
          ? 'Ưu đãi cũ cần cập nhật'
          : row.discount_type === 'AMOUNT'
            ? `Giảm ${formatMoney(row.discount_value)}`
            : `Giảm ${Number(row.discount_value ?? 0).toLocaleString('vi-VN')}%`
        const condition = category === 'academy-course'
          ? [
              Number(row.minimum_tuition ?? 0) > 0 ? `Học phí từ ${formatMoney(row.minimum_tuition)}` : null,
              `Tối đa ${row.max_uses_per_student ?? 1} lần/học viên`,
            ].filter(Boolean).join(' · ')
          : category === 'product'
            ? [
                Number(row.minimum_order_amount ?? 0) > 0 ? `Sản phẩm áp dụng từ ${formatMoney(row.minimum_order_amount)}` : null,
                row.discount_type === 'PERCENT' && row.maximum_discount_amount != null ? `Giảm tối đa ${formatMoney(row.maximum_discount_amount)}` : null,
              ].filter(Boolean).join(' · ')
            : ''
        return (
          <div>
            <Typography.Text ellipsis={{ tooltip: benefit }}>{benefit}</Typography.Text>
            {condition && <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: condition }}>{condition}</Typography.Text>}
          </div>
        )
      },
    },
    {
      title: 'Phát hành',
      key: 'issue',
      width: 140,
      responsive: ['xl'],
      render: (_value: unknown, row: VoucherCategoryRow) => {
        if (row.issue_mode === 'FIXED') {
          const points = row.points_cost == null ? 'Miễn phí' : `${Number(row.points_cost).toLocaleString('vi-VN')} điểm`
          return (
            <div>
              <Tag color="blue">Gán thủ công</Tag>
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: points }}>{points}</Typography.Text>
            </div>
          )
        }
        const audience = category === 'academy-course' ? '' : row.card_rank_name || 'Mọi hạng'
        const points = row.points_cost == null ? 'Miễn phí' : `${Number(row.points_cost).toLocaleString('vi-VN')} điểm`
        const details = [audience, points].filter(Boolean).join(' · ')
        return (
          <div>
            <Tag color="cyan">Tự động</Tag>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }} ellipsis={{ tooltip: details }}>{details}</Typography.Text>
          </div>
        )
      },
    },
    {
      title: 'Cơ sở',
      dataIndex: 'branch_name',
      key: 'branch',
      width: 130,
      responsive: ['lg'],
      render: (value?: string | null) => value || 'Tất cả cơ sở',
    },
    {
      title: 'Số lượng',
      key: 'quantity',
      width: 80,
      responsive: ['xl'],
      render: (_value: unknown, row: VoucherCategoryRow) => row.quantity_total == null
        ? <Typography.Text ellipsis={{ tooltip: 'Không giới hạn' }}>Không giới hạn</Typography.Text>
        : `${Math.max(Number(row.quantity_total) - Number(row.quantity_given ?? 0), 0)}/${row.quantity_total}`,
    },
    {
      title: 'Thời hạn',
      width: 150,
      responsive: ['xl'],
      render: (_value: unknown, row: VoucherCategoryRow) => {
        const start = row.start_date ? dayjs(row.start_date).format('DD/MM/YYYY') : null
        const end = row.end_date ? dayjs(row.end_date).format('DD/MM/YYYY') : null
        const period = !start && !end ? 'Không giới hạn' : `${start ?? '—'} → ${end ?? '—'}`
        return <Typography.Text ellipsis={{ tooltip: period }}>{period}</Typography.Text>
      },
    },
    { title: 'Trạng thái', dataIndex: 'is_active', width: 85, responsive: ['sm'], render: (value: boolean, row) => row.end_date && dayjs(row.end_date).isBefore(dayjs(), 'day') ? <Tag>Hết hạn</Tag> : value ? <Tag color="green">Hoạt động</Tag> : <Tag>Tắt</Tag> },
    ...(canUpdate ? [{
      title: 'Thao tác', key: 'actions', align: 'center' as const, width: 88,
      render: (_value: unknown, row: VoucherCategoryRow) => (
        <RowActionsMenu
          items={[
            { key: 'edit', icon: <EditOutlined />, label: 'Sửa' },
            { key: 'delete', icon: <DeleteOutlined />, label: 'Xóa', danger: true },
          ]}
          onSelect={(key) => {
            if (key === 'edit') openModal(row)
            if (key === 'delete') Modal.confirm({ title: 'Xóa voucher này?', content: 'Xóa mềm (is_deleted). Không xóa được voucher đã phát hành cho khách hoặc đang cấu hình ở quà/vòng quay.', okText: 'Xóa', okButtonProps: { danger: true }, cancelText: 'Hủy', onOk: () => remove(row) })
          }}
        />
      ),
    }] : []),
  ]

  return (
    <>
      <StatCards items={statItems} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Input.Search
            allowClear
            placeholder="Tìm theo tên voucher"
            className="w-[260px]! max-w-[min(260px,46vw)] min-w-[140px]"
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); if (!event.target.value) applySearch('') }}
            onSearch={(v) => applySearch(v)}
          />
          <Select
            value={branchFilter ?? 'ALL'}
            style={{ width: 220 }}
            options={[{ value: 'ALL', label: 'Tất cả cơ sở' }, ...branches]}
            onChange={(value) => { setBranchFilter(value === 'ALL' ? undefined : value); setPage(1) }}
          />
        </div>
        <Can I="UPDATE" a="VOUCHER">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Thêm voucher</Button>
        </Can>
      </div>
      {vouchersQuery.isError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message="Không tải được danh sách voucher" description={errorMessage(vouchersQuery.error)} action={<Button size="small" onClick={() => void vouchersQuery.refetch()}>Thử lại</Button>} />}
      {targetsQuery.isError && <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={`Không tải được danh sách ${meta.label.replace('Voucher ', '').toLowerCase()}`} description={errorMessage(targetsQuery.error)} />}
      <Table<VoucherCategoryRow>
        className="[&_.ant-table-thead_th]:whitespace-nowrap"
        rowKey="id"
        loading={vouchersQuery.isLoading}
        dataSource={rows}
        pagination={false}
        columns={columns}
        tableLayout="fixed"
      />
      <ListPagination page={page} limit={PAGE_SIZE} total={total} onChange={setPage} noun="voucher" />
      <VoucherModal
        form={form}
        open={open}
        category={category}
        targets={targets}
        productCategories={productCategories}
        branches={branches}
        branchesLoading={branchesQuery.isLoading}
        ranks={ranks}
        editing={editing}
        onCancel={() => setOpen(false)}
        onOk={() => void submit()}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      />
    </>
  )
}

export default function Vouchers() {
  const [activeTab, setActiveTab] = useState<VoucherCategory>('treatment-package')
  return (
    <>
      <PageTitle subtitle="Mỗi loại voucher được quản lý riêng theo gói liệu trình, khóa học hoặc sản phẩm">Voucher</PageTitle>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as VoucherCategory) }}
        items={CATEGORIES.map((category) => ({
          key: category,
          label: CATEGORY_META[category].label,
          children: <VoucherCategoryTab category={category} />,
        }))}
      />
    </>
  )
}
